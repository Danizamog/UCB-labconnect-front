import { useEffect, useMemo, useState } from 'react'
import {
  getLabAvailability,
  listAvailableLabs,
  subscribeReservationsRealtime,
} from '../services/reservationsService'
import './ReservationsPages.css'

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function formatWeekRange(weekDays) {
  if (!weekDays.length) return ''
  const first = new Date(weekDays[0] + 'T00:00:00')
  const last = new Date(weekDays[6] + 'T00:00:00')
  const startStr = `${first.getDate()} ${MESES[first.getMonth()]}`
  const endStr = first.getMonth() === last.getMonth()
    ? `${last.getDate()} ${MESES[last.getMonth()]} ${last.getFullYear()}`
    : `${last.getDate()} ${MESES[last.getMonth()]} ${last.getFullYear()}`
  return `${startStr} – ${endStr}`
}

function formatSelectedDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DIAS_LARGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
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

function UserAvailabilityCalendarPage({ user }) {
  const today = new Date().toISOString().slice(0, 10)

  const [labs, setLabs] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedLab, setSelectedLab] = useState('')
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const labsData = await listAvailableLabs(user)
      setLabs(labsData)
      if (!selectedLab && labsData.length > 0) {
        setSelectedLab(labsData[0].id)
      }
      setError(labsData.length === 0 ? 'No tienes permisos para reservar en los laboratorios disponibles actualmente.' : '')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la disponibilidad.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    let mounted = true
    const loadAvailability = async () => {
      if (!selectedLab || !selectedDate) {
        if (mounted) setSlots([])
        return
      }
      try {
        const payload = await getLabAvailability(selectedLab, selectedDate)
        if (mounted) {
          setSlots(Array.isArray(payload?.slots) ? payload.slots : [])
          setError('')
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'No se pudo cargar la disponibilidad del laboratorio.')
          setSlots([])
        }
      }
    }
    loadAvailability()
    return () => { mounted = false }
  }, [selectedDate, selectedLab])

  useEffect(() => {
    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (!event?.topic || event.topic !== 'lab_reservation') return
      if (selectedLab && selectedDate) {
        getLabAvailability(selectedLab, selectedDate)
          .then((payload) => setSlots(Array.isArray(payload?.slots) ? payload.slots : []))
          .catch(() => {})
      }
    })
    return () => unsubscribe?.()
  }, [selectedDate, selectedLab])

  const mappedSlots = useMemo(() => {
    return slots.map((slot) => ({
      ...slot,
      busyBy: slot.state === 'occupied' || slot.state === 'blocked',
    }))
  }, [slots])

  const weekDays = useMemo(() => {
    const days = []
    const start = new Date(weekStart + 'T00:00:00')
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d.toISOString().slice(0, 10))
    }
    return days
  }, [weekStart])

  const goToPrevWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekStart(d.toISOString().slice(0, 10))
  }

  const goToNextWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    setWeekStart(d.toISOString().slice(0, 10))
  }

  const goToToday = () => {
    setWeekStart(getMonday(today))
    setSelectedDate(today)
  }

  const availableCount = mappedSlots.filter((s) => !s.busyBy).length
  const busyCount = mappedSlots.filter((s) => s.busyBy).length

  return (
    <section className="reservations-page" aria-label="Calendario de disponibilidad">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Reserva de laboratorios</p>
          <h2>Calendario de disponibilidad</h2>
          <p>Elige un laboratorio, navega la semana y selecciona un día para ver los horarios.</p>
        </div>
      </header>

      {error ? <p className="reservations-message error">{error}</p> : null}

      {/* Selector de laboratorio */}
      <section className="reservations-panel">
        <div className="reservations-controls cal-lab-controls">
          <label>
            <span>Laboratorio</span>
            <select value={selectedLab} onChange={(event) => setSelectedLab(event.target.value)}>
              <option value="">Selecciona un laboratorio</option>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Calendario semanal */}
      <section className="reservations-panel cal-panel">
        <div className="cal-week-nav">
          <button type="button" className="cal-nav-btn" onClick={goToPrevWeek} aria-label="Semana anterior">
            ‹
          </button>
          <div className="cal-week-center">
            <span className="cal-week-range">{formatWeekRange(weekDays)}</span>
            <button type="button" className="cal-today-btn" onClick={goToToday}>Hoy</button>
          </div>
          <button type="button" className="cal-nav-btn" onClick={goToNextWeek} aria-label="Semana siguiente">
            ›
          </button>
        </div>

        <div className="cal-week-grid">
          {weekDays.map((dateStr) => {
            const d = new Date(dateStr + 'T00:00:00')
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === today
            return (
              <button
                key={dateStr}
                type="button"
                className={`cal-day${isSelected ? ' cal-day--selected' : ''}${isToday ? ' cal-day--today' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="cal-day-name">{DIAS_CORTOS[d.getDay()]}</span>
                <span className="cal-day-num">{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Horarios del día seleccionado */}
      {selectedLab ? (
        <section className="reservations-panel">
          <div className="cal-slots-header">
            <h3 className="cal-slots-title">{formatSelectedDate(selectedDate)}</h3>
            {mappedSlots.length > 0 && (
              <div className="cal-slots-legend">
                <span className="cal-legend-item cal-legend--available">
                  <span className="cal-legend-dot" /> {availableCount} libre{availableCount !== 1 ? 's' : ''}
                </span>
                <span className="cal-legend-item cal-legend--busy">
                  <span className="cal-legend-dot" /> {busyCount} ocupado{busyCount !== 1 ? 's' : ''}
                </span>
                <span className="reservation-slot-legend-item maintenance">
                  <span className="reservation-slot-legend-dot" /> Mantenimiento
                </span>
                <span className="reservation-slot-legend-item blocked-other">
                  <span className="reservation-slot-legend-dot" /> Bloqueado
                </span>
              </div>
            )}
          </div>
          {mappedSlots.length === 0 ? (
            <p className="reservations-empty">No hay horarios disponibles para este día.</p>
          ) : (
            <div className="reservations-slots">
              {mappedSlots.map((slot) => (
                <article
                  key={slot.start_time}
                  className={`reservations-slot ${getSlotTone(slot)}`}
                >
                  <strong>{slot.start_time} – {slot.end_time}</strong>
                  <span>{getSlotLabel(slot)}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="reservations-panel">
          <p className="reservations-empty">Selecciona un laboratorio para ver disponibilidad.</p>
        </section>
      )}
    </section>
  )
}

export default UserAvailabilityCalendarPage
