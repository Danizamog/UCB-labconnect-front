import { useCallback, useEffect, useMemo, useState } from 'react'
import { getTutorialSessionById } from '../../tutorials/services/tutorialSessionsService'
import TutorialSessionDetailModal from '../../tutorials/pages/TutorialSessionDetailModal'
import { openTutorialSessionFlow } from '../../tutorials/utils/focusTutorialNavigation'
import {
  getLabAvailability,
  listAvailableLabs,
  subscribeReservationsRealtime,
} from '../services/reservationsService'
import './ReservationsPages.css'

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function todayLocalDateString() {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonday(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatWeekRange(weekDays) {
  if (!weekDays.length) {
    return ''
  }

  const first = new Date(`${weekDays[0]}T00:00:00`)
  const last = new Date(`${weekDays[6]}T00:00:00`)
  const startStr = `${first.getDate()} ${MESES[first.getMonth()]}`
  const endStr = `${last.getDate()} ${MESES[last.getMonth()]} ${last.getFullYear()}`
  return `${startStr} - ${endStr}`
}

function formatSelectedDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${DIAS_LARGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function getSlotTone(slot) {
  if (slot.source === 'tutorial_session') {
    return 'tutorial'
  }

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
  if (slot.source === 'tutorial_session') {
    return 'Tutoria'
  }

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
      hint: 'Esta sesion te llevara a la cartelera de tutorias con este bloque destacado.',
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
      hint: 'Esta sesion ya no tiene cupos, pero puedes revisar su detalle completo en la cartelera de tutorias.',
    }
  }

  return {
    label: 'Inscribirme',
    hint: 'Te llevaremos a la cartelera de tutorias con esta sesion destacada para completar tu inscripcion.',
  }
}

function UserAvailabilityCalendarPage({ user }) {
  const today = todayLocalDateString()
  const [labs, setLabs] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedLab, setSelectedLab] = useState('')
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [error, setError] = useState('')
  const [focusedTutorial, setFocusedTutorial] = useState(null)

  const loadLabs = useCallback(async () => {
    try {
      const labsData = await listAvailableLabs(user)
      setLabs(labsData)
      setSelectedLab((previous) => previous || String(labsData[0]?.id || ''))
      setError(labsData.length === 0 ? 'No tienes permisos para reservar en los laboratorios disponibles actualmente.' : '')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la disponibilidad.')
    }
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadLabs()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadLabs])

  useEffect(() => {
    let mounted = true

    const loadAvailability = async () => {
      if (!selectedLab || !selectedDate) {
        if (mounted) {
          setSlots([])
        }
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
    return () => {
      mounted = false
    }
  }, [selectedDate, selectedLab])

  useEffect(() => {
    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (!event?.topic || (event.topic !== 'lab_reservation' && event.topic !== 'tutorial_session')) {
        return
      }

      if (selectedLab && selectedDate) {
        getLabAvailability(selectedLab, selectedDate)
          .then((payload) => setSlots(Array.isArray(payload?.slots) ? payload.slots : []))
          .catch(() => {})
      }
    })

    return () => unsubscribe?.()
  }, [selectedDate, selectedLab])

  const mappedSlots = useMemo(
    () => slots.map((slot) => ({
      ...slot,
      busyBy: slot.state === 'occupied' || slot.state === 'blocked',
    })),
    [slots],
  )

  const weekDays = useMemo(() => {
    const days = []
    const start = new Date(`${weekStart}T00:00:00`)
    for (let index = 0; index < 7; index += 1) {
      const current = new Date(start)
      current.setDate(start.getDate() + index)
      days.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`)
    }
    return days
  }, [weekStart])

  const goToPrevWeek = () => {
    const d = new Date(`${weekStart}T00:00:00`)
    d.setDate(d.getDate() - 7)
    setWeekStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const goToNextWeek = () => {
    const d = new Date(`${weekStart}T00:00:00`)
    d.setDate(d.getDate() + 7)
    setWeekStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const goToToday = () => {
    setWeekStart(getMonday(today))
    setSelectedDate(today)
  }

  const availableCount = mappedSlots.filter((slot) => !slot.busyBy).length
  const busyCount = mappedSlots.filter((slot) => slot.busyBy && slot.source !== 'tutorial_session').length
  const tutorialCount = mappedSlots.filter((slot) => slot.source === 'tutorial_session').length

  const handleOpenTutorial = async (sessionId) => {
    if (!sessionId) {
      return
    }

    try {
      const tutorial = await getTutorialSessionById(sessionId)
      setFocusedTutorial(tutorial)
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion de la tutoria.')
    }
  }

  const tutorialAction = focusedTutorial ? getTutorialPrimaryAction(focusedTutorial, user?.user_id) : null

  return (
    <section className="reservations-page" aria-label="Calendario de disponibilidad">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Reserva de laboratorios</p>
          <h2>Calendario de disponibilidad</h2>
          <p>Elige un laboratorio, navega la semana y selecciona un dia para ver horarios, reservas y tutorias.</p>
        </div>
      </header>

      {error ? <p className="reservations-message error">{error}</p> : null}

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
            const date = new Date(`${dateStr}T00:00:00`)
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === today
            return (
              <button
                key={dateStr}
                type="button"
                className={`cal-day${isSelected ? ' cal-day--selected' : ''}${isToday ? ' cal-day--today' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="cal-day-name">{DIAS_CORTOS[date.getDay()]}</span>
                <span className="cal-day-num">{date.getDate()}</span>
              </button>
            )
          })}
        </div>
      </section>

      {selectedLab ? (
        <section className="reservations-panel">
          <div className="cal-slots-header">
            <h3 className="cal-slots-title">{formatSelectedDate(selectedDate)}</h3>
            {mappedSlots.length > 0 ? (
              <div className="cal-slots-legend">
                <span className="cal-legend-item cal-legend--available">
                  <span className="cal-legend-dot" /> {availableCount} libre{availableCount !== 1 ? 's' : ''}
                </span>
                <span className="reservation-slot-legend-item tutorial">
                  <span className="reservation-slot-legend-dot" /> {tutorialCount} tutoria{tutorialCount !== 1 ? 's' : ''}
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
            ) : null}
          </div>

          {mappedSlots.length === 0 ? (
            <p className="reservations-empty">No hay horarios disponibles para este dia.</p>
          ) : (
            <div className="reservations-slots">
              {mappedSlots.map((slot) => {
                const isTutorial = slot.source === 'tutorial_session'
                return isTutorial ? (
                  <button
                    key={slot.start_time}
                    type="button"
                    className={`reservations-slot ${getSlotTone(slot)}`}
                    onClick={() => handleOpenTutorial(slot.source_id)}
                  >
                    <strong>{slot.start_time} - {slot.end_time}</strong>
                    <span>{getSlotLabel(slot)}</span>
                  </button>
                ) : (
                  <article
                    key={slot.start_time}
                    className={`reservations-slot ${getSlotTone(slot)}`}
                  >
                    <strong>{slot.start_time} - {slot.end_time}</strong>
                    <span>{getSlotLabel(slot)}</span>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="reservations-panel">
          <p className="reservations-empty">Selecciona un laboratorio para ver disponibilidad.</p>
        </section>
      )}

      {focusedTutorial ? (
        <TutorialSessionDetailModal
          session={focusedTutorial}
          title="Tutoria disponible"
          onClose={() => setFocusedTutorial(null)}
          primaryActionLabel={tutorialAction?.label || ''}
          primaryActionHint={tutorialAction?.hint || ''}
          onPrimaryAction={() => {
            const sessionId = focusedTutorial?.id
            setFocusedTutorial(null)
            openTutorialSessionFlow(sessionId, { navigate: true })
          }}
        />
      ) : null}
    </section>
  )
}

export default UserAvailabilityCalendarPage
