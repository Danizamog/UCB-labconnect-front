import { useEffect, useMemo, useState } from 'react'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import {
  createReservation,
  deleteReservation,
  getLabAvailability,
  isLabAccessibleToUser,
  listAvailableLabs,
  listMyPenalties,
  listReservations,
  subscribeReservationsRealtime,
  updateReservation,
} from '../services/reservationsService'
import ReservationEditModal from './ReservationEditModal'
import './ReservationsPages.css'

const defaultForm = {
  laboratory_id: '',
  date: new Date().toISOString().slice(0, 10),
  start_time: '08:00',
  end_time: '09:00',
  purpose: '',
}

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' }
const FOCUSED_RESERVATION_KEY = 'labconnect.focus_reservation_id'
const OPEN_RESERVATION_EVENT = 'labconnect:open-reservation-details'
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

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

  return {
    hasStarted,
    withinTwoHours,
    canModify: isMutableStatus && !hasStarted && !withinTwoHours,
    canCancel: isMutableStatus && !hasStarted,
  }
}

function getSlotKey(slot) {
  return `${slot.start_time}-${slot.end_time}`
}

function getSlotTone(slot) {
  if (slot.state === 'blocked' && slot.status === 'maintenance') {
    return 'maintenance'
  }

  if (slot.state === 'blocked') {
    return 'blocked-other'
  }

  if (slot.state === 'occupied') {
    return 'busy'
  }

  return 'available'
}

function getSlotLabel(slot) {
  if (slot.state === 'blocked' && slot.status === 'maintenance') {
    return 'Mantenimiento'
  }

  if (slot.state === 'blocked') {
    return 'Bloqueado'
  }

  if (slot.state === 'occupied') {
    return 'Ocupado'
  }

  return 'Disponible'
}

function UserReserveLabPage({ user, notifications = [], onMarkNotificationAsRead }) {
  const [labs, setLabs] = useState([])
  const [reservations, setReservations] = useState([])
  const [penalties, setPenalties] = useState([])
  const [slots, setSlots] = useState([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [editingReservation, setEditingReservation] = useState(null)
  const [editForm, setEditForm] = useState(defaultForm)
  const [focusedReservationId, setFocusedReservationId] = useState('')
  const [reservationToCancel, setReservationToCancel] = useState(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const [availabilityRefreshNonce, setAvailabilityRefreshNonce] = useState(0)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = async () => {
    try {
      const [labsData, reservationsData, penaltiesData] = await Promise.all([
        listAvailableLabs(user),
        listReservations(),
        listMyPenalties(),
      ])
      setLabs(labsData)
      setReservations(reservationsData)
      setPenalties(penaltiesData)
      if (!form.laboratory_id && labsData.length > 0) {
        setForm((prev) => ({ ...prev, laboratory_id: labsData[0].id }))
      }
      setError(labsData.length === 0 ? 'No tienes permisos para reservar en los laboratorios disponibles actualmente.' : '')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion para reservar.')
    }
  }

  useEffect(() => {
    loadData()

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'lab_reservation') {
        loadData()
        setAvailabilityRefreshNonce((value) => value + 1)
        return
      }

      if (event?.topic === 'user_penalty') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserPenalty =
          event?.record?.user_id === (user?.user_id || '') ||
          recipients.includes(user?.user_id || '')

        if (isCurrentUserPenalty) {
          loadData()
          setMessage('Tu estado de penalizacion fue actualizado.')
        }
        return
      }

      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === (user?.user_id || '') ||
          recipients.includes(user?.user_id || '')

        if (isCurrentUserNotification) {
          setMessage('Tienes una nueva notificacion relacionada con tus reservas.')
        }
      }
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

    const loadAvailability = async () => {
      if (!form.laboratory_id || !form.date || !selectedLabIsAccessible) {
        if (mounted) {
          setSlots([])
          setSelectedSlotKey('')
        }
        return
      }

      setIsLoadingSlots(true)
      try {
        const payload = await getLabAvailability(form.laboratory_id, form.date)
        if (!mounted) {
          return
        }

        const nextSlots = Array.isArray(payload?.slots) ? payload.slots : []
        setSlots(nextSlots)

        const currentFormKey = `${form.start_time}-${form.end_time}`
        const matchingAvailableSlot = nextSlots.find(
          (slot) => getSlotKey(slot) === currentFormKey && slot.state === 'available',
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

    loadAvailability()
    return () => {
      mounted = false
    }
  }, [availabilityRefreshNonce, form.date, form.laboratory_id, selectedLabIsAccessible])

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )

  const selectedSlot = useMemo(
    () => slots.find((slot) => getSlotKey(slot) === selectedSlotKey) || null,
    [selectedSlotKey, slots],
  )

  const activePenalty = useMemo(
    () => penalties.find((penalty) => penalty.is_active) || null,
    [penalties],
  )

  const canSubmitReservation = Boolean(
    selectedLab &&
    selectedLabIsAccessible &&
    !activePenalty &&
    selectedSlot &&
    selectedSlot.state === 'available' &&
    form.purpose.trim(),
  )

  const myReservations = useMemo(
    () => reservations.filter((item) => item.requested_by === (user?.user_id || '')).slice(-8).reverse(),
    [reservations, user],
  )

  const focusedReservation = useMemo(
    () => myReservations.find((item) => item.id === focusedReservationId) || null,
    [focusedReservationId, myReservations],
  )

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!selectedLabIsAccessible) {
      setError('No tienes permisos para reservar este laboratorio.')
      return
    }

    if (activePenalty) {
      setError(`Tu cuenta esta suspendida temporalmente. Motivo: ${activePenalty.reason}`)
      return
    }

    if (!selectedSlot || selectedSlot.state !== 'available') {
      setError('Debes seleccionar un bloque horario disponible antes de confirmar la reserva.')
      return
    }

    try {
      await createReservation(
        {
          ...form,
          laboratory_name: selectedLab?.name || '',
          area_id: selectedLab?.area_id || '',
          area_name: selectedLab?.area_name || '',
        },
        user,
      )
      setMessage('Reserva enviada correctamente. Queda pendiente de aprobacion.')
      setSelectedSlotKey('')
      setForm((prev) => ({
        ...defaultForm,
        laboratory_id: prev.laboratory_id || defaultForm.laboratory_id,
        date: prev.date || defaultForm.date,
        start_time: '',
        end_time: '',
      }))
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo crear la reserva.')
    }
  }

  const openEditModal = (reservation) => {
    setEditingReservation(reservation)
    setFocusedReservationId(reservation.id)
    setEditForm({
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

  const closeEditModal = () => {
    setEditingReservation(null)
    setEditForm(defaultForm)
    setIsSavingEdit(false)
  }

  const handleEditFormChange = (field, value) => {
    setEditForm((previous) => ({ ...previous, [field]: value }))
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
      const selectedEditLab = labs.find((lab) => String(lab.id) === String(editForm.laboratory_id))
      const updatedReservation = await updateReservation(editingReservation.id, {
        ...editForm,
        area_id: selectedEditLab?.area_id || '',
      })
      const wasApproved = editingReservation.status === 'approved'
      setMessage(
        wasApproved
          ? 'La reserva fue actualizada y regreso a pendiente de aprobacion para una nueva revision.'
          : 'Reserva actualizada correctamente.',
      )
      setFocusedReservationId(updatedReservation.id)
      closeEditModal()
      await loadData()
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
        setFocusedReservationId('')
      }
      setMessage(
        wasApproved
          ? 'La reserva aprobada fue cancelada. El horario quedo libre nuevamente y el encargado recibira una alerta.'
          : 'La reserva fue cancelada correctamente y el horario quedo disponible.',
      )
      await loadData()
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

  return (
    <section className="reservations-page" aria-label="Reservar laboratorio">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Solicitud de uso</p>
          <h2>Reservar laboratorio por horas</h2>
          <p>Completa los datos para registrar una solicitud y administra tus reservas con cambios o cancelaciones cuando aun haya tiempo disponible.</p>
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

      {focusedReservation ? (
        <section className="reservations-panel reservation-focus-panel">
          <div className="reservations-panel-header">
            <h3>Detalle de la reserva seleccionada</h3>
            <p className="reservations-panel-subtitle">
              Esta vista se abre al entrar desde una notificacion de confirmacion, rechazo o cambio.
            </p>
          </div>

          <div className="reservation-focus-grid">
            <div className="reservation-focus-card">
              <span>Laboratorio</span>
              <strong>{focusedReservation.laboratory_name || labNameById[String(focusedReservation.laboratory_id)] || 'Laboratorio'}</strong>
            </div>
            <div className="reservation-focus-card">
              <span>Fecha</span>
              <strong>{focusedReservation.date}</strong>
            </div>
            <div className="reservation-focus-card">
              <span>Horario</span>
              <strong>{focusedReservation.start_time} - {focusedReservation.end_time}</strong>
            </div>
            <div className="reservation-focus-card">
              <span>Estado</span>
              <strong className={`reservation-focus-status ${focusedReservation.status}`}>
                {STATUS_LABELS[focusedReservation.status] ?? focusedReservation.status}
              </strong>
            </div>
          </div>

          <div className="reservation-focus-copy">
            <p><strong>Motivo:</strong> {focusedReservation.purpose || 'Sin motivo registrado'}</p>
            {focusedReservation.cancel_reason ? (
              <p><strong>Motivo de rechazo:</strong> {focusedReservation.cancel_reason}</p>
            ) : null}
          </div>

          <div className="reservations-actions">
            {getReservationActionState(focusedReservation).canModify ? (
              <button
                type="button"
                className="reservations-secondary"
                onClick={() => openEditModal(focusedReservation)}
              >
                Modificar reserva
              </button>
            ) : null}
            {getReservationActionState(focusedReservation).canCancel ? (
              <button
                type="button"
                className="reservations-danger"
                onClick={() => handleRequestCancel(focusedReservation)}
              >
                Cancelar reserva
              </button>
            ) : null}
            <button
              type="button"
              className="reservations-secondary"
              onClick={() => setFocusedReservationId('')}
            >
              Cerrar detalle
            </button>
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
              const isReminder = notification.type === 'reservation_reminder'
              const isPenaltyNotification = notification.type === 'penalty_applied' || notification.type === 'penalty_lifted'
              const showSchedule = notification.change_kinds.includes('schedule')
              const showLocation = notification.change_kinds.includes('location')
              const oldLabName = labNameById[String(notification.old_laboratory_id)] || notification.old_laboratory_id || 'Sin laboratorio'
              const newLabName = labNameById[String(notification.new_laboratory_id)] || notification.new_laboratory_id || 'Sin laboratorio'
              const reminderLabName =
                labNameById[String(notification.reminder_laboratory_id)] ||
                notification.reminder_laboratory_id ||
                'Sin laboratorio'
              const reminderToneClass = notification.reminder_kind === '30m' ? ' is-reminder-urgent' : ' is-reminder'

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
                        <strong className="reservation-notification-new">
                          {notification.reminder_date} · {notification.reminder_time}
                        </strong>
                      </div>
                      <div className="reservation-notification-change">
                        <span>Laboratorio</span>
                        <strong>{reminderLabName}</strong>
                      </div>
                      <div className="reservation-notification-change">
                        <span>Ventana</span>
                        <strong>{notification.reminder_kind === '30m' ? 'Faltan 30 minutos' : 'Faltan 24 horas'}</strong>
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
                  ) : (
                    <div className="reservation-notification-diff">
                      {showSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario anterior</span>
                          <strong className="reservation-notification-old">
                            {notification.old_date} · {notification.old_time_range}
                          </strong>
                        </div>
                      ) : null}

                      {showSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario nuevo</span>
                          <strong className="reservation-notification-new">
                            {notification.new_date} · {notification.new_time_range}
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
          <div className="reservations-form-section">
            <span className="reservations-form-section-label">1 - Laboratorio</span>
            <label>
              <span>Laboratorio</span>
              <select
                value={form.laboratory_id}
                onChange={(event) => setForm((prev) => ({
                  ...prev,
                  laboratory_id: event.target.value,
                  start_time: '',
                  end_time: '',
                }))}
                disabled={Boolean(activePenalty)}
                required
              >
                <option value="">Selecciona un laboratorio</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>
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
                    <span className="reservation-slot-legend-item maintenance">
                      <span className="reservation-slot-legend-dot" /> Mantenimiento
                    </span>
                    <span className="reservation-slot-legend-item blocked-other">
                      <span className="reservation-slot-legend-dot" /> Bloqueado
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
                      const isAvailable = slot.state === 'available'
                      return (
                        <button
                          key={slotKey}
                          type="button"
                          className={`reservations-slot ${getSlotTone(slot)}${isSelected ? ' is-selected' : ''}`}
                          disabled={!isAvailable || !selectedLabIsAccessible || Boolean(activePenalty)}
                          onClick={() => {
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
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">3 - Motivo</span>
            <label>
              <span>Motivo de la reserva</span>
              <textarea
                rows="4"
                value={form.purpose}
                onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                placeholder="Ej. Practica de laboratorio de redes, proyecto de tesis..."
                disabled={Boolean(activePenalty)}
                required
              />
            </label>
          </div>

          <div className="reservations-actions">
            <button type="submit" className="reservations-primary" disabled={!canSubmitReservation}>
              {activePenalty ? 'Reserva bloqueada' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </section>

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Mis ultimas reservas</h3>
          <p className="reservations-panel-subtitle">
            Puedes modificar una reserva hasta 2 horas antes de su inicio. Las reservas ya transcurridas se muestran sin acciones.
          </p>
        </div>
        {myReservations.length === 0 ? (
          <p className="reservations-empty">Aun no tienes reservas registradas.</p>
        ) : (
          <div className="reservation-card-grid">
            {myReservations.map((item) => {
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
                      onClick={() => setFocusedReservationId(item.id)}
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

                  {actionState.hasStarted ? (
                    <p className="reservation-inline-hint">
                      Esta reserva ya transcurrio. Las acciones de modificar y cancelar ya no estan disponibles.
                    </p>
                  ) : null}

                  {!actionState.hasStarted && actionState.withinTwoHours ? (
                    <p className="reservation-inline-hint">
                      Faltan menos de 2 horas para el inicio, por eso el boton de modificar esta deshabilitado.
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <ReservationEditModal
        reservation={editingReservation}
        labs={labs}
        form={editForm}
        onChange={handleEditFormChange}
        onSubmit={handleEditSubmit}
        onClose={closeEditModal}
        isSubmitting={isSavingEdit}
      />

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
    </section>
  )
}

export default UserReserveLabPage
