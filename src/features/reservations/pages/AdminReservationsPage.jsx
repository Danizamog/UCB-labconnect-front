import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  BookOpen,
  ClipboardList,
  DoorOpen,
  LayoutDashboard,
  SearchCheck,
  Users,
} from 'lucide-react'
import { listAdminLabs } from '../../admin/services/infrastructureService'
import { listUserProfiles } from '../../admin/services/profileService'
import {
  listPendingTutorialSessions,
  updateTutorialSessionApproval,
} from '../../tutorials/services/tutorialSessionsService'
import {
  createWalkInReservation,
  getOccupancyDashboard,
  getReservationStats,
  listReservationsPage,
  listSupplyReservations,
  markReservationAbsent,
  registerReservationEntry,
  registerReservationExit,
  subscribeReservationsRealtime,
  updateReservation,
  updateReservationStatus,
  updateSupplyReservationStatus,
  applyRealtimeRecordPatch,
  mapReservationRecord,
} from '../services/reservationsService'
import ReservationEditModal from './ReservationEditModal'
import { hasAnyPermission, isAdminUser } from '../../../shared/lib/permissions'
import { formatDate, formatDateTime } from '../../../shared/utils/formatters'
import './ReservationsPages.css'

const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  in_progress: 'En curso',
  completed: 'Completada',
  absent: 'Ausente',
}

const FINAL_RESERVATION_STATUSES = new Set(['rejected', 'cancelled', 'completed', 'absent'])

const TABLE_SORT_OPTIONS = [
  { value: 'start_at', label: 'Fecha de inicio' },
  { value: 'end_at', label: 'Fecha de fin' },
  { value: 'status', label: 'Estado' },
  { value: 'purpose', label: 'Motivo' },
  { value: 'requested_by_name', label: 'Solicitante' },
  { value: 'requested_by_email', label: 'Correo' },
]

const WHERE_EXAMPLES = [
  { label: 'Solo pendientes', value: 'status=pending' },
  { label: 'Solo aprobadas', value: 'status=approved' },
  { label: 'Con al menos 2 asistentes', value: 'attendees_count>=2' },
  { label: 'Motivo contiene "practica"', value: 'purpose~practica' },
  { label: 'Aprobadas con minimo 1 asistente', value: 'status=approved;attendees_count>=1' },
]

const ADMIN_RESERVATION_SECTIONS = [
  {
    id: 'dashboard-acceso',
    label: 'Resumen',
    helper: 'Ve lo importante de hoy y elige una tarea.',
    tone: 'overview',
  },
  {
    id: 'ocupacion-actual',
    label: 'Ocupacion actual',
    helper: 'Consulta quien esta dentro y los cupos por laboratorio.',
    tone: 'live',
  },
  {
    id: 'ingreso-rapido',
    label: 'Ingreso rapido',
    helper: 'Registra un walk-in cuando haya espacio disponible.',
    tone: 'walkin',
  },
  {
    id: 'control-entradas-salidas',
    label: 'Entradas y salidas',
    helper: 'Atiende solo las reservas de hoy que requieren accion.',
    tone: 'control',
  },
  {
    id: 'solicitudes-reserva',
    label: 'Solicitudes',
    helper: 'Busca, filtra y edita reservas sin distracciones.',
    tone: 'requests',
  },
  {
    id: 'tutorias-pendientes',
    label: 'Tutorias pendientes',
    helper: 'Aprueba o rechaza tutorias y elige sus materiales solicitados.',
    tone: 'requests',
  },
]

const SECTION_ICON_MAP = {
  'dashboard-acceso': LayoutDashboard,
  'ocupacion-actual': Activity,
  'ingreso-rapido': DoorOpen,
  'control-entradas-salidas': ClipboardList,
  'solicitudes-reserva': SearchCheck,
  'tutorias-pendientes': BookOpen,
}

const defaultTableFilters = {
  status: 'pending',
  laboratory_id: '',
  date: '',
  where: '',
  sortBy: 'start_at',
  sortType: 'DESC',
  pageSize: 20,
}

function todayDate() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5)
}

function timeWithOffset(minutesToAdd) {
  const date = new Date()
  date.setMinutes(date.getMinutes() + minutesToAdd)
  return date.toTimeString().slice(0, 5)
}

function combineDateTime(date, time) {
  return `${date}T${time}:00`
}

function minutesFromClock(time) {
  const [hours = '0', minutes = '0'] = String(time || '').split(':')
  return Number(hours) * 60 + Number(minutes)
}

function minutesSinceStart(reservation) {
  const startsAt = new Date(`${reservation.date}T${reservation.start_time}:00`)
  return Math.floor((Date.now() - startsAt.getTime()) / 60000)
}

function getReservationSectionFromHash(hash = '') {
  const normalizedHash = String(hash || '').replace(/^#/, '')
  return ADMIN_RESERVATION_SECTIONS.some((section) => section.id === normalizedHash)
    ? normalizedHash
    : 'dashboard-acceso'
}

function formatAccessTime(value) {
  return value ? formatDateTime(value) : 'No registrado'
}

function AdminReservationsPage({ user, currentHash = '', onNavigate }) {
  const [todaysReservations, setTodaysReservations] = useState([])
  const [reservationCounters, setReservationCounters] = useState({ total: 0, pending: 0, walkIn: 0 })
  const [tableReservations, setTableReservations] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [tableFilters, setTableFilters] = useState(defaultTableFilters)
  const [tableQuery, setTableQuery] = useState({ ...defaultTableFilters, pageNumber: 0 })
  const [tableMeta, setTableMeta] = useState({
    pageNumber: 0,
    pageSize: defaultTableFilters.pageSize,
    totalElements: 0,
    totalPages: 0,
    sortBy: defaultTableFilters.sortBy,
    sortType: defaultTableFilters.sortType,
    where: '',
  })
  const [occupancy, setOccupancy] = useState({ current_occupancy: 0, active_sessions: [], lab_breakdown: [] })
  const [labs, setLabs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [editingReservationId, setEditingReservationId] = useState(null)
  const [linkedSupplyReservations, setLinkedSupplyReservations] = useState([])
  const [isLoadingLinkedSupplies, setIsLoadingLinkedSupplies] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isProcessingReservationAction, setIsProcessingReservationAction] = useState(false)
  const [isRejectingReservation, setIsRejectingReservation] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState(() => getReservationSectionFromHash(currentHash))
  const [rejectionReason, setRejectionReason] = useState('')
  const [walkInForm, setWalkInForm] = useState({
    laboratory_id: '',
    requested_by: '',
    occupant_name: '',
    occupant_email: '',
    purpose: '',
    station_label: '',
    end_time: timeWithOffset(60),
  })
  const [draft, setDraft] = useState({
    laboratory_id: '',
    date: '',
    start_time: '08:00',
    end_time: '09:00',
    purpose: '',
    notes: '',
  })
  const [isSavingWalkIn, setIsSavingWalkIn] = useState(false)
  const [actioningId, setActioningId] = useState(null)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pendingTutorials, setPendingTutorials] = useState([])
  const [isLoadingPendingTutorials, setIsLoadingPendingTutorials] = useState(false)
  const [tutorialSupplyMap, setTutorialSupplyMap] = useState({})
  const [tutorialSupplySelection, setTutorialSupplySelection] = useState({})
  const [tutorialRejectionDrafts, setTutorialRejectionDrafts] = useState({})
  const [tutorialActionId, setTutorialActionId] = useState('')
  const tableQueryRef = useRef({ ...defaultTableFilters, pageNumber: 0 })
  const realtimeRefreshTimeoutRef = useRef(null)

  const canManage = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])
  const isAdmin = isAdminUser(user)

  const loadReferenceData = useCallback(async () => {
    try {
      const [labsResult, profilesResult] = await Promise.allSettled([
        listAdminLabs(),
        listUserProfiles(),
      ])

      if (labsResult.status !== 'fulfilled') {
        throw new Error('No se pudieron cargar los datos base del panel de reservas.')
      }

      const labsData = labsResult.value
      const profilesData = profilesResult.status === 'fulfilled' && Array.isArray(profilesResult.value) ? profilesResult.value : []

      setLabs(labsData)
      setProfiles(profilesData)
      const currentUserId = String(user?.user_id || '')
      const eligibleLabs = isAdminUser(user)
        ? labsData
        : labsData.filter((lab) => String(lab?.manager || '') === currentUserId)
      setWalkInForm((previous) => ({
        ...previous,
        laboratory_id: previous.laboratory_id || eligibleLabs[0]?.id || '',
        end_time: previous.end_time || timeWithOffset(60),
      }))
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos base del panel de reservas.')
    }
  }, [user])

  const loadOperationalData = useCallback(async () => {
    try {
      const today = todayDate()
      const [todayPage, statsResult, occupancyResult] = await Promise.allSettled([
        listReservationsPage({ date: today, pageSize: 100, sortBy: 'start_at', sortType: 'ASC' }),
        getReservationStats(),
        getOccupancyDashboard(),
      ])

      if (occupancyResult.status !== 'fulfilled' || todayPage.status !== 'fulfilled') {
        throw new Error('No se pudo cargar el panel de reservas.')
      }

      setTodaysReservations(todayPage.value.items)
      setReservationCounters({
        total: statsResult.status === 'fulfilled' ? statsResult.value.total : 0,
        pending: statsResult.status === 'fulfilled' ? statsResult.value.pending : 0,
        walkIn: statsResult.status === 'fulfilled' ? statsResult.value.walk_in : 0,
      })
      setOccupancy(occupancyResult.value)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar el panel de reservas.')
    }
  }, [])

  const loadTableData = useCallback(async (query) => {
    setTableLoading(true)
    try {
      const page = await listReservationsPage(query)
      setTableReservations(page.items)
      setTableMeta({
        pageNumber: page.pageNumber,
        pageSize: page.pageSize,
        totalElements: page.totalElements,
        totalPages: page.totalPages,
        sortBy: page.sortBy,
        sortType: page.sortType,
        where: page.where,
      })
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la tabla de reservas.')
    } finally {
      setTableLoading(false)
    }
  }, [])

  const loadPendingTutorialsData = useCallback(async () => {
    setIsLoadingPendingTutorials(true)
    try {
      const sessions = await listPendingTutorialSessions()
      setPendingTutorials(sessions)

      const supplyResults = await Promise.all(
        sessions.map(async (session) => {
          try {
            const supplies = await listSupplyReservations({
              tutorial_session_id: session.id,
              skipCache: true,
            })
            return [session.id, supplies]
          } catch {
            return [session.id, []]
          }
        }),
      )

      const supplyMap = Object.fromEntries(supplyResults)
      setTutorialSupplyMap(supplyMap)
      setTutorialSupplySelection((previous) => {
        const next = { ...previous }
        for (const [sessionId, supplies] of supplyResults) {
          if (!next[sessionId]) {
            next[sessionId] = Object.fromEntries(
              supplies
                .filter((supply) => supply.status === 'pending')
                .map((supply) => [supply.id, true]),
            )
          }
        }
        return next
      })
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las tutorias pendientes.')
    } finally {
      setIsLoadingPendingTutorials(false)
    }
  }, [])

  const reloadAll = useCallback(async () => {
    await Promise.all([loadOperationalData(), loadTableData(tableQueryRef.current)])
  }, [loadOperationalData, loadTableData])

  useEffect(() => {
    tableQueryRef.current = tableQuery
  }, [tableQuery])

  useEffect(() => {
    loadReferenceData()
    loadOperationalData()

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic !== 'lab_reservation') return

      const today = todayDate()
      const recordDate = String(event?.record?.start_at || '').slice(0, 10)
      const patchOptions = { mapper: mapReservationRecord }

      if (recordDate === today) {
        setTodaysReservations((prev) => applyRealtimeRecordPatch(prev, event, patchOptions))
      }

      setTableReservations((prev) => {
        const action = String(event?.action || '').toLowerCase()
        const id = String(event?.record?.id || '')
        if (!id) return prev
        if (action === 'delete') {
          return prev.filter((item) => String(item?.id) !== id)
        }
        const index = prev.findIndex((item) => String(item?.id) === id)
        if (index === -1) return prev
        const next = prev.slice()
        next[index] = { ...next[index], ...mapReservationRecord(event.record) }
        return next
      })

      window.clearTimeout(realtimeRefreshTimeoutRef.current)
      realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
        loadOperationalData().catch(() => {})
      }, 1500)
    }, {
      topics: ['lab_reservation'],
      onResync: () => {
        loadOperationalData()
        loadTableData(tableQueryRef.current)
      },
    })

    return () => {
      window.clearTimeout(realtimeRefreshTimeoutRef.current)
      unsubscribe?.()
    }
  }, [loadOperationalData, loadReferenceData, loadTableData])

  useEffect(() => {
    loadTableData(tableQuery)
  }, [loadTableData, tableQuery])

  useEffect(() => {
    setActiveWorkspace(getReservationSectionFromHash(currentHash))
  }, [currentHash])

  useEffect(() => {
    if (activeWorkspace === 'tutorias-pendientes') {
      loadPendingTutorialsData()
    }
  }, [activeWorkspace, loadPendingTutorialsData])

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )
  const labById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab])),
    [labs],
  )
  const profileById = useMemo(
    () => Object.fromEntries(profiles.map((profile) => [String(profile.id || ''), profile])),
    [profiles],
  )

  const managedLabIds = useMemo(() => {
    const currentUserId = String(user?.user_id || '')
    if (!currentUserId) return []
    return labs
      .filter((lab) => String(lab?.manager || '') === currentUserId)
      .map((lab) => String(lab.id))
  }, [labs, user?.user_id])
  const restrictToManagedLabs = !isAdmin
  const visibleLabs = useMemo(() => {
    if (!restrictToManagedLabs) return labs
    return labs.filter((lab) => managedLabIds.includes(String(lab.id)))
  }, [labs, managedLabIds, restrictToManagedLabs])
  const isReservationVisible = useCallback((reservation) => {
    if (!restrictToManagedLabs) return true
    if (managedLabIds.length === 0) return false
    return managedLabIds.includes(String(reservation?.laboratory_id || ''))
  }, [restrictToManagedLabs, managedLabIds])
  const visibleTodaysReservations = useMemo(
    () => todaysReservations.filter(isReservationVisible),
    [todaysReservations, isReservationVisible],
  )
  const visibleTableReservations = useMemo(
    () => tableReservations.filter(isReservationVisible),
    [tableReservations, isReservationVisible],
  )
  const visibleOccupancy = useMemo(() => {
    if (!restrictToManagedLabs) return occupancy
    const labBreakdown = (occupancy.lab_breakdown || []).filter((entry) =>
      managedLabIds.includes(String(entry.laboratory_id || '')),
    )
    const activeSessions = (occupancy.active_sessions || []).filter((session) =>
      managedLabIds.includes(String(session.laboratory_id || '')),
    )
    const currentOccupancy = labBreakdown.reduce(
      (total, entry) => total + Number(entry.occupancy_count || 0),
      0,
    )
    return { current_occupancy: currentOccupancy, lab_breakdown: labBreakdown, active_sessions: activeSessions }
  }, [occupancy, restrictToManagedLabs, managedLabIds])
  const visibleReservationCounters = useMemo(() => {
    if (!restrictToManagedLabs) return reservationCounters
    const total = visibleTableReservations.length
    const pending = visibleTableReservations.filter((item) => item.status === 'pending').length
    const walkIn = visibleTableReservations.filter((item) => item.is_walk_in).length
    return { total, pending, walkIn }
  }, [restrictToManagedLabs, reservationCounters, visibleTableReservations])

  const filteredProfiles = useMemo(() => {
    if (!userSearchTerm || userSearchTerm.trim() === '') return profiles.slice(0, 200)
    const term = userSearchTerm.toLowerCase()
    return profiles.filter((p) =>
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.username && p.username.toLowerCase().includes(term)) ||
      (p.email && p.email.toLowerCase().includes(term))
    ).slice(0, 200)
  }, [profiles, userSearchTerm])

  const getReservationLabLabel = (reservation) =>
    reservation?.laboratory_name || labNameById[String(reservation?.laboratory_id || '')] || reservation?.laboratory_id || '-'

  const getReservationRequesterName = (reservation) => {
    const profile = profileById[String(reservation?.requested_by || '')]
    return reservation?.requested_by_name || profile?.name || profile?.username || reservation?.requested_by || '-'
  }

  const getReservationRequesterEmail = (reservation) => {
    const profile = profileById[String(reservation?.requested_by || '')]
    return reservation?.requested_by_email || profile?.email || profile?.username || '-'
  }

  const handleWorkspaceChange = useCallback((workspaceId) => {
    setActiveWorkspace(workspaceId)
    onNavigate?.(`/app/admin/reservas#${workspaceId}`, { replace: true })
  }, [onNavigate])

  const pendingCount = visibleReservationCounters.pending
  const walkInCount = visibleReservationCounters.walkIn
  const selectedWalkInLab = labById[String(walkInForm.laboratory_id)] || null
  const selectedWalkInProfile = profileById[String(walkInForm.requested_by)] || null
  const selectedWalkInLabOccupancy =
    occupancy.lab_breakdown.find((entry) => String(entry.laboratory_id) === String(walkInForm.laboratory_id))?.occupancy_count || 0
  const selectedWalkInLabRemainingCapacity =
    selectedWalkInLab && Number(selectedWalkInLab.capacity || 0) > 0
      ? Math.max(Number(selectedWalkInLab.capacity || 0) - selectedWalkInLabOccupancy, 0)
      : null
  const walkInCurrentStartTime = nowTime()
  const isWalkInChronologyValid = minutesFromClock(walkInForm.end_time) > minutesFromClock(walkInCurrentStartTime)
  const isWalkInCapacityAvailable =
    selectedWalkInLab && Number(selectedWalkInLab.capacity || 0) > 0 ? selectedWalkInLabRemainingCapacity > 0 : true
  const isWalkInRequesterValid = profiles.length === 0 || Boolean(selectedWalkInProfile)
  const isWalkInFormValid =
    String(walkInForm.laboratory_id || '').trim().length > 0 &&
    walkInForm.requested_by.trim().length >= 4 &&
    isWalkInRequesterValid &&
    walkInForm.occupant_name.trim().length >= 5 &&
    walkInForm.occupant_email.trim().length > 0 &&
    walkInForm.purpose.trim().length >= 8 &&
    isWalkInChronologyValid &&
    isWalkInCapacityAvailable
  const isEditChronologyValid = minutesFromClock(draft.end_time) > minutesFromClock(draft.start_time)
  const editValidationMessage = !isEditChronologyValid ? 'La hora de fin debe ser mayor a la hora de inicio.' : ''

  const sortedTodaysReservations = useMemo(
    () => [...visibleTodaysReservations].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [visibleTodaysReservations],
  )
  const actionableTodaysReservations = useMemo(
    () => sortedTodaysReservations.filter((item) => item.status === 'approved' || item.status === 'in_progress'),
    [sortedTodaysReservations],
  )
  const editingReservation = useMemo(
    () => todaysReservations.find((item) => item.id === editingReservationId)
      || tableReservations.find((item) => item.id === editingReservationId)
      || null,
    [editingReservationId, todaysReservations, tableReservations],
  )
  const canApproveFromModal = Boolean(editingReservation && editingReservation.status === 'pending' && canManage)
  const canRejectFromModal = canApproveFromModal
  const canCancelFromModal = Boolean(editingReservation && canManage && ['pending', 'approved'].includes(editingReservation.status))
  const canRegisterEntryFromModal = Boolean(editingReservation && editingReservation.status === 'approved' && canManage)
  const canRegisterExitFromModal = Boolean(editingReservation && editingReservation.status === 'in_progress' && canManage)
  const canMarkAbsentFromModal = Boolean(
    editingReservation
      && editingReservation.status === 'approved'
      && minutesSinceStart(editingReservation) >= 15
      && canManage,
  )

  const handleStartEdit = (reservation) => {
    setEditingReservationId(reservation.id)
    setIsRejectingReservation(false)
    setRejectionReason(reservation.cancel_reason || '')
    setDraft({
      laboratory_id: String(reservation.laboratory_id || ''),
      date: reservation.date || '',
      start_time: reservation.start_time || '08:00',
      end_time: reservation.end_time || '09:00',
      purpose: reservation.purpose || '',
      notes: reservation.notes || '',
    })
    setError('')
    setMessage('')
    setLinkedSupplyReservations([])
    setIsLoadingLinkedSupplies(true)
    listSupplyReservations({ lab_reservation_id: reservation.id, skipCache: true })
      .then((data) => {
        setLinkedSupplyReservations(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        setLinkedSupplyReservations([])
      })
      .finally(() => {
        setIsLoadingLinkedSupplies(false)
      })
  }

  const handleCancelEdit = () => {
    setEditingReservationId(null)
    setIsSavingEdit(false)
    setIsProcessingReservationAction(false)
    setIsRejectingReservation(false)
    setRejectionReason('')
    setLinkedSupplyReservations([])
    setIsLoadingLinkedSupplies(false)
    setDraft({
      laboratory_id: '',
      date: '',
      start_time: '08:00',
      end_time: '09:00',
      purpose: '',
      notes: '',
    })
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()
    if (!canManage || !editingReservationId) {
      return
    }

    setError('')
    setMessage('')
    setIsSavingEdit(true)

    try {
      const selectedLab = labs.find((lab) => String(lab.id) === String(draft.laboratory_id))
      await updateReservation(editingReservationId, {
        ...draft,
        area_id: selectedLab?.area_id || '',
      })
      setMessage('Reserva actualizada correctamente. Si cambiaste horario o laboratorio, el estudiante recibira una alerta.')
      handleCancelEdit()
      await reloadAll()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva.')
      setIsSavingEdit(false)
    }
  }

  const handleRegisterEntry = async (reservation) => {
    setError('')
    setMessage('')
    setActioningId(reservation.id)
    try {
      const requesterEmail = getReservationRequesterEmail(reservation)
      await registerReservationEntry(reservation.id, {
        occupant_name: getReservationRequesterName(reservation),
        occupant_email: requesterEmail === '-' ? '' : requesterEmail,
        station_label: reservation.station_label || '',
      })
      setMessage('Entrada registrada. La reserva cambio a En curso y se guardo la hora exacta del ingreso.')
      await reloadAll()
    } catch (err) {
      setError(err.message || 'No se pudo registrar la entrada.')
    } finally {
      setActioningId(null)
    }
  }

  const handleRegisterExit = async (reservationId) => {
    setError('')
    setMessage('')
    setActioningId(reservationId)
    try {
      await registerReservationExit(reservationId)
      setMessage('Salida registrada. La reserva cambio a Completada y el espacio quedo liberado.')
      await reloadAll()
    } catch (err) {
      setError(err.message || 'No se pudo registrar la salida.')
    } finally {
      setActioningId(null)
    }
  }

  const handleMarkAbsent = async (reservationId) => {
    setError('')
    setMessage('')
    setActioningId(reservationId)
    try {
      await markReservationAbsent(reservationId)
      setMessage('Reserva marcada como Ausente. El bloque vuelve a quedar libre para nuevas asignaciones.')
      await reloadAll()
    } catch (err) {
      setError(err.message || 'No se pudo marcar la reserva como ausente.')
    } finally {
      setActioningId(null)
    }
  }

  const handleReservationModalAction = async (action) => {
    if (!editingReservation || !canManage) {
      return
    }

    setError('')
    setMessage('')
    setIsProcessingReservationAction(true)

    const cascadeSupplies = async (targetStatus) => {
      const toCascade = linkedSupplyReservations.filter((supply) => {
        if (targetStatus === 'approved') return supply.status === 'pending'
        if (targetStatus === 'cancelled') return supply.status !== 'cancelled'
        return false
      })
      if (toCascade.length === 0) return { ok: 0, failed: [] }

      const results = await Promise.allSettled(
        toCascade.map((supply) => updateSupplyReservationStatus(supply.id, targetStatus)),
      )
      const failed = results
        .map((r, idx) => ({ r, supply: toCascade[idx] }))
        .filter(({ r }) => r.status === 'rejected')
        .map(({ r, supply }) => `${supply.stock_item_name || supply.stock_item_id}: ${r.reason?.message || 'error'}`)
      return { ok: results.length - failed.length, failed }
    }

    try {
      if (action === 'approve') {
        await updateReservationStatus(editingReservation.id, 'approved')
        const { ok, failed } = await cascadeSupplies('approved')
        const supplyNote = ok > 0
          ? ` Tambien se aprobaron ${ok} reserva(s) de reactivos vinculadas y se descuento el stock.`
          : ''
        const failureNote = failed.length > 0
          ? ` No se pudieron aprobar ${failed.length} reactivo(s): ${failed.join(' | ')}`
          : ''
        setMessage(`Reserva aprobada correctamente.${supplyNote}${failureNote}`)
      }

      if (action === 'cancel') {
        await updateReservationStatus(editingReservation.id, 'cancelled')
        const { ok, failed } = await cascadeSupplies('cancelled')
        const supplyNote = ok > 0 ? ` Se cancelaron ${ok} reactivo(s) vinculado(s).` : ''
        const failureNote = failed.length > 0 ? ` Errores: ${failed.join(' | ')}` : ''
        setMessage(`Reserva cancelada correctamente.${supplyNote}${failureNote}`)
      }

      if (action === 'reject') {
        if (!rejectionReason.trim()) {
          throw new Error('Debes escribir el motivo del rechazo antes de continuar.')
        }
        await updateReservationStatus(editingReservation.id, 'rejected', { cancel_reason: rejectionReason.trim() })
        const { ok, failed } = await cascadeSupplies('cancelled')
        const supplyNote = ok > 0 ? ` Se cancelaron ${ok} reactivo(s) vinculado(s).` : ''
        const failureNote = failed.length > 0 ? ` Errores: ${failed.join(' | ')}` : ''
        setMessage(`Reserva rechazada correctamente.${supplyNote}${failureNote}`)
      }

      if (action === 'entry') {
        const requesterEmail = getReservationRequesterEmail(editingReservation)
        await registerReservationEntry(editingReservation.id, {
          occupant_name: getReservationRequesterName(editingReservation),
          occupant_email: requesterEmail === '-' ? '' : requesterEmail,
          station_label: editingReservation.station_label || '',
        })
        setMessage('Entrada registrada. La reserva cambio a En curso y se guardo la hora exacta del ingreso.')
      }

      if (action === 'exit') {
        await registerReservationExit(editingReservation.id)
        setMessage('Salida registrada. La reserva cambio a Completada y el espacio quedo liberado.')
      }

      if (action === 'absent') {
        await markReservationAbsent(editingReservation.id)
        setMessage('Reserva marcada como Ausente. El bloque vuelve a quedar libre para nuevas asignaciones.')
      }

      handleCancelEdit()
      await reloadAll()
    } catch (err) {
      setError(err.message || 'No se pudo completar la accion sobre la reserva.')
      setIsProcessingReservationAction(false)
    }
  }

  const handleCreateWalkIn = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSavingWalkIn(true)
    try {
      const currentDate = todayDate()
      const currentStartTime = nowTime()
      const selectedLab = labs.find((lab) => String(lab.id) === String(walkInForm.laboratory_id))
      const currentOccupancy =
        occupancy.lab_breakdown.find((entry) => String(entry.laboratory_id) === String(walkInForm.laboratory_id))?.occupancy_count || 0

      if (!selectedLab) {
        throw new Error('Debes seleccionar un laboratorio valido para registrar el ingreso rapido.')
      }

      if (minutesFromClock(walkInForm.end_time) <= minutesFromClock(currentStartTime)) {
        throw new Error('La hora estimada de salida debe ser posterior a la hora actual.')
      }

      if (Number(selectedLab.capacity || 0) > 0 && currentOccupancy >= Number(selectedLab.capacity || 0)) {
        throw new Error('El laboratorio ya alcanzo su capacidad actual y no admite nuevos ingresos rapidos.')
      }

      await createWalkInReservation({
        laboratory_id: walkInForm.laboratory_id,
        area_id: selectedLab.area_id || '',
        requested_by: walkInForm.requested_by.trim(),
        occupant_name: walkInForm.occupant_name.trim(),
        occupant_email: walkInForm.occupant_email.trim(),
        purpose: walkInForm.purpose.trim() || 'Ingreso rapido sin reserva previa',
        station_label: walkInForm.station_label.trim(),
        start_at: combineDateTime(currentDate, currentStartTime),
        end_at: combineDateTime(currentDate, walkInForm.end_time),
        notes: 'Walk-in registrado desde dashboard de acceso',
      })
      setMessage('Ingreso rapido registrado correctamente. La ocupacion se actualizo en tiempo real.')
      setWalkInForm((previous) => ({
        ...previous,
        requested_by: '',
        occupant_name: '',
        occupant_email: '',
        purpose: '',
        station_label: '',
        end_time: timeWithOffset(60),
      }))
      setUserSearchTerm('')
      await reloadAll()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el walk-in.')
    } finally {
      setIsSavingWalkIn(false)
    }
  }

  const toggleTutorialSupply = (sessionId, supplyId) => {
    setTutorialSupplySelection((previous) => {
      const current = previous[sessionId] || {}
      return {
        ...previous,
        [sessionId]: {
          ...current,
          [supplyId]: !current[supplyId],
        },
      }
    })
  }

  const handleApproveTutorial = async (session) => {
    if (!session?.id) return
    setError('')
    setMessage('')
    setTutorialActionId(session.id)

    try {
      const supplies = tutorialSupplyMap[session.id] || []
      const selection = tutorialSupplySelection[session.id] || {}
      const toApprove = supplies.filter((supply) => supply.status === 'pending' && selection[supply.id])
      const toCancel = supplies.filter((supply) => supply.status === 'pending' && !selection[supply.id])

      await updateTutorialSessionApproval(session.id, 'approved')

      const approveResults = await Promise.allSettled(
        toApprove.map((supply) => updateSupplyReservationStatus(supply.id, 'approved')),
      )
      const cancelResults = await Promise.allSettled(
        toCancel.map((supply) => updateSupplyReservationStatus(supply.id, 'cancelled')),
      )

      const approvedOk = approveResults.filter((result) => result.status === 'fulfilled').length
      const approvedFailed = approveResults
        .map((result, idx) => ({ result, supply: toApprove[idx] }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ result, supply }) => `${supply.stock_item_name || supply.stock_item_id}: ${result.reason?.message || 'error'}`)
      const cancelledOk = cancelResults.filter((result) => result.status === 'fulfilled').length

      let notice = `Tutoria '${session.topic}' aprobada.`
      if (approvedOk > 0) notice += ` Se aprobaron ${approvedOk} insumo(s) y se descuento el stock.`
      if (cancelledOk > 0) notice += ` Se cancelaron ${cancelledOk} insumo(s) no seleccionado(s).`
      if (approvedFailed.length > 0) notice += ` Errores en insumos: ${approvedFailed.join(' | ')}`
      setMessage(notice)

      await loadPendingTutorialsData()
    } catch (err) {
      setError(err.message || 'No se pudo aprobar la tutoria.')
    } finally {
      setTutorialActionId('')
    }
  }

  const handleRejectTutorial = async (session) => {
    if (!session?.id) return
    const reason = String(tutorialRejectionDrafts[session.id] || '').trim()
    if (!reason) {
      setError('Debes escribir el motivo del rechazo antes de continuar.')
      return
    }

    setError('')
    setMessage('')
    setTutorialActionId(session.id)

    try {
      const supplies = tutorialSupplyMap[session.id] || []
      const pendingSupplies = supplies.filter((supply) => supply.status === 'pending')

      await updateTutorialSessionApproval(session.id, 'rejected', reason)

      const cancelResults = await Promise.allSettled(
        pendingSupplies.map((supply) => updateSupplyReservationStatus(supply.id, 'cancelled')),
      )
      const cancelledOk = cancelResults.filter((result) => result.status === 'fulfilled').length

      let notice = `Tutoria '${session.topic}' rechazada.`
      if (cancelledOk > 0) notice += ` Se cancelaron ${cancelledOk} insumo(s) vinculado(s).`
      setMessage(notice)

      setTutorialRejectionDrafts((previous) => {
        const next = { ...previous }
        delete next[session.id]
        return next
      })
      await loadPendingTutorialsData()
    } catch (err) {
      setError(err.message || 'No se pudo rechazar la tutoria.')
    } finally {
      setTutorialActionId('')
    }
  }

  const handleApplyTableFilters = (event) => {
    event.preventDefault()
    setTableQuery({
      ...tableFilters,
      where: String(tableFilters.where || '').trim(),
      pageNumber: 0,
    })
  }

  const handleResetTableFilters = () => {
    setTableFilters(defaultTableFilters)
    setTableQuery({
      ...defaultTableFilters,
      pageNumber: 0,
    })
  }

  const handleTablePageChange = (nextPageNumber) => {
    if (nextPageNumber < 0) {
      return
    }
    if (tableMeta.totalPages > 0 && nextPageNumber >= tableMeta.totalPages) {
      return
    }

    setTableQuery((previous) => ({
      ...previous,
      pageNumber: nextPageNumber,
    }))
  }

  const visibleTotalElements = restrictToManagedLabs ? visibleTableReservations.length : tableMeta.totalElements
  const visibleRangeStart = restrictToManagedLabs
    ? (visibleTableReservations.length === 0 ? 0 : 1)
    : (tableMeta.totalElements === 0 ? 0 : tableMeta.pageNumber * tableMeta.pageSize + 1)
  const visibleRangeEnd = restrictToManagedLabs
    ? visibleTableReservations.length
    : Math.min((tableMeta.pageNumber + 1) * tableMeta.pageSize, tableMeta.totalElements)
  const activeWorkspaceMeta =
    ADMIN_RESERVATION_SECTIONS.find((section) => section.id === activeWorkspace) || ADMIN_RESERVATION_SECTIONS[0]
  const ActiveWorkspaceIcon = SECTION_ICON_MAP[activeWorkspaceMeta.id] || LayoutDashboard

  return (
    <section className="reservations-page" aria-label="Panel de reservas">
      <header className="reservations-header">
        <div className="reservations-header-copy">
          <p className="reservations-kicker">Gestion paso a paso</p>
          <h2>Reservas de laboratorio</h2>
          <p>
            Atiende solicitudes, registra ingresos y revisa la ocupacion desde un flujo ordenado por tareas.
          </p>
        </div>
        <div className="reservations-summary">
          <div className="reservations-summary-card tone-overview">
            <span className="reservations-summary-card-icon"><LayoutDashboard size={18} /></span>
            <div>
              <span>Reservas</span>
              <strong>{visibleReservationCounters.total}</strong>
            </div>
          </div>
          <div className="reservations-summary-card tone-requests">
            <span className="reservations-summary-card-icon"><SearchCheck size={18} /></span>
            <div>
              <span>Pendientes</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>
          <div className="reservations-summary-card tone-live">
            <span className="reservations-summary-card-icon"><Users size={18} /></span>
            <div>
              <span>Dentro ahora</span>
              <strong>{visibleOccupancy.current_occupancy}</strong>
            </div>
          </div>
          <div className="reservations-summary-card tone-control">
            <span className="reservations-summary-card-icon"><ClipboardList size={18} /></span>
            <div>
              <span>Hoy</span>
              <strong>{sortedTodaysReservations.length}</strong>
            </div>
          </div>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel reservations-panel-secondary">
        <div className="reservations-panel-header">
          <h3>Seccion actual: {activeWorkspaceMeta.label}</h3>
          <p className="reservations-panel-subtitle">{activeWorkspaceMeta.helper}</p>
        </div>

        <div className="reservations-workspace-nav">
          {ADMIN_RESERVATION_SECTIONS.map((section) => {
            const Icon = SECTION_ICON_MAP[section.id] || LayoutDashboard
            return (
              <button
                key={section.id}
                type="button"
                className={`reservations-workspace-tab tone-${section.tone}${activeWorkspace === section.id ? ' is-active' : ''}`}
                onClick={() => handleWorkspaceChange(section.id)}
              >
                <div className="reservations-workspace-tab-head">
                  <span className="reservations-workspace-icon"><Icon size={18} /></span>
                  <strong>{section.label}</strong>
                </div>
                <span>{section.helper}</span>
              </button>
            )
          })}
        </div>

        <div className="reservations-workspace-status">
          <span className={`reservations-workspace-status-icon tone-${activeWorkspaceMeta.tone}`}><ActiveWorkspaceIcon size={18} /></span>
          <div>
            <strong>{activeWorkspaceMeta.label}</strong>
            <span>{activeWorkspaceMeta.helper}</span>
          </div>
        </div>
      </section>

      {activeWorkspace === 'dashboard-acceso' ? (
        <section className="reservations-panel reservations-panel-secondary">
          <div className="reservations-panel-header">
            <h3>Resumen</h3>
            <p className="reservations-panel-subtitle">Ve lo importante de hoy y elige una tarea.</p>
          </div>

          <div className="reservations-task-grid">
            <article className="reservations-task-card tone-overview">
              <div className="reservations-task-card-head">
                <span>Reservas</span>
                <span className="reservations-task-card-icon"><LayoutDashboard size={18} /></span>
              </div>
              <strong>{visibleReservationCounters.total}</strong>
              <p>Total de solicitudes registradas.</p>
            </article>
            <article className="reservations-task-card tone-requests">
              <div className="reservations-task-card-head">
                <span>Pendientes</span>
                <span className="reservations-task-card-icon"><SearchCheck size={18} /></span>
              </div>
              <strong>{pendingCount}</strong>
              <p>Empieza por las solicitudes que aun esperan respuesta.</p>
            </article>
            <article className="reservations-task-card tone-live">
              <div className="reservations-task-card-head">
                <span>Dentro ahora</span>
                <span className="reservations-task-card-icon"><Users size={18} /></span>
              </div>
              <strong>{visibleOccupancy.current_occupancy}</strong>
              <p>Usuarios que ya estan dentro de un laboratorio.</p>
            </article>
            <article className="reservations-task-card tone-control">
              <div className="reservations-task-card-head">
                <span>Acciones hoy</span>
                <span className="reservations-task-card-icon"><ClipboardList size={18} /></span>
              </div>
              <strong>{actionableTodaysReservations.length}</strong>
              <p>Reservas de hoy que pueden requerir entrada, salida o ausencia.</p>
            </article>
            <article className="reservations-task-card tone-walkin">
              <div className="reservations-task-card-head">
                <span>Walk-ins</span>
                <span className="reservations-task-card-icon"><DoorOpen size={18} /></span>
              </div>
              <strong>{walkInCount}</strong>
              <p>Ingresos rapidos registrados sin reserva previa.</p>
            </article>
          </div>

          <div className="reservations-step-grid">
            {ADMIN_RESERVATION_SECTIONS.map((section, index) => (
              <article key={section.id} className="reservations-step-card">
                <strong>{index + 1}</strong>
                <span><b>{section.label}.</b> {section.helper}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeWorkspace === 'ocupacion-actual' ? (
        <section className="reservations-panel reservations-panel-secondary">
          <div className="reservations-panel-header">
            <h3>Ocupacion actual</h3>
            <p className="reservations-panel-subtitle">
              El contador se actualiza en tiempo real con cada entrada, salida, walk-in o ausencia marcada.
            </p>
          </div>

          <div className="reservations-insight-grid">
            <article className="reservations-insight-card">
              <span>Usuarios dentro</span>
              <strong>{visibleOccupancy.current_occupancy}</strong>
              <p>Actualizado con cada check-in y check-out.</p>
            </article>
            <article className="reservations-insight-card">
              <span>Laboratorios activos</span>
              <strong>{visibleOccupancy.lab_breakdown.length}</strong>
              <p>Espacios con movimiento o capacidad reportada ahora mismo.</p>
            </article>
            <article className="reservations-insight-card">
              <span>Sesiones abiertas</span>
              <strong>{visibleOccupancy.active_sessions.length}</strong>
              <p>Personas que siguen dentro con una reserva o walk-in abierto.</p>
            </article>
          </div>

          {visibleOccupancy.lab_breakdown.length > 0 ? (
            <div className="reservation-card-grid">
              {visibleOccupancy.lab_breakdown.map((entry) => {
                const capacity = Number(entry.capacity || labById[String(entry.laboratory_id)]?.capacity || 0)
                const remainingCapacity = capacity > 0 ? Math.max(capacity - Number(entry.occupancy_count || 0), 0) : null
                return (
                  <article key={entry.laboratory_id} className="reservation-user-card">
                    <div className="reservation-user-card-head">
                      <div>
                        <span className="reservation-user-card-kicker">Laboratorio</span>
                        <h4>{entry.laboratory_name || labNameById[String(entry.laboratory_id)] || entry.laboratory_id}</h4>
                      </div>
                      <span className="reservations-status approved">{entry.occupancy_count}</span>
                    </div>
                    <div className="reservation-user-card-meta">
                      <span>{remainingCapacity === null ? 'Capacidad no configurada' : `${remainingCapacity} cupos libres`}</span>
                      {capacity > 0 ? <span>Capacidad total: {capacity}</span> : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="reservations-empty">No hay laboratorios con ocupacion registrada en este momento.</p>
          )}

          {visibleOccupancy.active_sessions.length > 0 ? (
            <div className="reservation-card-grid">
              {visibleOccupancy.active_sessions.map((session) => (
                <article key={session.id || `${session.reservation_id}-${session.check_in_at || session.check_in_time}`} className="reservation-user-card">
                  <div className="reservation-user-card-head">
                    <div>
                      <span className="reservation-user-card-kicker">{session.is_walk_in ? 'Walk-in' : 'En curso'}</span>
                      <h4>{session.occupant_name || getReservationRequesterName(session)}</h4>
                    </div>
                    <span className="reservations-status in_progress">Dentro</span>
                  </div>
                  <div className="reservation-user-card-meta">
                    <span>{session.laboratory_name || getReservationLabLabel(session)}</span>
                    <span>Ingreso: {formatAccessTime(session.check_in_at || session.check_in_time)}</span>
                    <span>Estacion: {session.station_label || 'Sin estacion'}</span>
                    <span>{session.purpose || 'Sin motivo registrado'}</span>
                  </div>
                  {canManage ? (
                    <div className="reservation-user-card-actions">
                      <button
                        type="button"
                        className="reservations-primary"
                        disabled={actioningId === (session.reservation_id || session.id)}
                        onClick={() => handleRegisterExit(session.reservation_id || session.id)}
                      >
                        {actioningId === (session.reservation_id || session.id) ? 'Procesando...' : 'Registrar salida'}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeWorkspace === 'ingreso-rapido' ? (
        <section className="reservations-panel reservations-panel-secondary">
          <div className="reservations-panel-header">
            <h3>Ingreso rapido sin reserva previa</h3>
            <p className="reservations-panel-subtitle">Usa esta vista cuando haya cupo libre y necesites registrar a alguien al instante.</p>
          </div>

          <div className="reservations-filter-callout">
            <AlertCircle size={18} />
            <span>Antes de guardar, revisa el aforo del laboratorio. El sistema valida hora de salida y capacidad disponible.</span>
          </div>

          <form className="reservations-form" onSubmit={handleCreateWalkIn}>
            <div className="reservations-form-grid">
              <label>
                <span>Laboratorio</span>
                <select
                  value={walkInForm.laboratory_id}
                  onChange={(event) => setWalkInForm((previous) => ({ ...previous, laboratory_id: event.target.value }))}
                  required
                >
                  <option value="">Selecciona un laboratorio</option>
                  {visibleLabs.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </label>

              <label style={{ position: 'relative' }}>
                <span>Buscar Usuario Institucional</span>
                <input
                  type="text"
                  placeholder="Escribe nombre o correo para buscar..."
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value)
                    setShowUserDropdown(true)
                    setWalkInForm((prev) => ({ ...prev, requested_by: '' }))
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                  required={!walkInForm.requested_by}
                />
                {showUserDropdown && filteredProfiles.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--brand-white, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '0.375rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    zIndex: 50,
                    marginTop: '4px'
                  }}>
                    {filteredProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setWalkInForm((previous) => ({
                            ...previous,
                            requested_by: profile.id,
                            occupant_name: profile.name || profile.username || '',
                            occupant_email: profile.email || profile.username || '',
                          }))
                          setUserSearchTerm(profile.name || profile.username || profile.email)
                          setShowUserDropdown(false)
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--surface-color, #f8fafc)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: 500 }}>{profile.name || profile.username || profile.id}</div>
                        <div style={{ fontSize: '0.85em', color: 'var(--text-secondary, #64748b)' }}>{profile.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </label>

              <label>
                <span>Nombre del ocupante</span>
                <input
                  value={walkInForm.occupant_name}
                  onChange={(event) => setWalkInForm((previous) => ({ ...previous, occupant_name: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Correo</span>
                <input
                  type="email"
                  value={walkInForm.occupant_email}
                  onChange={(event) => setWalkInForm((previous) => ({ ...previous, occupant_email: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Hora estimada de salida</span>
                <input
                  type="time"
                  value={walkInForm.end_time}
                  onChange={(event) => setWalkInForm((previous) => ({ ...previous, end_time: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Estacion</span>
                <input
                  value={walkInForm.station_label}
                  onChange={(event) => setWalkInForm((previous) => ({ ...previous, station_label: event.target.value }))}
                  placeholder="Opcional"
                />
              </label>
            </div>

            <label>
              <span>Motivo</span>
              <textarea
                rows="3"
                value={walkInForm.purpose}
                onChange={(event) => setWalkInForm((previous) => ({ ...previous, purpose: event.target.value }))}
                placeholder="Describe por que necesita entrar sin reserva previa."
                required
              />
            </label>

            <p className="reservation-inline-hint">
              {selectedWalkInLab
                ? Number(selectedWalkInLab.capacity || 0) > 0
                  ? `Capacidad del laboratorio: ${selectedWalkInLab.capacity}. Ocupacion actual: ${selectedWalkInLabOccupancy}. Cupos disponibles: ${selectedWalkInLabRemainingCapacity}.`
                  : 'Este laboratorio no tiene capacidad configurada; el sistema seguira validando disponibilidad horaria al guardar.'
                : 'Selecciona un laboratorio para ver su ocupacion actual antes de registrar el walk-in.'}
            </p>
            {!isWalkInChronologyValid ? (
              <p className="reservation-inline-hint">La hora estimada de salida debe ser mayor a la hora actual.</p>
            ) : null}
            {!isWalkInRequesterValid ? (
              <p className="reservation-inline-hint">Selecciona un usuario valido para evitar errores al guardar el walk-in.</p>
            ) : null}
            {selectedWalkInLab && Number(selectedWalkInLab.capacity || 0) > 0 && !isWalkInCapacityAvailable ? (
              <p className="reservation-inline-hint">No hay cupos disponibles para registrar un nuevo walk-in en este laboratorio.</p>
            ) : null}

            <div className="reservations-actions">
              <button type="submit" className="reservations-primary" disabled={!canManage || !isWalkInFormValid || isSavingWalkIn}>
                {isSavingWalkIn ? 'Registrando...' : 'Registrar walk-in'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeWorkspace === 'control-entradas-salidas' ? (
        <section className="reservations-panel reservations-panel-secondary">
          <div className="reservations-panel-header">
            <h3>Control de entradas y salidas del dia</h3>
            <p className="reservations-panel-subtitle">
              Desde aqui puedes pasar reservas aprobadas a En curso, completar salidas o marcar Ausente cuando hayan pasado 15 minutos del inicio.
            </p>
          </div>

          {actionableTodaysReservations.length === 0 ? (
            <p className="reservations-empty">No hay reservas de hoy que requieran accion en este momento.</p>
          ) : (
            <div className="reservation-card-grid">
              {actionableTodaysReservations.map((reservation) => {
                const absentEligible = reservation.status === 'approved' && minutesSinceStart(reservation) >= 15
                return (
                  <article key={reservation.id} className="reservation-user-card">
                    <div className="reservation-user-card-head">
                      <div>
                        <span className="reservation-user-card-kicker">{reservation.is_walk_in ? 'Walk-in' : 'Reserva'}</span>
                        <h4>{getReservationRequesterName(reservation)}</h4>
                      </div>
                      <span className={`reservations-status ${reservation.status}`}>{STATUS_LABELS[reservation.status] ?? reservation.status}</span>
                    </div>
                    <div className="reservation-user-card-meta">
                      <span>{getReservationLabLabel(reservation)}</span>
                      <span>{formatDate(reservation.date)} | {reservation.start_time} - {reservation.end_time}</span>
                      <span>Ingreso: {formatAccessTime(reservation.check_in_time || reservation.check_in_at)} | Salida: {formatAccessTime(reservation.check_out_time || reservation.check_out_at)}</span>
                      <span>Estacion: {reservation.station_label || 'Sin estacion'}</span>
                      <span>{reservation.purpose || 'Sin motivo registrado'}</span>
                    </div>
                    <div className="reservation-user-card-actions">
                      {reservation.status === 'approved' ? (
                        <button 
                          type="button" 
                          className="reservations-primary" 
                          disabled={actioningId === reservation.id}
                          onClick={() => handleRegisterEntry(reservation)}>
                          {actioningId === reservation.id ? 'Cargando...' : 'Registrar entrada'}
                        </button>
                      ) : null}
                      {reservation.status === 'in_progress' ? (
                        <button 
                          type="button" 
                          className="reservations-primary" 
                          disabled={actioningId === reservation.id}
                          onClick={() => handleRegisterExit(reservation.id)}>
                          {actioningId === reservation.id ? 'Cargando...' : 'Registrar salida'}
                        </button>
                      ) : null}
                      {absentEligible ? (
                        <button 
                          type="button" 
                          className="reservations-danger" 
                          disabled={actioningId === reservation.id}
                          onClick={() => handleMarkAbsent(reservation.id)}>
                          {actioningId === reservation.id ? 'Cargando...' : 'Marcar ausente'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {activeWorkspace === 'solicitudes-reserva' ? (
        <section className="reservations-panel reservations-panel-priority">
          <div className="reservations-panel-header">
            <h3>Solicitudes de reserva</h3>
            <p className="reservations-panel-subtitle">
              Usa esta vista para buscar, filtrar y editar reservas. Los filtros rapidos estan arriba y las opciones avanzadas quedan ocultas hasta que las necesites.
            </p>
          </div>

          <div className="reservations-filter-callout">
            <AlertCircle size={18} />
            <span>
              Estado, laboratorio y fecha ya se envian aparte para paginar mas rapido. El campo <b>where</b> queda solo para busquedas avanzadas.
            </span>
          </div>

          <form className="reservations-form" onSubmit={handleApplyTableFilters}>
            <div className="reservations-controls">
              <label>
                <span>Estado</span>
                <select
                  value={tableFilters.status}
                  onChange={(event) => setTableFilters((previous) => ({ ...previous, status: event.target.value }))}
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="approved">Aprobadas</option>
                  <option value="in_progress">En curso</option>
                  <option value="completed">Completadas</option>
                  <option value="absent">Ausentes</option>
                  <option value="rejected">Rechazadas</option>
                  <option value="cancelled">Canceladas</option>
                </select>
              </label>

              <label>
                <span>Laboratorio</span>
                <select
                  value={tableFilters.laboratory_id}
                  onChange={(event) => setTableFilters((previous) => ({ ...previous, laboratory_id: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {visibleLabs.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={tableFilters.date}
                  onChange={(event) => setTableFilters((previous) => ({ ...previous, date: event.target.value }))}
                />
              </label>
            </div>

            <details className="ux-extra-toggle">
              <summary>Opciones avanzadas de filtro</summary>
              <div className="ux-extra-toggle-content">
                <div className="reservations-controls">
                  <label>
                    <span>Ordenar por</span>
                    <select
                      value={tableFilters.sortBy}
                      onChange={(event) => setTableFilters((previous) => ({ ...previous, sortBy: event.target.value }))}
                    >
                      {TABLE_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Direccion</span>
                    <select
                      value={tableFilters.sortType}
                      onChange={(event) => setTableFilters((previous) => ({ ...previous, sortType: event.target.value }))}
                    >
                      <option value="DESC">DESC</option>
                      <option value="ASC">ASC</option>
                    </select>
                  </label>

                  <label>
                    <span>Tamano de pagina</span>
                    <select
                      value={tableFilters.pageSize}
                      onChange={(event) => setTableFilters((previous) => ({ ...previous, pageSize: Number(event.target.value) }))}
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span>Filtro avanzado where (opcional)</span>
                  <input
                    value={tableFilters.where}
                    onChange={(event) => setTableFilters((previous) => ({ ...previous, where: event.target.value }))}
                    placeholder="Ej. purpose~practica;status=approved;date>=2026-03-01"
                  />
                  <small className="reservation-inline-hint">
                    Este campo es opcional y solo se usa para busquedas avanzadas. Estado, laboratorio y fecha ya se envian aparte para paginar mas rapido.
                  </small>
                </label>

                <label>
                  <span>Ejemplos rapidos de where</span>
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) {
                        return
                      }
                      setTableFilters((previous) => ({ ...previous, where: event.target.value }))
                    }}
                  >
                    <option value="">Selecciona un ejemplo...</option>
                    {WHERE_EXAMPLES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>

            <div className="reservations-actions">
              <button type="submit" className="reservations-primary">Aplicar filtros</button>
              <button type="button" className="reservations-secondary" onClick={handleResetTableFilters}>
                Limpiar
              </button>
            </div>
          </form>

          <div className="reservations-table-meta">
            <span>
              Mostrando {visibleRangeStart}-{visibleRangeEnd} de {visibleTotalElements} reservas
            </span>
            <span>
              Pagina {tableMeta.totalPages === 0 ? 0 : tableMeta.pageNumber + 1} de {tableMeta.totalPages}
            </span>
            {tableMeta.totalElements > tableMeta.pageSize ? (
              <button
                type="button"
                className="reservations-secondary"
                onClick={() => {
                  const nextPageSize = Math.min(tableMeta.totalElements, 100)
                  setTableFilters((previous) => ({ ...previous, pageSize: nextPageSize }))
                  setTableQuery((previous) => ({ ...previous, pageSize: nextPageSize, pageNumber: 0 }))
                }}
              >
                Ver mas reservas
              </button>
            ) : null}
          </div>

          {tableLoading ? (
            <p className="reservations-empty">Cargando reservas...</p>
          ) : visibleTableReservations.length === 0 ? (
            <p className="reservations-empty">No hay reservas para este filtro.</p>
          ) : (
            <div className="reservations-table-wrap">
              <table className="reservations-table">
                <thead>
                  <tr>
                    <th>Laboratorio</th>
                    <th>Solicitante</th>
                    <th>Motivo</th>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTableReservations.map((item) => (
                    <tr key={item.id} className={`reservations-table-row status-${item.status}`}>
                      <td>
                        <strong>{getReservationLabLabel(item)}</strong>
                        <div>{item.purpose || 'Sin motivo registrado'}</div>
                      </td>
                      <td>
                        <strong>{getReservationRequesterName(item)}</strong>
                        <div>{getReservationRequesterEmail(item)}</div>
                      </td>
                      <td>
                        <strong>{item.purpose || 'Sin motivo registrado'}</strong>
                        <div>{item.is_walk_in ? 'Ingreso rapido' : 'Reserva programada'}</div>
                      </td>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.start_time} - {item.end_time}</td>
                      <td><span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span></td>
                      <td>
                        <div className="reservations-actions">
                          <button
                            type="button"
                            className="reservations-secondary"
                            disabled={!canManage || FINAL_RESERVATION_STATUSES.has(item.status)}
                            onClick={() => handleStartEdit(item)}
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="reservations-pagination">
            <button
              type="button"
              className="reservations-secondary"
              onClick={() => handleTablePageChange(tableMeta.pageNumber - 1)}
              disabled={tableMeta.pageNumber <= 0 || tableLoading}
            >
              Anterior
            </button>
            <button
              type="button"
              className="reservations-secondary"
              onClick={() => handleTablePageChange(tableMeta.pageNumber + 1)}
              disabled={tableLoading || tableMeta.totalPages === 0 || tableMeta.pageNumber >= tableMeta.totalPages - 1}
            >
              Siguiente
            </button>
          </div>
        </section>
      ) : null}

      {activeWorkspace === 'tutorias-pendientes' ? (
        <section className="reservations-panel reservations-panel-priority">
          <div className="reservations-panel-header">
            <h3>Tutorias pendientes de aprobacion</h3>
            <p className="reservations-panel-subtitle">
              Cuando un tutor publica una tutoria, el horario queda bloqueado hasta que tu la apruebes o rechaces.
              Si pidio materiales, decide cuales aceptas en la misma vista.
            </p>
          </div>

          {isLoadingPendingTutorials ? (
            <p className="reservations-empty">Cargando tutorias pendientes...</p>
          ) : pendingTutorials.length === 0 ? (
            <p className="reservations-empty">No hay tutorias pendientes de aprobacion.</p>
          ) : (
            <div className="reservations-table-wrap">
              {pendingTutorials.map((session) => {
                const supplies = tutorialSupplyMap[session.id] || []
                const selection = tutorialSupplySelection[session.id] || {}
                const isActioning = tutorialActionId === session.id
                const rejectionDraft = tutorialRejectionDrafts[session.id] || ''
                const labName = labNameById[String(session.laboratory_id)] || session.location || '-'

                return (
                  <article
                    key={session.id}
                    className="reservations-panel"
                    style={{ marginBottom: 16 }}
                  >
                    <div className="reservations-panel-header">
                      <h4>{session.topic}</h4>
                      <p className="reservations-panel-subtitle">
                        Tutor: <strong>{session.tutor_name || 'Sin asignar'}</strong>
                        {session.tutor_email ? ` (${session.tutor_email})` : ''}
                      </p>
                    </div>

                    <div className="reservations-controls">
                      <div>
                        <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>Laboratorio</span>
                        <strong>{labName}</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>Fecha</span>
                        <strong>{formatDate(session.session_date)}</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>Horario</span>
                        <strong>{session.start_time} - {session.end_time}</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>Cupos</span>
                        <strong>{session.max_students}</strong>
                      </div>
                    </div>

                    {session.description ? (
                      <p style={{ marginTop: 12 }}>{session.description}</p>
                    ) : null}

                    <div className="reservations-panel" style={{ marginTop: 12 }}>
                      <div className="reservations-panel-header">
                        <h5>Materiales solicitados</h5>
                        <p className="reservations-panel-subtitle">
                          Marca cuales aceptas. Los desmarcados se cancelaran cuando apruebes la tutoria.
                        </p>
                      </div>
                      {supplies.length === 0 ? (
                        <p className="reservations-empty">Esta tutoria no incluye materiales.</p>
                      ) : (
                        <table className="supplies-table">
                          <thead>
                            <tr>
                              <th>Aceptar</th>
                              <th>Reactivo</th>
                              <th>Cantidad</th>
                              <th>Disponible</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplies.map((supply) => {
                              const isPending = supply.status === 'pending'
                              const isChecked = isPending ? Boolean(selection[supply.id]) : false
                              return (
                                <tr key={supply.id}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={!isPending || isActioning}
                                      onChange={() => toggleTutorialSupply(session.id, supply.id)}
                                    />
                                  </td>
                                  <td><strong>{supply.stock_item_name || supply.stock_item_id}</strong></td>
                                  <td>{supply.quantity}</td>
                                  <td>{supply.quantity_available}</td>
                                  <td>
                                    <span className={`reservations-status ${supply.status}`}>
                                      {supply.status === 'pending' ? 'Pendiente'
                                        : supply.status === 'approved' ? 'Aprobada'
                                        : supply.status === 'delivered' ? 'Entregada'
                                        : supply.status === 'cancelled' ? 'Cancelada'
                                        : supply.status}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div className="reservations-actions">
                      <button
                        type="button"
                        className="reservations-primary"
                        disabled={isActioning || !canManage}
                        onClick={() => handleApproveTutorial(session)}
                      >
                        {isActioning ? 'Procesando...' : 'Aprobar tutoria'}
                      </button>
                    </div>

                    <label style={{ marginTop: 12, display: 'block' }}>
                      <span>Motivo de rechazo</span>
                      <textarea
                        rows="2"
                        value={rejectionDraft}
                        onChange={(event) => setTutorialRejectionDrafts((previous) => ({
                          ...previous,
                          [session.id]: event.target.value,
                        }))}
                        placeholder="Explica por que no puedes aprobar esta tutoria."
                      />
                    </label>
                    <div className="reservations-actions">
                      <button
                        type="button"
                        className="reservations-danger"
                        disabled={isActioning || !canManage || !rejectionDraft.trim()}
                        onClick={() => handleRejectTutorial(session)}
                      >
                        Rechazar tutoria
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      <ReservationEditModal
        reservation={editingReservation}
        labs={labs}
        form={draft}
        slots={[]}
        selectedSlotKey=""
        isLoadingSlots={false}
        minDate=""
        maxDate=""
        validationMessage={editValidationMessage}
        onSelectSlot={() => {}}
        getSlotKey={() => ''}
        getSlotTone={() => 'available'}
        getSlotLabel={() => ''}
        isSlotSelectable={() => false}
        onChange={(field, value) => setDraft((previous) => ({ ...previous, [field]: value }))}
        onSubmit={handleSaveEdit}
        onClose={handleCancelEdit}
        isSubmitting={isSavingEdit}
        slotPickerEnabled={false}
        title="Editar reserva del laboratorio"
        description="Ajusta laboratorio, fecha, horario y motivo desde esta ventana emergente. Al guardar, la tabla se actualiza automaticamente."
        primaryActionLabel="Guardar reserva"
        extraActions={editingReservation ? (
          <>
            <div className="reservations-panel" style={{ marginBottom: 12 }}>
              <div className="reservations-panel-header">
                <h4>Reactivos solicitados</h4>
                <p className="reservations-panel-subtitle">
                  Estos materiales se aprobaran o cancelaran en cascada cuando cambies el estado de la reserva.
                </p>
              </div>
              {isLoadingLinkedSupplies ? (
                <p className="reservations-empty">Cargando reactivos vinculados...</p>
              ) : linkedSupplyReservations.length === 0 ? (
                <p className="reservations-empty">Esta reserva no incluye reactivos.</p>
              ) : (
                <table className="supplies-table">
                  <thead>
                    <tr>
                      <th>Reactivo</th>
                      <th>Cantidad</th>
                      <th>Disponible</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedSupplyReservations.map((supply) => (
                      <tr key={supply.id}>
                        <td><strong>{supply.stock_item_name || supply.stock_item_id}</strong></td>
                        <td>{supply.quantity}</td>
                        <td>{supply.quantity_available}</td>
                        <td>
                          <span className={`reservations-status ${supply.status}`}>
                            {supply.status === 'pending' ? 'Pendiente'
                              : supply.status === 'approved' ? 'Aprobada'
                              : supply.status === 'delivered' ? 'Entregada'
                              : supply.status === 'cancelled' ? 'Cancelada'
                              : supply.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {(canApproveFromModal || canRejectFromModal || canCancelFromModal || canRegisterEntryFromModal || canRegisterExitFromModal || canMarkAbsentFromModal) ? (
              <div className="reservations-actions">
                {canApproveFromModal ? (
                  <button type="button" className="reservations-primary" disabled={isProcessingReservationAction} onClick={() => handleReservationModalAction('approve')}>
                    Aceptar
                  </button>
                ) : null}
                {canCancelFromModal ? (
                  <button type="button" className="reservations-secondary" disabled={isProcessingReservationAction} onClick={() => handleReservationModalAction('cancel')}>
                    Cancelar reserva
                  </button>
                ) : null}
                {canRegisterEntryFromModal ? (
                  <button type="button" className="reservations-primary" disabled={isProcessingReservationAction} onClick={() => handleReservationModalAction('entry')}>
                    Registrar entrada
                  </button>
                ) : null}
                {canRegisterExitFromModal ? (
                  <button type="button" className="reservations-primary" disabled={isProcessingReservationAction} onClick={() => handleReservationModalAction('exit')}>
                    Registrar salida
                  </button>
                ) : null}
                {canMarkAbsentFromModal ? (
                  <button type="button" className="reservations-danger" disabled={isProcessingReservationAction} onClick={() => handleReservationModalAction('absent')}>
                    Marcar ausente
                  </button>
                ) : null}
                {canRejectFromModal ? (
                  <button type="button" className="reservations-danger" disabled={isProcessingReservationAction} onClick={() => setIsRejectingReservation((previous) => !previous)}>
                    {isRejectingReservation ? 'Ocultar rechazo' : 'Rechazar'}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="reservation-inline-hint">Esta reserva ya no admite acciones operativas adicionales.</p>
            )}

            {canRejectFromModal && isRejectingReservation ? (
              <label>
                <span>Motivo de rechazo</span>
                <textarea
                  rows="3"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Explica por que esta solicitud no puede aprobarse."
                />
              </label>
            ) : null}

            {canRejectFromModal && isRejectingReservation ? (
              <div className="reservations-actions">
                <button type="button" className="reservations-secondary" disabled={isProcessingReservationAction} onClick={() => setIsRejectingReservation(false)}>
                  Volver
                </button>
                <button type="button" className="reservations-danger" disabled={isProcessingReservationAction || !rejectionReason.trim()} onClick={() => handleReservationModalAction('reject')}>
                  Rechazar
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      />
    </section>
  )
}

export default AdminReservationsPage

