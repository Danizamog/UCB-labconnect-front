import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import LabPicker from './LabPicker'
import { getTutorialSessionById } from '../../tutorials/services/tutorialSessionsService'
import { openTutorialSessionFlow } from '../../tutorials/utils/focusTutorialNavigation'

const TutorialSessionDetailModal = lazy(() => import('../../tutorials/pages/TutorialSessionDetailModal'))
const ReservationDetailModal = lazy(() => import('./ReservationDetailModal'))
const ReservationEditModal = lazy(() => import('./ReservationEditModal'))
import {
  createReservation,
  createSupplyReservation,
  deleteReservation,
  getReservationById,
  getLabAvailability,
  getMyAgendaSummary,
  isLabAccessibleToUser,
  listAvailableLabs,
  listMyPenalties,
  listMyReservations,
  prefetchLabAvailability,
  subscribeReservationsRealtime,
  updateReservation,
  applyRealtimeRecordPatch,
  mapReservationRecord,
} from '../services/reservationsService'
import { normalizeCategory } from '../../admin/services/infrastructureService'
import TeacherPickerModal from './TeacherPickerModal'
import MaterialPickerModal from './MaterialPickerModal'
import './ReservationsPages.css'

const MIN_PURPOSE_LENGTH = 5
const CLOCK_REFRESH_MS = 30 * 1000
const RESERVATIONS_PAGE_SIZE = 6

function todayLocalDateString() {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultForm(overrides = {}) {
  return {
    laboratory_id: '',
    date: todayLocalDateString(),
    start_time: '',
    end_time: '',
    purpose: '',
    project_description: '',
    responsible_teacher: '',
    responsible_teacher_name: '',
    requires_full_lab: false,
    requested_materials: [],
    ...overrides,
  }
}

function maxReservableDateString() {
  const value = new Date()
  const currentDay = value.getDate()
  const targetMonth = value.getMonth() + 1
  const targetYear = value.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = targetMonth % 12
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const year = targetYear
  const month = String(normalizedMonth + 1).padStart(2, '0')
  const day = String(Math.min(currentDay, lastDayOfTargetMonth)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' }
const FOCUSED_RESERVATION_KEY = 'labconnect.focus_reservation_id'
const OPEN_RESERVATION_EVENT = 'labconnect:open-reservation-details'
const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const HISTORY_STATUSES = new Set(['rejected', 'cancelled', 'completed', 'absent'])

function getTutorialPrimaryAction(session, userId) {
  const normalizedUserId = String(userId || '')
  const isOwnTutorial = session?.tutor_id === normalizedUserId
  const isEnrolled = Array.isArray(session?.enrolled_students)
    ? session.enrolled_students.some((student) => student.student_id === normalizedUserId)
    : false
  const isFull = Number(session?.seats_left || 0) <= 0

  if (isOwnTutorial) {
    return {
      label: 'Ver en Tutorias',
      hint: 'Abriremos la cartelera de tutorias con esta sesion destacada para que la revises con mas detalle.',
    }
  }

  if (isEnrolled) {
    return {
      label: 'Ver mi inscripcion',
      hint: 'Te llevaremos a la cartelera de tutorias para revisar esta sesion destacada.',
    }
  }

  if (isFull) {
    return {
      label: 'Ver en Tutorias',
      hint: 'Esta sesion ya no tiene cupos, pero puedes revisar su detalle completo desde la cartelera de tutorias.',
    }
  }

  return {
    label: 'Inscribirme',
    hint: 'Te llevaremos a la cartelera de tutorias con esta sesion destacada para completar tu inscripcion.',
  }
}

function formatNotificationDateTime(value) {
  if (!value) {
    return ''
  }

  const normalized = String(value).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function buildReservationStart(reservation) {
  return new Date(`${reservation.date}T${reservation.start_time}:00`)
}

function isDateBeforeToday(value) {
  return Boolean(value) && value < todayLocalDateString()
}

function isDateBeyondReservationLimit(value) {
  return Boolean(value) && value > maxReservableDateString()
}

function buildLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return null
  }

  const [year, month, day] = String(dateValue).split('-').map(Number)
  const [hour, minute] = String(timeValue).split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function buildPrefetchDays(dateValue, count = 7) {
  const start = new Date(`${dateValue || todayLocalDateString()}T00:00:00`)
  if (Number.isNaN(start.getTime())) {
    return []
  }

  const days = []
  for (let index = 0; index < count; index += 1) {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    days.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`)
  }
  return days
}

function isPastSlotForDate(slot, dateValue, referenceNow = new Date()) {
  const slotStart = buildLocalDateTime(dateValue, slot?.start_time)
  if (!slotStart) {
    return false
  }
  return slotStart.getTime() <= referenceNow.getTime()
}

function compareReservationsByStart(a, b) {
  return buildReservationStart(a).getTime() - buildReservationStart(b).getTime()
}

function getReservationActionState(reservation) {
  const startsAt = buildReservationStart(reservation)
  if (Number.isNaN(startsAt.getTime())) {
    return {
      hasStarted: true,
      withinTwoHours: false,
      canModify: false,
      canCancel: false,
    }
  }

  const diffMs = startsAt.getTime() - Date.now()
  const hasStarted = diffMs <= 0
  const withinTwoHours = diffMs > 0 && diffMs < TWO_HOURS_MS
  const isMutableStatus = reservation.status === 'pending' || reservation.status === 'approved'
  const modificationLimitReached = Number(reservation.user_modification_count || 0) >= 1

  return {
    hasStarted,
    withinTwoHours,
    modificationLimitReached,
    canModify: isMutableStatus && !hasStarted && !withinTwoHours && !modificationLimitReached,
    canCancel: isMutableStatus && !hasStarted,
  }
}

function getSlotKey(slot) {
  return `${slot.start_time}-${slot.end_time}`
}

function getSlotTone(slot) {
  if (slot.source === 'tutorial_session') {
    return 'tutorial'
  }

  if (slot.source === 'class') {
    return 'class'
  }

  if (slot.state === 'blocked' && slot.status === 'past') {
    return 'past'
  }

  if (slot.state === 'blocked' && slot.status === 'maintenance') {
    return 'maintenance'
  }

  if (slot.state === 'blocked') {
    return 'blocked-other'
  }

  if (slot.state === 'partial') {
    return 'shared'
  }

  if (slot.state === 'occupied') {
    return 'busy'
  }

  return 'available'
}

function getSlotLabel(slot) {
  if (slot.source === 'tutorial_session') {
    return 'Tutoria'
  }

  if (slot.source === 'class') {
    return slot.status ? `Clase: ${slot.status}` : 'Clase'
  }

  if (slot.state === 'blocked' && slot.status === 'past') {
    return 'Hora pasada'
  }

  if (slot.state === 'blocked' && slot.status === 'maintenance') {
    return 'Mantenimiento'
  }

  if (slot.state === 'blocked') {
    return 'Bloqueado'
  }

  if (slot.state === 'partial') {
    return 'Compartido'
  }

  if (slot.state === 'occupied') {
    return 'Ocupado'
  }

  return 'Disponible'
}

function isCreatableSlot(slot, requiresFullLab = false) {
  if (!slot) {
    return false
  }
  if (slot.state === 'available') {
    return true
  }
  // Un bloque 'partial' tiene reservas compartidas aprobadas: aun se puede sumar otra
  // reserva compartida, pero no una que necesite todo el laboratorio.
  if (slot.state === 'partial') {
    return !requiresFullLab
  }
  return false
}

function UserReserveLabPage({ user, notifications = [], onMarkNotificationAsRead }) {
  const [labs, setLabs] = useState([])
  const [reservations, setReservations] = useState([])
  const [penalties, setPenalties] = useState([])
  const [slots, setSlots] = useState([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [form, setForm] = useState(() => createDefaultForm())
  const [editingReservation, setEditingReservation] = useState(null)
  const [editForm, setEditForm] = useState(() => createDefaultForm())
  const [editSlots, setEditSlots] = useState([])
  const [isLoadingEditSlots, setIsLoadingEditSlots] = useState(false)
  const [editSelectedSlotKey, setEditSelectedSlotKey] = useState('')
  const [focusedReservationId, setFocusedReservationId] = useState('')
  const [isReservationDetailOpen, setIsReservationDetailOpen] = useState(false)
  const [focusedReservationDetails, setFocusedReservationDetails] = useState(null)
  const [isLoadingReservationDetails, setIsLoadingReservationDetails] = useState(false)
  const [reservationToCancel, setReservationToCancel] = useState(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const selectedSlotKeyRef = useRef('')
  const requiresFullLabRef = useRef(false)
  const availabilityRefreshRef = useRef(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false)
  const [focusedTutorial, setFocusedTutorial] = useState(null)
  const [upcomingPage, setUpcomingPage] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false)
  const [materialPicker, setMaterialPicker] = useState(null) // null | 'reactivos' | 'materiales'

  const setRequestedMaterials = useCallback((next) => {
    setForm((prev) => ({ ...prev, requested_materials: typeof next === 'function' ? next(prev.requested_materials) : next }))
  }, [])

  const updateMaterialQuantity = useCallback((stockItemId, value) => {
    setForm((prev) => ({
      ...prev,
      requested_materials: prev.requested_materials.map((entry) =>
        String(entry.stock_item_id) === String(stockItemId) ? { ...entry, quantity: value } : entry,
      ),
    }))
  }, [])

  const removeSelectedMaterial = useCallback((stockItemId) => {
    setForm((prev) => ({
      ...prev,
      requested_materials: prev.requested_materials.filter((entry) => String(entry.stock_item_id) !== String(stockItemId)),
    }))
  }, [])

  const renderSelectedMaterials = (entries) => (
    <ul className="reservation-materials-list">
      {entries.map((entry) => {
        const stock = Number(entry.quantity_available || 0)
        const limit = Number(entry.limite_reserva_usuario || 0)
        const effectiveMax = limit > 0 ? Math.min(stock, limit) : stock
        return (
          <li key={entry.stock_item_id} className="reservation-material-row">
            <div className="reservation-material-row-info">
              <strong>{entry.name || entry.stock_item_id}</strong>
              <span>
                {stock} {entry.unit || ''} disp.{limit > 0 ? ` (máx ${limit})` : ''}
              </span>
            </div>
            <input
              type="number"
              min="1"
              max={Math.max(effectiveMax, 1)}
              value={entry.quantity}
              onChange={(event) => {
                let value = Math.max(1, Number(event.target.value) || 1)
                if (effectiveMax > 0) value = Math.min(value, effectiveMax)
                updateMaterialQuantity(entry.stock_item_id, value)
              }}
            />
            <button type="button" className="reservations-secondary" onClick={() => removeSelectedMaterial(entry.stock_item_id)}>
              Quitar
            </button>
          </li>
        )
      })}
    </ul>
  )
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const todayIso = todayLocalDateString()
  const maxReservationIso = maxReservableDateString()
  const [clockTick, setClockTick] = useState(Date.now())
  const nowReference = useMemo(() => new Date(clockTick), [clockTick])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, CLOCK_REFRESH_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    selectedSlotKeyRef.current = selectedSlotKey
  }, [selectedSlotKey])

  useEffect(() => {
    requiresFullLabRef.current = Boolean(form.requires_full_lab)
  }, [form.requires_full_lab])

  const loadLabs = useCallback(async () => {
    try {
      const labsData = await listAvailableLabs(user)
      setLabs(labsData)
      setForm((prev) => (
        prev.laboratory_id || labsData.length === 0
          ? prev
          : { ...prev, laboratory_id: labsData[0].id }
      ))
      if (labsData.length === 0) {
        setError('No tienes permisos para reservar en los laboratorios disponibles actualmente.')
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion de laboratorios.')
    }
  }, [user])

  const loadReservations = useCallback(async () => {
    try {
      const reservationsData = await listMyReservations()
      setReservations(Array.isArray(reservationsData) ? reservationsData : [])
    } catch {
      // no critico para el render inicial; el paint rapido viene del summary
    }
  }, [])

  const loadUpcomingSummary = useCallback(async () => {
    try {
      const summary = await getMyAgendaSummary({ limit: 12 })
      const upcoming = Array.isArray(summary?.upcoming_reservations) ? summary.upcoming_reservations : []
      // Solo poblar si todavia no llego la lista completa (evita pisar datos mas frescos).
      setReservations((prev) => (prev.length > 0 ? prev : upcoming))
    } catch {
      // ignorar; loadReservations completara la informacion
    }
  }, [])

  const loadPenaltiesOnly = useCallback(async () => {
    try {
      const penaltiesData = await listMyPenalties()
      setPenalties(Array.isArray(penaltiesData) ? penaltiesData : [])
    } catch {
      // ignore — el banner de penalizacion no es critico para el flujo
    }
  }, [])

  const refreshAllData = useCallback(async () => {
    await Promise.all([loadLabs(), loadReservations(), loadPenaltiesOnly()])
  }, [loadLabs, loadReservations, loadPenaltiesOnly])

  // Carga inicial: cada recurso en su propio efecto para que ninguno bloquee al otro.
  useEffect(() => {
    loadLabs()
  }, [loadLabs])

  useEffect(() => {
    // Paint rapido del panel "Mis reservas futuras" con payload chico.
    loadUpcomingSummary()
  }, [loadUpcomingSummary])

  useEffect(() => {
    // Lista completa para el historial; corre en paralelo sin bloquear labs.
    loadReservations()
  }, [loadReservations])

  useEffect(() => {
    loadPenaltiesOnly()
  }, [loadPenaltiesOnly])

  // Refs estables para evitar re-suscribirse al realtime cada vez que cambia
  // la referencia de los callbacks o de `user`. La suscripcion debe vivir
  // mientras el componente este montado.
  const userIdRef = useRef(String(user?.user_id || ''))
  const refreshAllDataRef = useRef(refreshAllData)
  const loadPenaltiesOnlyRef = useRef(loadPenaltiesOnly)

  useEffect(() => {
    userIdRef.current = String(user?.user_id || '')
  }, [user?.user_id])

  useEffect(() => {
    refreshAllDataRef.current = refreshAllData
  }, [refreshAllData])

  useEffect(() => {
    loadPenaltiesOnlyRef.current = loadPenaltiesOnly
  }, [loadPenaltiesOnly])

  useEffect(() => {
    const unsubscribe = subscribeReservationsRealtime((event) => {
      const currentUserId = userIdRef.current

      if (event?.topic === 'lab_reservation') {
        const requestedBy = String(event?.record?.requested_by || '')
        if (currentUserId && requestedBy && requestedBy === currentUserId) {
          setReservations((prev) => applyRealtimeRecordPatch(prev, event, { mapper: mapReservationRecord }))
        }
        availabilityRefreshRef.current?.()
        return
      }

      if (event?.topic === 'user_penalty') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserPenalty =
          event?.record?.user_id === currentUserId ||
          recipients.includes(currentUserId)

        if (isCurrentUserPenalty) {
          loadPenaltiesOnlyRef.current?.()
          setMessage('Tu estado de penalizacion fue actualizado.')
        }
        return
      }

      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === currentUserId ||
          recipients.includes(currentUserId)

        if (isCurrentUserNotification) {
          setMessage('Tienes una nueva notificacion relacionada con tus reservas o tutorias.')
        }
      }
    }, {
      topics: ['lab_reservation', 'user_penalty', 'user_notification'],
      onResync: () => {
        refreshAllDataRef.current?.()
        availabilityRefreshRef.current?.()
      },
    })

    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    const applyFocus = (reservationId) => {
      const normalizedId = String(reservationId || '').trim()
      if (!normalizedId) {
        return
      }
      setFocusedReservationId(normalizedId)
      setIsReservationDetailOpen(true)
      localStorage.removeItem(FOCUSED_RESERVATION_KEY)
    }

    const storedReservationId = localStorage.getItem(FOCUSED_RESERVATION_KEY)
    if (storedReservationId) {
      applyFocus(storedReservationId)
    }

    const handleOpenReservation = (event) => {
      applyFocus(event?.detail?.reservationId)
    }

    window.addEventListener(OPEN_RESERVATION_EVENT, handleOpenReservation)
    return () => {
      window.removeEventListener(OPEN_RESERVATION_EVENT, handleOpenReservation)
    }
  }, [])

  const selectedLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(form.laboratory_id)) || null,
    [form.laboratory_id, labs],
  )

  const selectedLabIsAccessible = useMemo(
    () => (selectedLab ? isLabAccessibleToUser(selectedLab, user) : false),
    [selectedLab, user],
  )

  useEffect(() => {
    let mounted = true

    const loadAvailability = async ({ skipCache = false } = {}) => {
      if (!form.laboratory_id || !form.date || !selectedLabIsAccessible) {
        if (mounted) {
          setSlots([])
          setSelectedSlotKey('')
        }
        return
      }

      setIsLoadingSlots(true)
      try {
        const payload = await getLabAvailability(form.laboratory_id, form.date, { skipCache })
        if (!mounted) {
          return
        }

        const nextSlots = Array.isArray(payload?.slots) ? payload.slots : []
        setSlots(nextSlots)

        const currentFormKey = selectedSlotKeyRef.current
        const matchingAvailableSlot = nextSlots.find(
          (slot) => getSlotKey(slot) === currentFormKey && isCreatableSlot(slot, requiresFullLabRef.current),
        )

        if (matchingAvailableSlot) {
          setSelectedSlotKey(getSlotKey(matchingAvailableSlot))
        } else {
          setSelectedSlotKey('')
          setForm((previous) => ({
            ...previous,
            start_time: '',
            end_time: '',
          }))
        }
      } catch (err) {
        if (mounted) {
          setSlots([])
          setSelectedSlotKey('')
          setError(err.message || 'No se pudo cargar los bloques disponibles del laboratorio.')
        }
      } finally {
        if (mounted) {
          setIsLoadingSlots(false)
        }
      }
    }

    // Exponer un refetch forzado (skipCache) para que el handler realtime
    // invalide solo cuando llegue un evento, en lugar de hacer skipCache
    // permanente en todos los cambios de lab/fecha.
    availabilityRefreshRef.current = () => loadAvailability({ skipCache: true })

    loadAvailability()
    return () => {
      mounted = false
      availabilityRefreshRef.current = null
    }
  }, [form.date, form.laboratory_id, selectedLabIsAccessible])

  useEffect(() => {
    if (!form.laboratory_id || !form.date || !selectedLabIsAccessible) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      prefetchLabAvailability(form.laboratory_id, buildPrefetchDays(form.date, 7))
    }, 150)

    return () => window.clearTimeout(timer)
  }, [form.date, form.laboratory_id, selectedLabIsAccessible])

  // Los materiales ahora son globales (catalogo compartido): se eligen desde
  // MaterialPickerModal, ya no dependen del laboratorio seleccionado.

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )

  const handleLabSelect = useCallback((labId) => {
    setForm((previous) => {
      if (String(previous.laboratory_id || '') === String(labId || '')) {
        return previous
      }
      return {
        ...previous,
        laboratory_id: labId,
        start_time: '',
        end_time: '',
        requested_materials: [],
      }
    })
    setSelectedSlotKey('')
  }, [])

  const selectedSlot = useMemo(
    () => slots.find((slot) => getSlotKey(slot) === selectedSlotKey) || null,
    [selectedSlotKey, slots],
  )

  const selectedSlotIsValid = Boolean(
    selectedSlot &&
    isCreatableSlot(selectedSlot, form.requires_full_lab) &&
    !isPastSlotForDate(selectedSlot, form.date, nowReference),
  )

  const activePenalty = useMemo(
    () => penalties.find((penalty) => penalty.is_active) || null,
    [penalties],
  )

  const canSubmitReservation = Boolean(
    selectedLab &&
    selectedLabIsAccessible &&
    !activePenalty &&
    selectedSlotIsValid &&
    !isDateBeforeToday(form.date) &&
    !isDateBeyondReservationLimit(form.date) &&
    form.purpose.trim().length >= MIN_PURPOSE_LENGTH,
  )

  const createValidationMessage = useMemo(() => {
    if (!selectedLab) {
      return 'Debes seleccionar un laboratorio antes de reservar.'
    }
    if (isDateBeforeToday(form.date)) {
      return 'No puedes registrar reservas en fechas anteriores a hoy.'
    }
    if (isDateBeyondReservationLimit(form.date)) {
      return 'Solo puedes registrar reservas con un maximo de un mes de anticipacion.'
    }
    if (!selectedLabIsAccessible) {
      return 'No tienes permisos para reservar este laboratorio.'
    }
    if (activePenalty) {
      return `Tu cuenta esta suspendida temporalmente. Motivo: ${activePenalty.reason}`
    }
    if (selectedSlot && selectedSlot.state === 'partial' && form.requires_full_lab) {
      return 'Ese bloque ya tiene una reserva compartida aprobada; no puedes tomarlo en uso exclusivo. Elige otro horario o marca "Compartir el laboratorio".'
    }
    if (!selectedSlot || !isCreatableSlot(selectedSlot, form.requires_full_lab)) {
      return 'Debes seleccionar un bloque horario disponible del laboratorio.'
    }
    if (isPastSlotForDate(selectedSlot, form.date, nowReference)) {
      return 'No puedes reservar bloques horarios que ya empezaron o ya transcurrieron.'
    }
    if (form.purpose.trim().length < MIN_PURPOSE_LENGTH) {
      return `El motivo debe tener al menos ${MIN_PURPOSE_LENGTH} caracteres.`
    }
    return ''
  }, [activePenalty, form.date, form.purpose, form.requires_full_lab, nowReference, selectedLab, selectedLabIsAccessible, selectedSlot])

  const myReservations = useMemo(
    () =>
      reservations
        .filter((item) => item.requested_by === (user?.user_id || ''))
        .sort(compareReservationsByStart),
    [reservations, user],
  )

  const upcomingReservations = useMemo(
    () => myReservations.filter((item) => !HISTORY_STATUSES.has(item.status) && !getReservationActionState(item).hasStarted),
    [myReservations],
  )

  const reservationHistory = useMemo(
    () => myReservations.filter((item) => HISTORY_STATUSES.has(item.status) || getReservationActionState(item).hasStarted).reverse(),
    [myReservations],
  )

  const upcomingTotalPages = Math.max(1, Math.ceil(upcomingReservations.length / RESERVATIONS_PAGE_SIZE))
  const historyTotalPages = Math.max(1, Math.ceil(reservationHistory.length / RESERVATIONS_PAGE_SIZE))

  useEffect(() => {
    if (upcomingPage >= upcomingTotalPages) {
      setUpcomingPage(0)
    }
  }, [upcomingPage, upcomingTotalPages])

  useEffect(() => {
    if (historyPage >= historyTotalPages) {
      setHistoryPage(0)
    }
  }, [historyPage, historyTotalPages])

  const paginatedUpcoming = useMemo(() => {
    const start = upcomingPage * RESERVATIONS_PAGE_SIZE
    return upcomingReservations.slice(start, start + RESERVATIONS_PAGE_SIZE)
  }, [upcomingPage, upcomingReservations])

  const paginatedHistory = useMemo(() => {
    const start = historyPage * RESERVATIONS_PAGE_SIZE
    return reservationHistory.slice(start, start + RESERVATIONS_PAGE_SIZE)
  }, [historyPage, reservationHistory])

  const focusedReservation = useMemo(
    () => {
      if (focusedReservationDetails?.id === focusedReservationId) {
        return focusedReservationDetails
      }
      return myReservations.find((item) => item.id === focusedReservationId) || null
    },
    [focusedReservationDetails, focusedReservationId, myReservations],
  )

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  )

  useEffect(() => {
    if (!focusedReservationId || !isReservationDetailOpen) {
      setFocusedReservationDetails(null)
      setIsLoadingReservationDetails(false)
      return
    }

    const localReservation = myReservations.find((item) => item.id === focusedReservationId)
    if (!localReservation) {
      setFocusedReservationId('')
      setFocusedReservationDetails(null)
      setIsLoadingReservationDetails(false)
    }
  }, [focusedReservationId, isReservationDetailOpen, myReservations])

  useEffect(() => {
    if (!message && !error) {
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [message, error])

  useEffect(() => {
    if (!focusedReservationId || !isReservationDetailOpen) {
      return
    }

    if (focusedReservationDetails?.id === focusedReservationId) {
      return
    }

    let isMounted = true
    setIsLoadingReservationDetails(true)

    getReservationById(focusedReservationId)
      .then((reservation) => {
        if (isMounted) {
          setFocusedReservationDetails(reservation)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'No se pudo cargar el detalle actualizado de la reserva.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingReservationDetails(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [focusedReservationDetails?.id, focusedReservationId, isReservationDetailOpen])

  const selectedEditLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(editForm.laboratory_id)) || null,
    [editForm.laboratory_id, labs],
  )

  const isEditSlotSelectable = useCallback((slot) => {
    if (isPastSlotForDate(slot, editForm.date, nowReference)) {
      return false
    }

    // La reserva puede seguir en su propio bloque, y puede moverse a uno 'partial'
    // (compartido) solo si ella misma no requiere el laboratorio completo.
    return (
      isCreatableSlot(slot, Boolean(editingReservation?.requires_full_lab)) ||
      (editingReservation && slot.source === 'lab_reservation' && slot.source_id === editingReservation.id)
    )
  }, [editForm.date, editingReservation, nowReference])

  const getEditSlotTone = useCallback((slot) => {
    if (isPastSlotForDate(slot, editForm.date, nowReference)) {
      return 'past'
    }
    return getSlotTone(slot)
  }, [editForm.date, nowReference])

  const getEditSlotDisabledHint = useCallback((slot) => {
    if (isPastSlotForDate(slot, editForm.date, nowReference)) {
      return 'Esta hora ya paso y no se puede usar para reprogramar.'
    }
    if (slot?.source === 'class') {
      return slot.status ? `Bloque ocupado por la clase: ${slot.status}` : 'Bloque ocupado por una clase recurrente.'
    }
    if (slot?.state === 'partial') {
      return 'Este bloque tiene una reserva compartida aprobada; solo puedes usarlo si tu reserva no es de uso exclusivo.'
    }
    if (slot?.state === 'occupied') {
      return 'Este bloque ya esta ocupado.'
    }
    if (slot?.state === 'blocked') {
      return 'Este bloque no esta disponible.'
    }
    return 'Este bloque no se puede seleccionar.'
  }, [editForm.date, nowReference])

  useEffect(() => {
    if (!editingReservation) {
      setEditSlots([])
      setEditSelectedSlotKey('')
      setIsLoadingEditSlots(false)
      return
    }

    if (!editForm.laboratory_id || !editForm.date || isDateBeforeToday(editForm.date)) {
      setEditSlots([])
      setEditSelectedSlotKey('')
      return
    }

    let mounted = true
    setIsLoadingEditSlots(true)

    getLabAvailability(editForm.laboratory_id, editForm.date)
      .then((payload) => {
        if (!mounted) {
          return
        }

        const nextSlots = Array.isArray(payload?.slots) ? payload.slots : []
        setEditSlots(nextSlots)

        const currentKey = `${editForm.start_time}-${editForm.end_time}`
        const matchingSlot = nextSlots.find((slot) => getSlotKey(slot) === currentKey && isEditSlotSelectable(slot))
        if (matchingSlot) {
          setEditSelectedSlotKey(getSlotKey(matchingSlot))
        } else {
          setEditSelectedSlotKey('')
          setEditForm((previous) => ({
            ...previous,
            start_time: '',
            end_time: '',
          }))
        }
      })
      .catch((err) => {
        if (mounted) {
          setEditSlots([])
          setEditSelectedSlotKey('')
          setError(err.message || 'No se pudieron cargar los bloques validos para editar la reserva.')
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingEditSlots(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [editingReservation, editForm.date, editForm.end_time, editForm.laboratory_id, editForm.start_time, isEditSlotSelectable])

  const selectedEditSlot = useMemo(
    () => editSlots.find((slot) => getSlotKey(slot) === editSelectedSlotKey) || null,
    [editSelectedSlotKey, editSlots],
  )

  const editValidationMessage = useMemo(() => {
    if (!editingReservation) {
      return ''
    }
    if (!selectedEditLab) {
      return 'Debes seleccionar un laboratorio valido.'
    }
    if (!isLabAccessibleToUser(selectedEditLab, user)) {
      return 'No tienes permisos para mover la reserva a este laboratorio.'
    }
    if (isDateBeforeToday(editForm.date)) {
      return 'No puedes mover una reserva a una fecha anterior a hoy.'
    }
    if (isDateBeyondReservationLimit(editForm.date)) {
      return 'Solo puedes mover reservas dentro del plazo maximo de un mes.'
    }
    if (!selectedEditSlot || !isEditSlotSelectable(selectedEditSlot)) {
      return 'Debes elegir un bloque valido del laboratorio para guardar los cambios.'
    }
    if (isPastSlotForDate(selectedEditSlot, editForm.date, nowReference)) {
      return 'No puedes guardar una reserva en un bloque que ya empezo o ya transcurrio.'
    }
    if (editForm.purpose.trim().length < MIN_PURPOSE_LENGTH) {
      return `El motivo debe tener al menos ${MIN_PURPOSE_LENGTH} caracteres.`
    }
    return ''
  }, [editForm.date, editForm.purpose, editingReservation, isEditSlotSelectable, nowReference, selectedEditLab, selectedEditSlot, user])

  const handleOpenReservationDetails = async (reservation) => {
    const nextReservation = reservation || null
    const reservationId = String(nextReservation?.id || '').trim()
    if (!reservationId) {
      return
    }

    setFocusedReservationId(reservationId)
    setIsReservationDetailOpen(true)
    setFocusedReservationDetails(nextReservation)
    setIsLoadingReservationDetails(true)
    setError('')
    setMessage('')

    try {
      const freshReservation = await getReservationById(reservationId)
      setFocusedReservationDetails(freshReservation)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle actualizado de la reserva.')
    } finally {
      setIsLoadingReservationDetails(false)
    }
  }

  const handleOpenTutorialDetails = async (sessionId) => {
    if (!sessionId) {
      return
    }

    try {
      const tutorial = await getTutorialSessionById(sessionId)
      setFocusedTutorial(tutorial)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle de la tutoria.')
    }
  }

  const handleCloseReservationDetails = () => {
    setIsReservationDetailOpen(false)
    setFocusedReservationDetails(null)
    setIsLoadingReservationDetails(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmittingReservation) {
      return
    }
    setError('')
    setMessage('')

    if (!selectedLabIsAccessible) {
      setError('No tienes permisos para reservar este laboratorio.')
      return
    }

    if (createValidationMessage) {
      setError(createValidationMessage)
      return
    }

    setIsSubmittingReservation(true)
    try {
      const requestedMaterials = (form.requested_materials || []).filter((entry) => (
        entry?.stock_item_id && Number(entry.quantity) > 0
      ))

      const { requested_materials: _omitMaterials, ...formForBackend } = form
      const createdReservation = await createReservation(
        {
          ...formForBackend,
          laboratory_name: selectedLab?.name || '',
          area_id: selectedLab?.area_id || '',
          area_name: selectedLab?.area_name || '',
        },
        user,
      )

      let materialMessage = ''
      if (requestedMaterials.length > 0) {
        const results = await Promise.allSettled(requestedMaterials.map((entry) => (
          createSupplyReservation({
            stock_item_id: entry.stock_item_id,
            quantity: Number(entry.quantity),
            requested_for: form.purpose || 'Reserva de laboratorio',
            notes: '',
            laboratory_id: String(selectedLab?.id || ''),
            lab_reservation_id: String(createdReservation?.id || ''),
          })
        )))
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length > 0) {
          const detail = failed.map((r) => r.reason?.message || 'Error desconocido').join('; ')
          materialMessage = ` Sin embargo, ${failed.length} material(es) no se pudieron reservar: ${detail}`
        } else {
          materialMessage = ` Se enviaron ${requestedMaterials.length} solicitud(es) de reactivos asociadas.`
        }
      }

      setMessage(`Reserva enviada correctamente. Queda pendiente de aprobacion.${materialMessage}`)
      setSelectedSlotKey('')
      setForm((prev) => ({
        ...createDefaultForm(),
        laboratory_id: prev.laboratory_id || '',
        date: prev.date || todayLocalDateString(),
        start_time: '',
        end_time: '',
      }))
      availabilityRefreshRef.current?.()
      await refreshAllData()
    } catch (err) {
      setError(err.message || 'No se pudo crear la reserva.')
    } finally {
      setIsSubmittingReservation(false)
    }
  }

  const openEditModal = (reservation) => {
    setEditingReservation(reservation)
    setFocusedReservationId(reservation.id)
    setEditSlots([])
    setEditSelectedSlotKey(`${reservation.start_time || ''}-${reservation.end_time || ''}`)
    setEditForm(createDefaultForm({
      laboratory_id: String(reservation.laboratory_id || ''),
      date: reservation.date || '',
      start_time: reservation.start_time || '',
      end_time: reservation.end_time || '',
      purpose: reservation.purpose || '',
      notes: reservation.notes || '',
      requires_full_lab: Boolean(reservation.requires_full_lab),
      project_description: reservation.project_description || '',
      responsible_teacher: reservation.responsible_teacher || '',
      responsible_teacher_name: reservation.responsible_teacher_name || '',
    }))
    setError('')
    setMessage('')
  }

  const closeEditModal = () => {
    setEditingReservation(null)
    setEditForm(createDefaultForm())
    setEditSlots([])
    setEditSelectedSlotKey('')
    setIsSavingEdit(false)
  }

  const handleEditFromDetail = () => {
    if (!focusedReservation) {
      return
    }

    handleCloseReservationDetails()
    openEditModal(focusedReservation)
  }

  const handleEditFormChange = (field, value) => {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'laboratory_id' || field === 'date'
        ? {
            start_time: '',
            end_time: '',
          }
        : {}),
    }))
    if (field === 'laboratory_id' || field === 'date') {
      setEditSelectedSlotKey('')
    }
  }

  const handleEditSlotSelect = (slot) => {
    if (!isEditSlotSelectable(slot)) {
      return
    }

    setEditSelectedSlotKey(getSlotKey(slot))
    setEditForm((previous) => ({
      ...previous,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }))
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editingReservation) {
      return
    }

    setError('')
    setMessage('')
    setIsSavingEdit(true)

    try {
      if (editValidationMessage) {
        throw new Error(editValidationMessage)
      }

      const updatedReservation = await updateReservation(editingReservation.id, {
        ...editForm,
        area_id: selectedEditLab?.area_id || '',
      })
      setMessage(
        'Reserva actualizada correctamente. Recuerda que esta accion solo puede realizarse una vez por reserva.',
      )
      setFocusedReservationId(updatedReservation.id)
      setFocusedReservationDetails(updatedReservation)
      closeEditModal()
      availabilityRefreshRef.current?.()
      await refreshAllData()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva.')
      setIsSavingEdit(false)
    }
  }

  const handleRequestCancel = (reservation) => {
    setReservationToCancel(reservation)
    setError('')
    setMessage('')
  }

  const handleConfirmCancel = async () => {
    if (!reservationToCancel) {
      return
    }

    setIsCancelling(true)
    setError('')
    setMessage('')

    try {
      const wasApproved = reservationToCancel.status === 'approved'
      await deleteReservation(reservationToCancel.id)
      setReservationToCancel(null)
      if (focusedReservationId === reservationToCancel.id) {
        handleCloseReservationDetails()
      }
      setMessage(
        wasApproved
          ? 'La reserva aprobada fue cancelada. El horario quedo libre nuevamente y el encargado recibira una alerta.'
          : 'La reserva fue cancelada correctamente y el horario quedo disponible.',
      )
      availabilityRefreshRef.current?.()
      await refreshAllData()
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la reserva.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleMarkNotificationAsRead = async (notificationId) => {
    try {
      await onMarkNotificationAsRead?.(notificationId)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la alerta.')
    }
  }

  const tutorialAction = focusedTutorial ? getTutorialPrimaryAction(focusedTutorial, user?.user_id) : null

  return (
    <section className="reservations-page" aria-label="Reservar laboratorio">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Solicitud de uso</p>
          <h2>Reservar laboratorio</h2>
          <p>Elige laboratorio, fecha y horario. Luego revisa tus solicitudes y cambios desde esta misma pantalla.</p>
        </div>
        <div className="reservations-summary">
          <div>
            <span>Mis reservas</span>
            <strong>{myReservations.length}</strong>
          </div>
          <div>
            <span>Alertas nuevas</span>
            <strong>{unreadNotificationsCount}</strong>
          </div>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      {activePenalty ? (
        <section className="reservations-panel reservation-suspension-banner" aria-label="Cuenta suspendida">
          <div className="reservation-suspension-copy">
            <strong>Cuenta suspendida para nuevas reservas</strong>
            <p>
              Tienes una penalizacion activa por danos registrados. Motivo: <strong>{activePenalty.reason}</strong>.
            </p>
            <p>
              Restriccion vigente hasta <strong>{activePenalty.ends_at}</strong>.
              {activePenalty.evidence_report_id ? ` Evidencia: ${activePenalty.evidence_type} #${activePenalty.evidence_report_id}.` : ''}
            </p>
          </div>
        </section>
      ) : null}

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Alertas y recordatorios</h3>
          <p className="reservations-panel-subtitle">
            Aqui apareceran cambios importantes y recordatorios de 24 horas y 30 minutos antes del inicio.
          </p>
        </div>
        {notifications.length === 0 ? (
          <p className="reservations-empty">Aun no tienes alertas registradas.</p>
        ) : (
          <div className="reservation-notification-list">
            {notifications.map((notification) => {
              const isReminder = notification.type === 'reservation_reminder' || notification.type === 'tutorial_reminder'
              const isTutorialReminder = notification.type === 'tutorial_reminder'
              const isPenaltyNotification = notification.type === 'penalty_applied' || notification.type === 'penalty_lifted'
              const isTutorialUpdate = notification.type === 'tutorial_session_updated'
              const isTutorialCancelled = notification.type === 'tutorial_session_cancelled'
              const showSchedule = !isTutorialUpdate && notification.change_kinds.includes('schedule')
              const showLocation = !isTutorialUpdate && notification.change_kinds.includes('location')
              const showTutorialSchedule = isTutorialUpdate && notification.change_kinds.includes('schedule')
              const showTutorialLocation = isTutorialUpdate && notification.change_kinds.includes('location')
              const showTutorialTutor = isTutorialUpdate && notification.change_kinds.includes('tutor')
              const oldLabName = labNameById[String(notification.old_laboratory_id)] || notification.old_laboratory_id || 'Sin laboratorio'
              const newLabName = labNameById[String(notification.new_laboratory_id)] || notification.new_laboratory_id || 'Sin laboratorio'
              const reminderLabName =
                labNameById[String(notification.reminder_laboratory_id)] ||
                notification.reminder_laboratory_id ||
                'Sin laboratorio'
              const reminderLocation = notification.reminder_location || reminderLabName
              const reminderToneClass = notification.reminder_kind === '30m' ? ' is-reminder-urgent' : ' is-reminder'
              const reminderStartsAt = [notification.reminder_date, notification.reminder_time]
                .filter(Boolean)
                .join(' | ') || 'Sin horario confirmado'
              const reminderWindow = notification.reminder_kind === '30m'
                ? 'Faltan 30 minutos'
                : notification.reminder_kind === '24h'
                  ? 'Faltan 24 horas'
                  : 'Recordatorio programado'

              return (
                <article
                  key={notification.id}
                  className={`reservation-notification-card${notification.is_read ? '' : ' is-unread'}${isReminder ? reminderToneClass : ''}`}
                >
                  <div className="reservation-notification-head">
                    <div>
                      <span className="reservation-notification-badge">{notification.title}</span>
                      <h4>{notification.purpose || notification.penalty_reason || 'Actualizacion del sistema'}</h4>
                    </div>
                    <div className="reservation-notification-meta">
                      <small>{formatNotificationDateTime(notification.created_at)}</small>
                      {!notification.is_read ? <strong>Nueva</strong> : <span>Leida</span>}
                    </div>
                  </div>

                  <p className="reservation-notification-message">{notification.message}</p>

                  {isReminder ? (
                    <div className="reservation-notification-diff">
                      <div className="reservation-notification-change">
                        <span>Comienza</span>
                        <strong className="reservation-notification-new">{reminderStartsAt}</strong>
                      </div>
                      <div className="reservation-notification-change">
                        <span>{isTutorialReminder ? 'Ubicacion' : 'Laboratorio'}</span>
                        <strong>{isTutorialReminder ? reminderLocation : reminderLabName}</strong>
                      </div>
                      {isTutorialReminder ? (
                        <div className="reservation-notification-change">
                          <span>Tutor</span>
                          <strong>{notification.reminder_tutor_name || 'Tutor asignado'}</strong>
                        </div>
                      ) : null}
                      <div className="reservation-notification-change">
                        <span>Ventana</span>
                        <strong>{reminderWindow}</strong>
                      </div>
                    </div>
                  ) : isPenaltyNotification ? (
                    <div className="reservation-notification-diff">
                      <div className="reservation-notification-change">
                        <span>Motivo</span>
                        <strong>{notification.penalty_reason || 'Sin detalle registrado'}</strong>
                      </div>
                      <div className="reservation-notification-change">
                        <span>Vigencia</span>
                        <strong className={notification.type === 'penalty_applied' ? 'reservation-notification-old' : 'reservation-notification-new'}>
                          {notification.penalty_end_at || 'Sin fecha limite'}
                        </strong>
                      </div>
                      {notification.penalty_evidence_id ? (
                        <div className="reservation-notification-change">
                          <span>Evidencia</span>
                          <strong>{notification.penalty_evidence_id}</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : isTutorialUpdate || isTutorialCancelled ? (
                    <div className="reservation-notification-diff">
                      {showTutorialSchedule || isTutorialCancelled ? (
                        <div className="reservation-notification-change">
                          <span>{showTutorialSchedule ? 'Horario anterior' : 'Horario'}</span>
                          <strong className={showTutorialSchedule ? 'reservation-notification-old' : undefined}>
                            {[
                              notification.old_tutorial_date || notification.tutorial_date,
                              showTutorialSchedule
                                ? notification.old_tutorial_time_range
                                : `${notification.tutorial_start_time} - ${notification.tutorial_end_time}`,
                            ]
                              .filter(Boolean)
                              .join(' | ')}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario nuevo</span>
                          <strong className="reservation-notification-new">
                            {[notification.new_tutorial_date, notification.new_tutorial_time_range].filter(Boolean).join(' | ')}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialLocation || isTutorialCancelled ? (
                        <div className="reservation-notification-change">
                          <span>{showTutorialLocation ? 'Laboratorio anterior' : 'Laboratorio'}</span>
                          <strong className={showTutorialLocation ? 'reservation-notification-old' : undefined}>
                            {showTutorialLocation ? notification.old_tutorial_location : notification.tutorial_location}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialLocation ? (
                        <div className="reservation-notification-change">
                          <span>Laboratorio nuevo</span>
                          <strong className="reservation-notification-new">{notification.new_tutorial_location}</strong>
                        </div>
                      ) : null}

                      {showTutorialTutor || isTutorialCancelled ? (
                        <div className="reservation-notification-change">
                          <span>{showTutorialTutor ? 'Tutor anterior' : 'Tutor'}</span>
                          <strong className={showTutorialTutor ? 'reservation-notification-old' : undefined}>
                            {showTutorialTutor ? notification.old_tutor_name : notification.tutor_name}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialTutor ? (
                        <div className="reservation-notification-change">
                          <span>Tutor nuevo</span>
                          <strong className="reservation-notification-new">{notification.new_tutor_name}</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="reservation-notification-diff">
                      {showSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario anterior</span>
                          <strong className="reservation-notification-old">
                            {notification.old_date} | {notification.old_time_range}
                          </strong>
                        </div>
                      ) : null}

                      {showSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario nuevo</span>
                          <strong className="reservation-notification-new">
                            {notification.new_date} | {notification.new_time_range}
                          </strong>
                        </div>
                      ) : null}

                      {showLocation ? (
                        <div className="reservation-notification-change">
                          <span>Laboratorio anterior</span>
                          <strong className="reservation-notification-old">{oldLabName}</strong>
                        </div>
                      ) : null}

                      {showLocation ? (
                        <div className="reservation-notification-change">
                          <span>Laboratorio nuevo</span>
                          <strong className="reservation-notification-new">{newLabName}</strong>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!notification.is_read ? (
                    <div className="reservations-actions">
                      <button
                        type="button"
                        className="reservations-secondary"
                        onClick={() => handleMarkNotificationAsRead(notification.id)}
                      >
                        Marcar como leida
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="reservations-panel">
        <form className="reservations-form" onSubmit={handleSubmit}>
          {(() => {
            const reactivosCount = form.requested_materials.filter((m) => normalizeCategory(m.category) === 'Reactivos').length
            const materialesCount = form.requested_materials.filter((m) => normalizeCategory(m.category) !== 'Reactivos').length
            const steps = [
              { n: 1, label: 'Laboratorio', done: Boolean(form.laboratory_id) },
              { n: 2, label: 'Horario', done: Boolean(form.start_time && form.end_time) },
              { n: 3, label: 'Modalidad', done: true },
              { n: 4, label: 'Detalles', done: form.purpose.trim().length >= MIN_PURPOSE_LENGTH },
              { n: 5, label: 'Reactivos', optional: true, done: reactivosCount > 0 },
              { n: 6, label: 'Materiales', optional: true, done: materialesCount > 0 },
            ]
            return (
              <ol className="reservation-steps" aria-label="Pasos de la reserva">
                {steps.map((step) => (
                  <li key={step.n} className={`reservation-step${step.done ? ' is-done' : ''}${step.optional ? ' is-optional' : ''}`}>
                    <span className="reservation-step-num">{step.n}</span>
                    <span className="reservation-step-label">{step.label}{step.optional ? ' (opcional)' : ''}</span>
                  </li>
                ))}
              </ol>
            )
          })()}

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">1 - Laboratorio</span>
            <LabPicker
              labs={labs}
              selectedLabId={form.laboratory_id}
              onSelect={handleLabSelect}
              disabled={Boolean(activePenalty)}
              emptyHint="No tienes permisos para reservar en los laboratorios disponibles."
              title="Elige un espacio disponible"
            />
            {!selectedLabIsAccessible && form.laboratory_id ? (
              <p className="reservation-inline-hint">
                No tienes permisos para reservar este laboratorio. El formulario se deshabilita hasta elegir uno habilitado.
              </p>
            ) : null}
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">2 - Fecha y Bloque Horario</span>
            <div className="reservations-form-grid">
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={form.date}
                  min={todayIso}
                  max={maxReservationIso}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    date: event.target.value,
                    start_time: '',
                    end_time: '',
                  }))}
                  disabled={Boolean(activePenalty)}
                  required
                />
              </label>
              <label>
                <span>Hora de inicio</span>
                <input
                  type="text"
                  value={form.start_time}
                  readOnly
                  placeholder="Selecciona un bloque"
                  disabled={Boolean(activePenalty)}
                />
              </label>
              <label>
                <span>Hora de fin</span>
                <input
                  type="text"
                  value={form.end_time}
                  readOnly
                  placeholder="Selecciona un bloque"
                  disabled={Boolean(activePenalty)}
                />
              </label>
            </div>

            {selectedLab ? (
              <div className="reservation-slot-panel">
                <div className="reservation-slot-header">
                  <div>
                    <strong>Bloques del dia</strong>
                    <p>
                      Selecciona un bloque visualmente. Los bloques ocupados o en mantenimiento no se pueden reservar.
                    </p>
                  </div>
                  <div className="reservation-slot-legend">
                    <span className="cal-legend-item cal-legend--available">
                      <span className="cal-legend-dot" /> Disponible
                    </span>
                    <span className="cal-legend-item cal-legend--busy">
                      <span className="cal-legend-dot" /> Ocupado
                    </span>
                    <span className="reservation-slot-legend-item class">
                      <span className="reservation-slot-legend-dot" /> Clase
                    </span>
                    <span className="reservation-slot-legend-item maintenance">
                      <span className="reservation-slot-legend-dot" /> Mantenimiento
                    </span>
                    <span className="reservation-slot-legend-item blocked-other">
                      <span className="reservation-slot-legend-dot" /> Bloqueado
                    </span>
                    <span className="reservation-slot-legend-item tutorial">
                      <span className="reservation-slot-legend-dot" /> Tutoria
                    </span>
                    <span className="reservation-slot-legend-item past">
                      <span className="reservation-slot-legend-dot" /> Hora pasada
                    </span>
                  </div>
                </div>

                {isLoadingSlots ? (
                  <p className="reservations-empty">Cargando bloques disponibles...</p>
                ) : slots.length === 0 ? (
                  <p className="reservations-empty">No hay bloques configurados o disponibles para la fecha seleccionada.</p>
                ) : (
                  <div className="reservation-slot-grid">
                    {slots.map((slot) => {
                      const slotKey = getSlotKey(slot)
                      const isSelected = selectedSlotKey === slotKey
                      const isPast = isPastSlotForDate(slot, form.date, nowReference)
                      const isAvailable = isCreatableSlot(slot, form.requires_full_lab) && !isPast
                      const isTutorial = slot.source === 'tutorial_session'
                      const isDisabled = Boolean(activePenalty) || !selectedLabIsAccessible || (!isTutorial && !isAvailable)
                      return (
                        <button
                          key={slotKey}
                          type="button"
                          className={`reservations-slot ${getSlotTone(slot)}${isSelected ? ' is-selected' : ''}`}
                          disabled={isDisabled}
                          aria-disabled={isDisabled}
                          title={
                            isPast && !isTutorial
                              ? 'Esta hora ya paso y no se puede reservar.'
                              : slot.source === 'class' && slot.status
                                ? `Bloque ocupado por la clase: ${slot.status}`
                                : undefined
                          }
                          onClick={() => {
                            if (isDisabled) {
                              return
                            }
                            if (isTutorial) {
                              handleOpenTutorialDetails(slot.source_id)
                              return
                            }
                            setSelectedSlotKey(slotKey)
                            setForm((prev) => ({
                              ...prev,
                              start_time: slot.start_time,
                              end_time: slot.end_time,
                            }))
                          }}
                        >
                          <strong>{slot.start_time} - {slot.end_time}</strong>
                          <span>{getSlotLabel(slot)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {createValidationMessage ? <p className="reservation-inline-hint">{createValidationMessage}</p> : null}
            {!createValidationMessage ? (
              <p className="reservation-inline-hint">
                Solo puedes reservar bloques futuros y dentro de un plazo maximo de un mes.
              </p>
            ) : null}
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">3 - Modalidad de uso</span>
            <div className="reservation-exclusivity" role="radiogroup" aria-label="Modalidad de uso del laboratorio">
              <button
                type="button"
                role="radio"
                aria-checked={!form.requires_full_lab}
                className={`reservation-exclusivity-option${!form.requires_full_lab ? ' is-selected' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, requires_full_lab: false }))}
                disabled={Boolean(activePenalty)}
              >
                <strong>Compartir el laboratorio</strong>
                <span>Pueden aprobarse varias reservas en el mismo horario.</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.requires_full_lab}
                className={`reservation-exclusivity-option${form.requires_full_lab ? ' is-selected' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, requires_full_lab: true }))}
                disabled={Boolean(activePenalty)}
              >
                <strong>Uso exclusivo</strong>
                <span>Necesito todo el laboratorio; bloquea el horario al aprobarse.</span>
              </button>
            </div>
            <p className="reservation-inline-hint">
              El horario solo se bloquea cuando un administrador aprueba una reserva. Una
              reserva exclusiva no puede compartir el bloque con otras.
            </p>
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">4 - Detalles</span>
            <label>
              <span>Motivo de la reserva</span>
              <textarea
                rows="3"
                value={form.purpose}
                maxLength={250}
                onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                placeholder="Ej. Practica de laboratorio de redes, proyecto de tesis..."
                disabled={Boolean(activePenalty)}
                required
              />
            </label>
            <p className="reservation-inline-hint">
              Usa un motivo claro y academico. Minimo {MIN_PURPOSE_LENGTH} caracteres, maximo 250.
            </p>

            <label>
              <span>Descripcion del proyecto (opcional)</span>
              <textarea
                rows="3"
                value={form.project_description}
                maxLength={600}
                onChange={(event) => setForm((prev) => ({ ...prev, project_description: event.target.value }))}
                placeholder="Describe brevemente el proyecto o practica. Si no tienes docente asignado, aclara aqui quien es tu responsable o por que no tienes uno."
                disabled={Boolean(activePenalty)}
              />
            </label>

            <div className="reservation-teacher-field">
              <span className="reservations-form-inline-label">Docente responsable (opcional)</span>
              <div className="reservation-teacher-row">
                <div className={`reservation-teacher-value${form.responsible_teacher_name ? ' has-value' : ''}`}>
                  {form.responsible_teacher_name || 'Sin docente seleccionado'}
                </div>
                <button
                  type="button"
                  className="reservations-secondary"
                  onClick={() => setIsTeacherModalOpen(true)}
                  disabled={Boolean(activePenalty)}
                >
                  {form.responsible_teacher_name ? 'Cambiar' : 'Buscar docente'}
                </button>
                {form.responsible_teacher_name ? (
                  <button
                    type="button"
                    className="reservations-secondary"
                    onClick={() => setForm((prev) => ({ ...prev, responsible_teacher: '', responsible_teacher_name: '' }))}
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
              <p className="reservation-inline-hint">
                Elige a tu docente responsable de la lista. Si no tienes uno, dejalo vacio y explicalo en la descripcion del proyecto.
              </p>
            </div>
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">5 - Reactivos (opcional)</span>
            <div className="reservation-materials">
              <p className="reservation-inline-hint">
                Reactivos quimicos del catalogo compartido. Cada material queda pendiente y el encargado descuenta el stock al aprobar.
              </p>
              {(() => {
                const reactivos = form.requested_materials.filter((m) => normalizeCategory(m.category) === 'Reactivos')
                return (
                  <>
                    {reactivos.length > 0 ? renderSelectedMaterials(reactivos) : (
                      <p className="reservations-empty">Aun no seleccionaste reactivos.</p>
                    )}
                    <button
                      type="button"
                      className="reservation-open-picker-btn"
                      onClick={() => setMaterialPicker('reactivos')}
                      disabled={Boolean(activePenalty)}
                    >
                      Seleccionar reactivos
                    </button>
                  </>
                )
              })()}
            </div>
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">6 - Materiales (opcional)</span>
            <div className="reservation-materials">
              <p className="reservation-inline-hint">
                Materiales y equipos del catalogo compartido por todos los laboratorios.
              </p>
              {(() => {
                const materiales = form.requested_materials.filter((m) => normalizeCategory(m.category) !== 'Reactivos')
                return (
                  <>
                    {materiales.length > 0 ? renderSelectedMaterials(materiales) : (
                      <p className="reservations-empty">Aun no seleccionaste materiales.</p>
                    )}
                    <button
                      type="button"
                      className="reservation-open-picker-btn"
                      onClick={() => setMaterialPicker('materiales')}
                      disabled={Boolean(activePenalty)}
                    >
                      Seleccionar materiales
                    </button>
                  </>
                )
              })()}
            </div>
          </div>

          <div className="reservations-actions">
            <button
              type="submit"
              className="reservations-primary"
              disabled={!canSubmitReservation || isSubmittingReservation}
              aria-busy={isSubmittingReservation}
            >
              {activePenalty
                ? 'Reserva bloqueada'
                : isSubmittingReservation
                  ? 'Enviando solicitud...'
                  : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </section>

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Mis reservas y cambios</h3>
          <p className="reservations-panel-subtitle">
            Las reservas futuras aparecen primero para que puedas modificarlas o cancelarlas cuando aun corresponda.
          </p>
        </div>
        {myReservations.length === 0 ? (
          <p className="reservations-empty">Aun no tienes reservas registradas.</p>
        ) : (
          <>
            <div className="reservations-panel-header">
              <h4>Reservas futuras o vigentes</h4>
              <p className="reservations-panel-subtitle">
                Desde aqui puedes abrir el detalle, modificar o cancelar mientras la regla horaria lo permita.
              </p>
            </div>

            {upcomingReservations.length === 0 ? (
              <p className="reservations-empty">No tienes reservas futuras disponibles para gestionar.</p>
            ) : (
              <div className="reservation-card-grid">
                {paginatedUpcoming.map((item) => {
                  const actionState = getReservationActionState(item)
                  return (
                    <article
                      key={item.id}
                      className={`reservation-user-card${focusedReservationId === item.id ? ' is-focused' : ''}`}
                    >
                      <div className="reservation-user-card-head">
                        <div>
                          <span className="reservation-user-card-kicker">Reserva</span>
                          <h4>{item.laboratory_name || labNameById[String(item.laboratory_id)] || 'Laboratorio'}</h4>
                        </div>
                        <span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>
                      </div>

                      <div className="reservation-user-card-meta">
                        <span>{item.date}</span>
                        <span>{item.start_time} - {item.end_time}</span>
                        <span>{item.purpose || 'Sin motivo registrado'}</span>
                      </div>

                      {item.cancel_reason ? (
                        <p className="reservation-user-card-warning">Motivo de rechazo: {item.cancel_reason}</p>
                      ) : null}

                      <div className="reservation-user-card-actions">
                        <button
                          type="button"
                          className="reservations-secondary"
                          onClick={() => handleOpenReservationDetails(item)}
                        >
                          Ver detalle
                        </button>

                        {actionState.canModify ? (
                          <button
                            type="button"
                            className="reservations-secondary"
                            onClick={() => openEditModal(item)}
                          >
                            Modificar
                          </button>
                        ) : null}

                        {!actionState.canModify && !actionState.hasStarted && actionState.withinTwoHours ? (
                          <button type="button" className="reservations-secondary" disabled>
                            Modificar bloqueado
                          </button>
                        ) : null}

                        {!actionState.canModify && !actionState.hasStarted && actionState.modificationLimitReached ? (
                          <button type="button" className="reservations-secondary" disabled>
                            Modificacion usada
                          </button>
                        ) : null}

                        {actionState.canCancel ? (
                          <button
                            type="button"
                            className="reservations-danger"
                            onClick={() => handleRequestCancel(item)}
                          >
                            Cancelar
                          </button>
                        ) : null}
                      </div>

                      {!actionState.hasStarted && actionState.withinTwoHours ? (
                        <p className="reservation-inline-hint">
                          Faltan menos de 2 horas para el inicio, por eso el boton de modificar esta deshabilitado.
                        </p>
                      ) : null}

                      {!actionState.hasStarted && actionState.modificationLimitReached ? (
                        <p className="reservation-inline-hint">
                          Ya utilizaste la unica modificacion permitida para esta reserva.
                        </p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}

            {upcomingReservations.length > RESERVATIONS_PAGE_SIZE ? (
              <div className="reservations-pager" role="navigation" aria-label="Paginacion de reservas futuras">
                <button
                  type="button"
                  className="reservations-secondary"
                  onClick={() => setUpcomingPage((prev) => Math.max(prev - 1, 0))}
                  disabled={upcomingPage <= 0}
                >
                  Anterior
                </button>
                <span className="reservations-pager-status">
                  Pagina {upcomingPage + 1} de {upcomingTotalPages}
                </span>
                <button
                  type="button"
                  className="reservations-secondary"
                  onClick={() => setUpcomingPage((prev) => Math.min(prev + 1, upcomingTotalPages - 1))}
                  disabled={upcomingPage + 1 >= upcomingTotalPages}
                >
                  Siguiente
                </button>
              </div>
            ) : null}

            <div className="reservations-panel-header reservation-history-header">
              <h4>Historial reciente</h4>
              <p className="reservations-panel-subtitle">
                Las reservas ya transcurridas se muestran como referencia y sin acciones disponibles.
              </p>
            </div>

            {reservationHistory.length === 0 ? (
              <p className="reservations-empty">Aun no tienes reservas transcurridas en el historial.</p>
            ) : (
              <div className="reservation-card-grid">
                {paginatedHistory.map((item) => (
                  <article
                    key={item.id}
                    className={`reservation-user-card${focusedReservationId === item.id ? ' is-focused' : ''}`}
                  >
                    <div className="reservation-user-card-head">
                      <div>
                        <span className="reservation-user-card-kicker">Reserva</span>
                        <h4>{item.laboratory_name || labNameById[String(item.laboratory_id)] || 'Laboratorio'}</h4>
                      </div>
                      <span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>
                    </div>

                    <div className="reservation-user-card-meta">
                      <span>{item.date}</span>
                      <span>{item.start_time} - {item.end_time}</span>
                      <span>{item.purpose || 'Sin motivo registrado'}</span>
                    </div>

                    {item.cancel_reason ? (
                      <p className="reservation-user-card-warning">Motivo de rechazo: {item.cancel_reason}</p>
                    ) : null}

                    <div className="reservation-user-card-actions">
                      <button
                        type="button"
                        className="reservations-secondary"
                        onClick={() => handleOpenReservationDetails(item)}
                      >
                        Ver detalle
                      </button>
                    </div>

                    <p className="reservation-inline-hint">
                      Esta reserva ya transcurrio. Las acciones de modificar y cancelar ya no estan disponibles.
                    </p>
                  </article>
                ))}
              </div>
            )}

            {reservationHistory.length > RESERVATIONS_PAGE_SIZE ? (
              <div className="reservations-pager" role="navigation" aria-label="Paginacion del historial">
                <button
                  type="button"
                  className="reservations-secondary"
                  onClick={() => setHistoryPage((prev) => Math.max(prev - 1, 0))}
                  disabled={historyPage <= 0}
                >
                  Anterior
                </button>
                <span className="reservations-pager-status">
                  Pagina {historyPage + 1} de {historyTotalPages}
                </span>
                <button
                  type="button"
                  className="reservations-secondary"
                  onClick={() => setHistoryPage((prev) => Math.min(prev + 1, historyTotalPages - 1))}
                  disabled={historyPage + 1 >= historyTotalPages}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {editingReservation ? (
        <Suspense fallback={null}>
          <ReservationEditModal
            reservation={editingReservation}
            labs={labs}
            form={editForm}
            slots={editSlots}
            selectedSlotKey={editSelectedSlotKey}
            isLoadingSlots={isLoadingEditSlots}
            minDate={todayIso}
            maxDate={maxReservationIso}
            validationMessage={editValidationMessage}
            onSelectSlot={handleEditSlotSelect}
            getSlotKey={getSlotKey}
            getSlotTone={getEditSlotTone}
            getSlotLabel={getSlotLabel}
            getSlotDisabledHint={getEditSlotDisabledHint}
            isSlotSelectable={isEditSlotSelectable}
            onChange={handleEditFormChange}
            onSubmit={handleEditSubmit}
            onClose={closeEditModal}
            isSubmitting={isSavingEdit}
          />
        </Suspense>
      ) : null}

      {isReservationDetailOpen && (focusedReservation || isLoadingReservationDetails) ? (
        <Suspense fallback={null}>
          <ReservationDetailModal
            reservation={focusedReservation}
            actionState={focusedReservation ? getReservationActionState(focusedReservation) : null}
            isLoading={isLoadingReservationDetails}
            laboratoryName={
              focusedReservation
                ? (focusedReservation.laboratory_name || labNameById[String(focusedReservation.laboratory_id)] || 'Laboratorio')
                : 'Laboratorio'
            }
            onClose={handleCloseReservationDetails}
            onEdit={handleEditFromDetail}
            onCancel={() => {
              if (focusedReservation) {
                handleCloseReservationDetails()
                handleRequestCancel(focusedReservation)
              }
            }}
          />
        </Suspense>
      ) : null}

      {focusedTutorial ? (
        <Suspense fallback={null}>
          <TutorialSessionDetailModal
            session={focusedTutorial}
            title="Tutoria en este bloque"
            onClose={() => setFocusedTutorial(null)}
            primaryActionLabel={tutorialAction?.label || ''}
            primaryActionHint={tutorialAction?.hint || ''}
            onPrimaryAction={() => {
              const sessionId = focusedTutorial?.id
              setFocusedTutorial(null)
              openTutorialSessionFlow(sessionId, { navigate: true })
            }}
          />
        </Suspense>
      ) : null}

      {reservationToCancel ? (
        <ConfirmModal
          title="Cancelar reserva"
          message={
            reservationToCancel.status === 'approved'
              ? 'Esta reserva ya estaba aprobada. Si la cancelas, el horario volvera a quedar libre y el encargado recibira una alerta automatica.'
              : 'Si cancelas esta reserva pendiente, el horario volvera a mostrarse como disponible.'
          }
          confirmLabel={isCancelling ? 'Cancelando...' : 'Cancelar reserva'}
          onConfirm={isCancelling ? undefined : handleConfirmCancel}
          onCancel={isCancelling ? undefined : () => setReservationToCancel(null)}
        />
      ) : null}

      <TeacherPickerModal
        open={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        selectedTeacherId={form.responsible_teacher}
        onSelect={(teacher) =>
          setForm((prev) => ({
            ...prev,
            responsible_teacher: teacher ? teacher.id : '',
            responsible_teacher_name: teacher ? teacher.name : '',
          }))
        }
      />

      <MaterialPickerModal
        open={materialPicker !== null}
        onClose={() => setMaterialPicker(null)}
        kicker={materialPicker === 'reactivos' ? 'Reactivos' : 'Materiales'}
        title={materialPicker === 'reactivos' ? 'Seleccionar reactivos' : 'Seleccionar materiales'}
        initialCategory={materialPicker === 'reactivos' ? 'Reactivos' : ''}
        selected={form.requested_materials}
        onChange={setRequestedMaterials}
      />
    </section>
  )
}

export default UserReserveLabPage
