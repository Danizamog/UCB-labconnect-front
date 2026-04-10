import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listAdminLabs } from '../../admin/services/infrastructureService'
import { listUserProfiles } from '../../admin/services/profileService'
import {
  createWalkInReservation,
  getOccupancyDashboard,
  listReservations,
  listReservationsPage,
  markReservationAbsent,
  registerReservationEntry,
  registerReservationExit,
  subscribeReservationsRealtime,
  updateReservation,
  updateReservationStatus,
} from '../services/reservationsService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
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

const defaultTableFilters = {
  status: 'all',
  laboratory_id: '',
  date: '',
  where: '',
  sortBy: 'start_at',
  sortType: 'DESC',
  pageSize: 5,
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
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

function buildAutoWhereFromFilters(filters = {}) {
  const clauses = []

  if (filters.status && filters.status !== 'all') {
    clauses.push(`status=${filters.status}`)
  }
  if (filters.laboratory_id) {
    clauses.push(`laboratory_id=${filters.laboratory_id}`)
  }
  if (filters.date) {
    clauses.push(`date=${filters.date}`)
  }

  return clauses.join(';')
}

function AdminReservationsPage({ user }) {
  const [reservations, setReservations] = useState([])
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
  const [rejectingReservationId, setRejectingReservationId] = useState(null)
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
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const tableQueryRef = useRef({ ...defaultTableFilters, pageNumber: 0 })
  const realtimeRefreshTimeoutRef = useRef(null)

  const canManage = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])

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
      setWalkInForm((previous) => ({
        ...previous,
        laboratory_id: previous.laboratory_id || labsData[0]?.id || '',
        end_time: previous.end_time || timeWithOffset(60),
      }))
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos base del panel de reservas.')
    }
  }, [])

  const loadOperationalData = useCallback(async () => {
    try {
      const [reservationsResult, occupancyResult] = await Promise.allSettled([
        listReservations(),
        getOccupancyDashboard(),
      ])
      if (reservationsResult.status !== 'fulfilled' || occupancyResult.status !== 'fulfilled') {
        throw new Error('No se pudo cargar el panel de reservas.')
      }

      setReservations(reservationsResult.value)
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

  useEffect(() => {
    tableQueryRef.current = tableQuery
  }, [tableQuery])

  useEffect(() => {
    loadReferenceData()
    loadOperationalData()

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'lab_reservation' || event?.topic === 'lab_access') {
        window.clearTimeout(realtimeRefreshTimeoutRef.current)
        realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
          loadOperationalData()
          loadTableData(tableQueryRef.current)
        }, 250)
      }
    })

    return () => {
      window.clearTimeout(realtimeRefreshTimeoutRef.current)
      unsubscribe?.()
    }
  }, [loadOperationalData, loadReferenceData, loadTableData])

  useEffect(() => {
    loadTableData(tableQuery)
  }, [loadTableData, tableQuery])

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

  const pendingCount = reservations.filter((item) => item.status === 'pending').length
  const approvedCount = reservations.filter((item) => item.status === 'approved').length
  const inProgressCount = reservations.filter((item) => item.status === 'in_progress').length
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
  const isEditFormValid =
    String(draft.laboratory_id || '').trim().length > 0 &&
    String(draft.date || '').trim().length > 0 &&
    String(draft.start_time || '').trim().length > 0 &&
    String(draft.end_time || '').trim().length > 0 &&
    draft.purpose.trim().length >= 8 &&
    isEditChronologyValid

  const todaysReservations = useMemo(
    () => reservations.filter((item) => item.date === todayDate()).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [reservations],
  )

  const handleUpdateStatus = async (reservationId, status, options = {}) => {
    if (!canManage) return
    setError('')
    setMessage('')
    try {
      await updateReservationStatus(reservationId, status, options)
      setMessage(
        status === 'approved'
          ? 'Reserva aprobada correctamente. El estudiante recibira una notificacion de confirmacion.'
          : 'Reserva rechazada correctamente. El estudiante recibira una notificacion con el motivo ingresado.',
      )
      setRejectingReservationId(null)
      setRejectionReason('')
      await Promise.all([loadOperationalData(), loadTableData(tableQueryRef.current)])
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva.')
    }
  }

  const handleStartEdit = (reservation) => {
    setEditingReservationId(reservation.id)
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
  }

  const handleCancelEdit = () => {
    setEditingReservationId(null)
    setDraft({
      laboratory_id: '',
      date: '',
      start_time: '08:00',
      end_time: '09:00',
      purpose: '',
      notes: '',
    })
  }

  const handleStartReject = (reservation) => {
    setRejectingReservationId(reservation.id)
    setRejectionReason(reservation.cancel_reason || '')
    setError('')
    setMessage('')
  }

  const handleCancelReject = () => {
    setRejectingReservationId(null)
    setRejectionReason('')
  }

  const handleConfirmReject = async (reservationId) => {
    await handleUpdateStatus(reservationId, 'rejected', { cancel_reason: rejectionReason })
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()
    if (!canManage || !editingReservationId) {
      return
    }

    setError('')
    setMessage('')

    try {
      const selectedLab = labs.find((lab) => String(lab.id) === String(draft.laboratory_id))
      await updateReservation(editingReservationId, {
        ...draft,
        area_id: selectedLab?.area_id || '',
      })
      setMessage('Reserva actualizada correctamente. Si cambiaste horario o laboratorio, el estudiante recibira una alerta.')
      handleCancelEdit()
      await Promise.all([loadOperationalData(), loadTableData(tableQueryRef.current)])
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva.')
    }
  }

  const handleRegisterEntry = async (reservation) => {
    setError('')
    setMessage('')
    try {
      const requesterEmail = getReservationRequesterEmail(reservation)
      await registerReservationEntry(reservation.id, {
        occupant_name: getReservationRequesterName(reservation),
        occupant_email: requesterEmail === '-' ? '' : requesterEmail,
        station_label: reservation.station_label || '',
      })
      setMessage('Entrada registrada. La reserva cambio a En curso y se guardo la hora exacta del ingreso.')
      await Promise.all([loadOperationalData(), loadTableData(tableQueryRef.current)])
    } catch (err) {
      setError(err.message || 'No se pudo registrar la entrada.')
    }
  }

  const handleRegisterExit = async (reservationId) => {
    setError('')
    setMessage('')
    try {
      await registerReservationExit(reservationId)
      setMessage('Salida registrada. La reserva cambio a Completada y el espacio quedo liberado.')
      await Promise.all([loadOperationalData(), loadTableData(tableQueryRef.current)])
    } catch (err) {
      setError(err.message || 'No se pudo registrar la salida.')
    }
  }

  const handleMarkAbsent = async (reservationId) => {
    setError('')
    setMessage('')
    try {
      await markReservationAbsent(reservationId)
      setMessage('Reserva marcada como Ausente. El bloque vuelve a quedar libre para nuevas asignaciones.')
      await Promise.all([loadOperationalData(), loadTableData(tableQueryRef.current)])
    } catch (err) {
      setError(err.message || 'No se pudo marcar la reserva como ausente.')
    }
  }

  const handleCreateWalkIn = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
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
      await Promise.all([loadOperationalData(), loadTableData(tableQueryRef.current)])
    } catch (err) {
      setError(err.message || 'No se pudo registrar el walk-in.')
    }
  }

  const handleApplyTableFilters = (event) => {
    event.preventDefault()
    const manualWhere = String(tableFilters.where || '').trim()
    const effectiveWhere = manualWhere || buildAutoWhereFromFilters(tableFilters)
    const nextFilters = {
      ...tableFilters,
      where: effectiveWhere,
    }

    setTableFilters(nextFilters)
    setTableQuery({
      ...nextFilters,
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

  const visibleRangeStart = tableMeta.totalElements === 0 ? 0 : tableMeta.pageNumber * tableMeta.pageSize + 1
  const visibleRangeEnd = Math.min((tableMeta.pageNumber + 1) * tableMeta.pageSize, tableMeta.totalElements)

  return (
    <section className="reservations-page" aria-label="Panel de reservas">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Gestion operativa</p>
          <h2>Dashboard de acceso al laboratorio</h2>
          <p>Controla ocupacion en tiempo real, registra ingresos y salidas y crea walk-ins cuando exista espacio disponible.</p>
        </div>
        <div className="reservations-summary">
          <div><span>Total</span><strong>{reservations.length}</strong></div>
          <div><span>Pendientes</span><strong>{pendingCount}</strong></div>
          <div><span>Aprobadas</span><strong>{approvedCount}</strong></div>
          <div><span>Dentro</span><strong>{occupancy.current_occupancy}</strong></div>
          <div><span>En curso</span><strong>{inProgressCount}</strong></div>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel reservations-panel-secondary">
        <div className="reservations-panel-header">
          <h3>Ocupacion actual</h3>
          <p className="reservations-panel-subtitle">
            El contador se actualiza en tiempo real con cada entrada, salida, walk-in o ausencia marcada.
          </p>
        </div>
        <div className="reservation-occupancy-grid">
          <article className="reservation-occupancy-card is-primary">
            <span>Usuarios dentro</span>
            <strong>{occupancy.current_occupancy}</strong>
            <p>Actualizado con cada check-in y check-out.</p>
          </article>
          {occupancy.lab_breakdown.map((entry) => (
            <article key={entry.laboratory_id} className="reservation-occupancy-card">
              <span>{labNameById[String(entry.laboratory_id)] || entry.laboratory_id}</span>
              <strong>{entry.occupancy_count}</strong>
              <p>
                {Number(labById[String(entry.laboratory_id)]?.capacity || 0) > 0
                  ? `${Math.max(Number(labById[String(entry.laboratory_id)]?.capacity || 0) - entry.occupancy_count, 0)} cupos libres`
                  : 'Sin capacidad configurada'}
              </p>
            </article>
          ))}
        </div>

        {occupancy.active_sessions.length > 0 ? (
          <div className="reservation-card-grid">
            {occupancy.active_sessions.map((session) => (
              <article key={session.reservation_id} className="reservation-user-card is-focused">
                <div className="reservation-user-card-head">
                  <div>
                    <span className="reservation-user-card-kicker">{session.is_walk_in ? 'Walk-in' : 'En curso'}</span>
                    <h4>{getReservationRequesterName(session)}</h4>
                  </div>
                  <span className="reservations-status in_progress">Dentro</span>
                </div>
                <div className="reservation-user-card-meta">
                  <span>{getReservationLabLabel(session)}</span>
                  <span>Ingreso: {session.check_in_at}</span>
                  <span>Estacion: {session.station_label || 'Sin estacion'}</span>
                  <span>{session.purpose || 'Sin motivo registrado'}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="reservations-empty">No hay usuarios dentro del laboratorio en este momento.</p>
        )}
      </section>

      <section className="reservations-panel reservations-panel-tertiary">
        <details className="ux-extra-toggle">
          <summary>Opciones extra: ingreso rapido (walk-in)</summary>
          <div className="ux-extra-toggle-content">
        <div className="reservations-panel-header">
          <h3>Ingreso rapido sin reserva previa</h3>
          <p className="reservations-panel-subtitle">
            Usa esta opcion solo si el espacio actual del laboratorio lo permite. El sistema rechazara el walk-in si el bloque ya esta ocupado.
          </p>
        </div>

        <form className="reservations-form" onSubmit={handleCreateWalkIn}>
          <div className="reservations-form-grid">
            <label>
              <span>Laboratorio</span>
              <select
                value={walkInForm.laboratory_id}
                onChange={(event) => setWalkInForm((prev) => ({ ...prev, laboratory_id: event.target.value }))}
                required
              >
                <option value="">Selecciona un laboratorio</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>ID estudiante/docente</span>
              {profiles.length > 0 ? (
                <select
                  value={walkInForm.requested_by}
                  onChange={(event) => {
                    const nextRequestedBy = event.target.value
                    const profile = profileById[String(nextRequestedBy)]
                    setWalkInForm((prev) => ({
                      ...prev,
                      requested_by: nextRequestedBy,
                      occupant_name: profile?.name || profile?.username || '',
                      occupant_email: profile?.email || '',
                    }))
                  }}
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {(profile.name || profile.username || profile.id) + (profile.email ? ` (${profile.email})` : '')}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={walkInForm.requested_by}
                  onChange={(event) => setWalkInForm((prev) => ({ ...prev, requested_by: event.target.value }))}
                  placeholder="ID real del usuario"
                  minLength={4}
                  required
                />
              )}
            </label>
            <label>
              <span>Nombre</span>
              <input
                value={walkInForm.occupant_name}
                onChange={(event) => setWalkInForm((prev) => ({ ...prev, occupant_name: event.target.value }))}
                placeholder="Nombre del usuario"
                minLength={5}
                required
              />
            </label>
            <label>
              <span>Correo</span>
              <input
                type="email"
                value={walkInForm.occupant_email}
                onChange={(event) => setWalkInForm((prev) => ({ ...prev, occupant_email: event.target.value }))}
                placeholder="correo institucional"
                required
              />
            </label>
            <label>
              <span>Estacion</span>
              <input
                value={walkInForm.station_label}
                onChange={(event) => setWalkInForm((prev) => ({ ...prev, station_label: event.target.value }))}
                placeholder="PC-04 o Mesa 2"
              />
            </label>
            <label>
              <span>Hora estimada de salida</span>
              <input
                type="time"
                value={walkInForm.end_time}
                onChange={(event) => setWalkInForm((prev) => ({ ...prev, end_time: event.target.value }))}
                required
              />
            </label>
          </div>
          <label>
            <span>Motivo</span>
            <textarea
              rows="3"
              value={walkInForm.purpose}
              onChange={(event) => setWalkInForm((prev) => ({ ...prev, purpose: event.target.value }))}
              placeholder="Ej. Practica corta, apoyo docente, prueba de equipo"
              minLength={8}
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
            <button type="submit" className="reservations-primary" disabled={!canManage || !isWalkInFormValid}>
              Registrar walk-in
            </button>
          </div>
        </form>
          </div>
        </details>
      </section>

      <section className="reservations-panel reservations-panel-secondary">
        <div className="reservations-panel-header">
          <h3>Control de entradas y salidas del dia</h3>
          <p className="reservations-panel-subtitle">
            Desde aqui puedes pasar reservas aprobadas a En curso, completar salidas o marcar Ausente cuando hayan pasado 15 minutos del inicio.
          </p>
        </div>

        {todaysReservations.length === 0 ? (
          <p className="reservations-empty">No hay reservas para hoy.</p>
        ) : (
          <div className="reservation-card-grid">
            {todaysReservations.map((reservation) => {
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
                    <span>{reservation.date} | {reservation.start_time} - {reservation.end_time}</span>
                    <span>Ingreso: {reservation.check_in_time || 'No registrado'} | Salida: {reservation.check_out_time || 'No registrada'}</span>
                    <span>Estacion: {reservation.station_label || 'Sin estacion'}</span>
                    <span>{reservation.purpose || 'Sin motivo registrado'}</span>
                  </div>
                  <div className="reservation-user-card-actions">
                    {reservation.status === 'approved' ? (
                      <button type="button" className="reservations-primary" onClick={() => handleRegisterEntry(reservation)}>
                        Registrar entrada
                      </button>
                    ) : null}
                    {reservation.status === 'in_progress' ? (
                      <button type="button" className="reservations-primary" onClick={() => handleRegisterExit(reservation.id)}>
                        Registrar salida
                      </button>
                    ) : null}
                    {absentEligible ? (
                      <button type="button" className="reservations-danger" onClick={() => handleMarkAbsent(reservation.id)}>
                        Marcar ausente
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {editingReservationId ? (
        <section className="reservations-panel">
          <div className="reservations-panel-header">
            <h3>Editar reserva</h3>
            <p className="reservations-panel-subtitle">
              Si ajustas hora, fecha o laboratorio, se emitira una alerta para el estudiante afectado.
            </p>
          </div>

          <form className="reservations-form" onSubmit={handleSaveEdit}>
            <div className="reservations-form-grid">
              <label>
                <span>Laboratorio</span>
                <select
                  value={draft.laboratory_id}
                  onChange={(event) => setDraft((prev) => ({ ...prev, laboratory_id: event.target.value }))}
                  required
                >
                  <option value="">Selecciona un laboratorio</option>
                  {labs.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Hora de inicio</span>
                <input
                  type="time"
                  value={draft.start_time}
                  onChange={(event) => setDraft((prev) => ({ ...prev, start_time: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Hora de fin</span>
                <input
                  type="time"
                  value={draft.end_time}
                  onChange={(event) => setDraft((prev) => ({ ...prev, end_time: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label>
              <span>Motivo</span>
              <textarea
                rows="3"
                value={draft.purpose}
                onChange={(event) => setDraft((prev) => ({ ...prev, purpose: event.target.value }))}
                minLength={8}
                required
              />
            </label>

            {!isEditChronologyValid ? (
              <p className="reservation-inline-hint">La hora de fin debe ser mayor a la hora de inicio.</p>
            ) : null}

            <div className="reservations-actions">
              <button type="submit" className="reservations-primary" disabled={!canManage || !isEditFormValid}>Guardar cambios</button>
              <button type="button" className="reservations-secondary" onClick={handleCancelEdit}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="reservations-panel reservations-panel-priority">
        <div className="reservations-panel-header">
          <h3>Solicitudes de reserva</h3>
          <p className="reservations-panel-subtitle">
            Revisa y responde primero las solicitudes pendientes. Usa los filtros avanzados solo cuando necesites busquedas mas especificas.
          </p>
        </div>

        <form className="reservations-form" onSubmit={handleApplyTableFilters}>
          <div className="reservations-controls">
            <label>
              <span>Filtrar por estado</span>
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
                {labs.map((lab) => (
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
                  Si dejas este campo vacio, al aplicar filtros se genera automaticamente desde estado, laboratorio y fecha.
                </small>
              </label>

              <label>
                <span>Ejemplos rapidos de where</span>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const selectedWhere = event.target.value
                    if (!selectedWhere) return
                    setTableFilters((previous) => ({ ...previous, where: selectedWhere }))
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
            Mostrando {visibleRangeStart}-{visibleRangeEnd} de {tableMeta.totalElements} reservas
          </span>
          <span>
            Pagina {tableMeta.totalPages === 0 ? 0 : tableMeta.pageNumber + 1} de {tableMeta.totalPages}
          </span>
        </div>

        {tableLoading ? (
          <p className="reservations-empty">Cargando reservas...</p>
        ) : tableReservations.length === 0 ? (
          <p className="reservations-empty">No hay reservas para este filtro.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Laboratorio</th>
                <th>Solicitante</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tableReservations.map((item) => (
                <tr key={item.id} className={rejectingReservationId === item.id ? 'reservation-row-rejecting' : ''}>
                  <td>
                    <strong>{getReservationLabLabel(item)}</strong>
                    <div>{item.purpose || 'Sin motivo registrado'}</div>
                  </td>
                  <td>
                    <strong>{getReservationRequesterName(item)}</strong>
                    <div>{getReservationRequesterEmail(item)}</div>
                  </td>
                  <td>{item.date}</td>
                  <td>{item.start_time} - {item.end_time}</td>
                  <td><span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span></td>
                  <td>
                    {(() => {
                      const isFinalStatus = FINAL_RESERVATION_STATUSES.has(item.status)
                      return (
                    <div className="reservations-actions">
                      <button
                        type="button"
                        className="reservations-secondary"
                        disabled={!canManage || isFinalStatus}
                        onClick={() => handleStartEdit(item)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="reservations-primary"
                        disabled={!canManage || item.status === 'approved' || isFinalStatus}
                        onClick={() => handleUpdateStatus(item.id, 'approved')}
                      >
                        Aprobar
                      </button>
                      {item.status === 'approved' ? (
                        <button type="button" className="reservations-primary" onClick={() => handleRegisterEntry(item)}>
                          Entrada
                        </button>
                      ) : null}
                      {item.status === 'in_progress' ? (
                        <button type="button" className="reservations-primary" onClick={() => handleRegisterExit(item.id)}>
                          Salida
                        </button>
                      ) : null}
                      {item.status === 'approved' && minutesSinceStart(item) >= 15 ? (
                        <button type="button" className="reservations-danger" onClick={() => handleMarkAbsent(item.id)}>
                          Ausente
                        </button>
                      ) : null}
                      {rejectingReservationId === item.id ? (
                        <button
                          type="button"
                          className="reservations-secondary"
                          onClick={handleCancelReject}
                        >
                          Cerrar rechazo
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="reservations-danger"
                          disabled={!canManage || item.status === 'rejected' || isFinalStatus}
                          onClick={() => handleStartReject(item)}
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                      )
                    })()}

                    {rejectingReservationId === item.id ? (
                      <div className="reservation-reject-box">
                        <label>
                          <span>Motivo de rechazo</span>
                          <textarea
                            rows="3"
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            placeholder="Explica por que esta solicitud no puede aprobarse."
                            required
                          />
                        </label>
                        <div className="reservations-actions">
                          <button
                            type="button"
                            className="reservations-danger"
                            disabled={!rejectionReason.trim()}
                            onClick={() => handleConfirmReject(item.id)}
                          >
                            Confirmar rechazo
                          </button>
                          <button
                            type="button"
                            className="reservations-secondary"
                            onClick={handleCancelReject}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </section>
  )
}

export default AdminReservationsPage
