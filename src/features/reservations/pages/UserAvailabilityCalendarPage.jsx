import { useEffect, useMemo, useState } from 'react'
import {
  getAreas,
  getDayAvailability,
  getLabs,
  getWeekAvailability,
  subscribeReservationsRealtime,
} from '../api/reservationsApi'
import './UserAvailabilityCalendarPage.css'

const OPENING_HOUR = 7
const CLOSING_HOUR = 21
const DAY_SLOT_HEIGHT = 54
const WEEK_SLOT_HEIGHT = 42

function formatDateLabel(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatModalDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-BO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function getWeekStart(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

function formatWeekday(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('es-BO', {
    weekday: 'short',
    day: '2-digit',
  })
}

function statusLabel(status) {
  if (status === 'available') return 'Disponible'
  if (status === 'partial') return 'Parcial'
  if (status === 'occupied') return 'Ocupado'
  return status || 'Disponible'
}

function eventTypeLabel(event) {
  if (event?.event_label) return event.event_label
  if (event?.type === 'class') return 'Clase'
  if (event?.type === 'tutorial') return 'Tutoria'
  if (event?.type === 'guest') return 'Invitado'
  if (event?.type === 'practice') return 'Reserva de practica'
  return 'Evento'
}

function eventStatusLabel(status) {
  if (status === 'approved') return 'Aprobada'
  if (status === 'pending') return 'Pendiente'
  if (status === 'rejected') return 'Rechazada'
  if (status === 'cancelled') return 'Cancelada'
  if (status === 'scheduled') return 'Programada'
  return status || 'Programada'
}

function buildHourSlots() {
  const slots = []
  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour += 1) {
    slots.push({
      start_time: `${String(hour).padStart(2, '0')}:00`,
      end_time: `${String(hour + 1).padStart(2, '0')}:00`,
      label: `${String(hour).padStart(2, '0')}:00`,
      status: 'available',
    })
  }
  return slots
}

function timeToMinutes(value) {
  if (!value) return OPENING_HOUR * 60
  const [hours, minutes] = value.split(':').map(Number)
  return (Number.isNaN(hours) ? OPENING_HOUR : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes)
}

function buildEventStyle(event, slotHeight) {
  const openMinutes = OPENING_HOUR * 60
  const closeMinutes = CLOSING_HOUR * 60
  const startMinutes = Math.max(timeToMinutes(event.start_time), openMinutes)
  const endMinutes = Math.min(timeToMinutes(event.end_time), closeMinutes)
  const durationMinutes = Math.max(endMinutes - startMinutes, 30)

  return {
    top: `${((startMinutes - openMinutes) / 60) * slotHeight}px`,
    height: `${Math.max((durationMinutes / 60) * slotHeight, 32)}px`,
  }
}

function normalizeEvent(item) {
  return {
    ...item,
    title: item?.title || 'Evento sin titulo',
    subject_name: item?.subject_name || item?.title || 'Evento sin titulo',
    reserved_by: item?.reserved_by || 'Usuario institucional',
    owner_label: item?.owner_label || 'Responsable',
    event_label: item?.event_label || eventTypeLabel(item),
    notes: item?.notes || '',
    support_topic: item?.support_topic || '',
    status: item?.status || 'scheduled',
  }
}

function normalizeTimeSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return buildHourSlots()
  }

  return slots.map((slot) => ({
    ...slot,
    status: slot?.status || 'available',
  }))
}

function normalizeDayAvailability(items) {
  if (!Array.isArray(items)) return []
  return items.map((lab) => ({
    ...lab,
    status: lab?.status || 'available',
    reservations: Array.isArray(lab?.reservations) ? lab.reservations.map(normalizeEvent) : [],
    time_slots: normalizeTimeSlots(lab?.time_slots),
    occupied_slots: Number(lab?.occupied_slots || 0),
    total_slots: Number(lab?.total_slots || CLOSING_HOUR - OPENING_HOUR),
  }))
}

function normalizeWeekAvailability(items) {
  if (!Array.isArray(items)) return []
  return items.map((lab) => ({
    ...lab,
    days: Array.isArray(lab?.days)
      ? lab.days.map((day) => ({
          ...day,
          status: day?.status || 'available',
          reservations: Array.isArray(day?.reservations) ? day.reservations.map(normalizeEvent) : [],
          time_slots: normalizeTimeSlots(day?.time_slots),
          occupied_slots: Number(day?.occupied_slots || 0),
          total_slots: Number(day?.total_slots || CLOSING_HOUR - OPENING_HOUR),
        }))
      : [],
  }))
}

function UserAvailabilityCalendarPage() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token') || ''
  const [mode, setMode] = useState('day')
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [areas, setAreas] = useState([])
  const [labs, setLabs] = useState([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedLabId, setSelectedLabId] = useState('')
  const [availability, setAvailability] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [realtimeTick, setRealtimeTick] = useState(0)

  const hourSlots = useMemo(() => buildHourSlots(), [])
  const dayTrackHeight = hourSlots.length * DAY_SLOT_HEIGHT
  const weekTrackHeight = hourSlots.length * WEEK_SLOT_HEIGHT

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [areasData, labsData] = await Promise.all([getAreas(token), getLabs(token)])
        const activeAreas = areasData.filter((area) => area.is_active)
        const activeLabs = labsData.filter((lab) => lab.is_active !== false)
        setAreas(activeAreas)
        setLabs(activeLabs)
        setSelectedAreaId(activeAreas[0]?.id ? String(activeAreas[0].id) : '')
      } catch (err) {
        setError(err.message || 'No se pudieron cargar las areas y laboratorios')
      }
    }

    loadCatalogs()
  }, [token])

  useEffect(() => {
    if (!token) {
      return undefined
    }

    return subscribeReservationsRealtime(token, {
      onMessage: (message) => {
        if (!message || !['practice_request', 'class_tutorial'].includes(message.entity)) {
          return
        }
        setRealtimeTick((previous) => previous + 1)
      },
    })
  }, [token])

  const filteredLabs = useMemo(() => {
    if (!selectedAreaId) return labs
    return labs.filter((lab) => String(lab.area_id) === String(selectedAreaId))
  }, [labs, selectedAreaId])

  useEffect(() => {
    if (selectedLabId && !filteredLabs.some((lab) => String(lab.id) === String(selectedLabId))) {
      setSelectedLabId('')
    }
  }, [filteredLabs, selectedLabId])

  useEffect(() => {
    const loadAvailability = async () => {
      setLoading(true)
      try {
        const filters = {
          areaId: selectedAreaId ? Number(selectedAreaId) : null,
          laboratoryId: selectedLabId ? Number(selectedLabId) : null,
        }
        const data =
          mode === 'day'
            ? await getDayAvailability(selectedDate, token, filters)
            : await getWeekAvailability(getWeekStart(selectedDate), token, filters)

        setAvailability(mode === 'day' ? normalizeDayAvailability(data) : normalizeWeekAvailability(data))
        setError('')
      } catch (err) {
        setError(err.message || 'No se pudo cargar la disponibilidad')
        setAvailability([])
      } finally {
        setLoading(false)
      }
    }

    if (areas.length > 0 || labs.length > 0) {
      loadAvailability()
    }
  }, [areas.length, labs.length, mode, realtimeTick, selectedAreaId, selectedDate, selectedLabId, token])

  const currentArea = areas.find((area) => String(area.id) === String(selectedAreaId))
  const weekRangeStart = getWeekStart(selectedDate)
  const weekRangeEnd = addDays(weekRangeStart, 6)

  const switchMode = (nextMode) => {
    setSelectedEvent(null)
    setLoading(true)
    setAvailability([])
    setMode(nextMode)
  }

  const openEventDetails = (event, laboratoryName, date) => {
    setSelectedEvent({
      ...event,
      laboratory_name: laboratoryName,
      date,
    })
  }

  return (
    <section className="availability-page" aria-label="Calendario de disponibilidad">
      <header className="availability-hero">
        <div>
          <p className="availability-kicker">Calendario dinamico</p>
          <h2>Consulta laboratorios disponibles por hora, dia o semana</h2>
          <p>
            Filtra por area y laboratorio para revisar bloques reales de disponibilidad.
            Verde significa libre y rojo indica que el horario ya esta ocupado.
          </p>
        </div>
        <div className="availability-legend">
          <span className="available">Horario libre</span>
          <span className="partial">Dia parcialmente ocupado</span>
          <span className="occupied">Bloque ocupado</span>
        </div>
      </header>

      {error ? <p className="availability-alert">{error}</p> : null}

      <section className="availability-toolbar-card">
        <div className="availability-toolbar">
          <div className="availability-mode">
            <button
              type="button"
              className={mode === 'day' ? 'active' : ''}
              onClick={() => switchMode('day')}
            >
              Dia
            </button>
            <button
              type="button"
              className={mode === 'week' ? 'active' : ''}
              onClick={() => switchMode('week')}
            >
              Semana
            </button>
          </div>

          <label>
            <span>Area</span>
            <select value={selectedAreaId} onChange={(event) => setSelectedAreaId(event.target.value)}>
              <option value="">Todas las areas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Laboratorio</span>
            <select value={selectedLabId} onChange={(event) => setSelectedLabId(event.target.value)}>
              <option value="">Todos los laboratorios</option>
              {filteredLabs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{mode === 'day' ? 'Fecha' : 'Semana de referencia'}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>

        <div className="availability-range-bar">
          <button
            type="button"
            onClick={() => setSelectedDate(addDays(selectedDate, mode === 'day' ? -1 : -7))}
          >
            {mode === 'day' ? 'Dia anterior' : 'Semana anterior'}
          </button>
          <strong>
            {mode === 'day'
              ? `${formatDateLabel(selectedDate)}${currentArea ? ` · ${currentArea.name}` : ''}`
              : `${formatDateLabel(weekRangeStart)} - ${formatDateLabel(weekRangeEnd)}`}
          </strong>
          <button
            type="button"
            onClick={() => setSelectedDate(addDays(selectedDate, mode === 'day' ? 1 : 7))}
          >
            {mode === 'day' ? 'Dia siguiente' : 'Semana siguiente'}
          </button>
        </div>
      </section>

      {loading ? (
        <p className="availability-empty">Cargando disponibilidad...</p>
      ) : mode === 'day' ? (
        <div className="availability-day-list">
          {availability.length === 0 ? (
            <p className="availability-empty">No hay laboratorios para este filtro.</p>
          ) : (
            availability.map((lab) => (
              <article key={lab.laboratory_id} className="availability-day-card">
                <div className="availability-day-head">
                  <div>
                    <h3>{lab.laboratory_name}</h3>
                    <p>
                      {lab.occupied_slots}/{lab.total_slots} horas ocupadas para la fecha seleccionada
                    </p>
                  </div>
                  <span className={`status ${lab.status}`}>{statusLabel(lab.status)}</span>
                </div>

                <div className="availability-schedule-shell">
                  <div className="availability-time-rail" style={{ '--slot-height': `${DAY_SLOT_HEIGHT}px` }}>
                    {hourSlots.map((slot) => (
                      <span key={slot.start_time}>{slot.label}</span>
                    ))}
                  </div>

                  <div className="availability-track-panel">
                    <div
                      className="availability-track"
                      style={{
                        '--slot-count': hourSlots.length,
                        '--slot-height': `${DAY_SLOT_HEIGHT}px`,
                        height: `${dayTrackHeight}px`,
                      }}
                    >
                      <div className="availability-slot-grid">
                        {lab.time_slots.map((slot) => (
                          <div key={`${lab.laboratory_id}-${slot.start_time}`} className={`availability-slot-cell ${slot.status}`} />
                        ))}
                      </div>

                      <div className="availability-event-layer">
                        {lab.reservations.map((event) => (
                          <button
                            key={`${event.type}-${event.id}`}
                            type="button"
                            className={`availability-event-block ${event.type}`}
                            style={buildEventStyle(event, DAY_SLOT_HEIGHT)}
                            onClick={() => openEventDetails(event, lab.laboratory_name, selectedDate)}
                          >
                            <span>{eventTypeLabel(event)}</span>
                            <strong>{event.title}</strong>
                            <small>{event.start_time} - {event.end_time}</small>
                          </button>
                        ))}
                      </div>
                    </div>

                    {lab.reservations.length === 0 ? (
                      <div className="availability-free-state">
                        Sin clases ni reservas para el dia seleccionado.
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="availability-week-grid">
          {availability.length === 0 ? (
            <p className="availability-empty">No hay laboratorios para este filtro.</p>
          ) : (
            availability.map((lab) => (
              <article key={lab.laboratory_id} className="availability-week-card">
                <div className="availability-week-head">
                  <div>
                    <h3>{lab.laboratory_name}</h3>
                    <p>Semana operativa con detalle por bloques horarios.</p>
                  </div>
                </div>

                <div className="availability-week-shell">
                  <div className="availability-week-scroll">
                    <div className="availability-week-header-row">
                      <div className="availability-week-corner" />
                      <div className="availability-week-days-header">
                        {lab.days.map((day) => (
                          <div key={`${lab.laboratory_id}-${day.date}`} className={`availability-week-day-summary ${day.status}`}>
                            <strong>{formatWeekday(day.date)}</strong>
                            <span>{day.occupied_slots}/{day.total_slots} h</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="availability-week-body">
                      <div className="availability-time-rail compact" style={{ '--slot-height': `${WEEK_SLOT_HEIGHT}px` }}>
                        {hourSlots.map((slot) => (
                          <span key={`${lab.laboratory_id}-week-${slot.start_time}`}>{slot.label}</span>
                        ))}
                      </div>

                      <div className="availability-week-columns">
                        {lab.days.map((day) => (
                          <div
                            key={`${lab.laboratory_id}-${day.date}-column`}
                            className="availability-week-column"
                            style={{
                              '--slot-count': hourSlots.length,
                              '--slot-height': `${WEEK_SLOT_HEIGHT}px`,
                              height: `${weekTrackHeight}px`,
                            }}
                          >
                            <div className="availability-slot-grid">
                              {day.time_slots.map((slot) => (
                                <div key={`${day.date}-${slot.start_time}`} className={`availability-slot-cell ${slot.status}`} />
                              ))}
                            </div>

                            <div className="availability-event-layer">
                              {day.reservations.map((event) => (
                                <button
                                  key={`${day.date}-${event.type}-${event.id}`}
                                  type="button"
                                  className={`availability-event-block ${event.type} compact`}
                                  style={buildEventStyle(event, WEEK_SLOT_HEIGHT)}
                                  onClick={() => openEventDetails(event, lab.laboratory_name, day.date)}
                                >
                                  <span>{eventTypeLabel(event)}</span>
                                  <strong>{event.title}</strong>
                                  <small>{event.start_time} - {event.end_time}</small>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {selectedEvent ? (
        <div
          className="availability-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="availability-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle del horario ocupado"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="availability-modal-head">
              <div>
                <p className="availability-modal-kicker">{eventTypeLabel(selectedEvent)}</p>
                <h3>{selectedEvent.subject_name || selectedEvent.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)}>
                Cerrar
              </button>
            </div>

            <div className="availability-modal-grid">
              <div>
                <span>Laboratorio</span>
                <strong>{selectedEvent.laboratory_name}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>{formatModalDate(selectedEvent.date)}</strong>
              </div>
              <div>
                <span>Horario</span>
                <strong>{selectedEvent.start_time} - {selectedEvent.end_time}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{eventStatusLabel(selectedEvent.status)}</strong>
              </div>
              <div>
                <span>Usuario</span>
                <strong>{selectedEvent.reserved_by}</strong>
              </div>
              <div>
                <span>Materia o asignatura</span>
                <strong>{selectedEvent.subject_name || selectedEvent.title}</strong>
              </div>
            </div>

            {selectedEvent.notes ? (
              <div className="availability-modal-notes">
                <span>Notas</span>
                <p>{selectedEvent.notes}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default UserAvailabilityCalendarPage
