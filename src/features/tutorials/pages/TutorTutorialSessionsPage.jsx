import { useEffect, useMemo, useState } from 'react'
import { listAdminLabs } from '../../admin/services/infrastructureService'
import { getLabAvailability } from '../../reservations/services/reservationsService'
import {
  createTutorialSession,
  deleteTutorialSession,
  getTutorialSessionById,
  listMyTutorialSessions,
  subscribeTutorialSessionsRealtime,
  updateTutorialSession,
} from '../services/tutorialSessionsService'
import TutorialSessionDetailModal from './TutorialSessionDetailModal'
import './TutorialPages.css'

const MIN_TOPIC_LENGTH = 5
const MAX_DESCRIPTION_LENGTH = 400
const MAX_SEATS = 50
const CLOCK_REFRESH_MS = 30 * 1000

function todayLocalDateString() {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function maxReservableDateString() {
  const value = new Date()
  value.setMonth(value.getMonth() + 1)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultForm(overrides = {}) {
  return {
    topic: '',
    tutor_name: '',
    description: '',
    laboratory_id: '',
    location: '',
    session_date: todayLocalDateString(),
    start_time: '',
    end_time: '',
    max_students: 8,
    ...overrides,
  }
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

function isPastSlotForDate(slot, dateValue, referenceNow = new Date()) {
  const slotStart = buildLocalDateTime(dateValue, slot?.start_time)
  if (!slotStart) {
    return false
  }
  return slotStart.getTime() <= referenceNow.getTime()
}

function getSlotKey(slot) {
  return `${slot.start_time}-${slot.end_time}`
}

function getSlotTone(slot, dateValue, referenceNow) {
  if (slot.source === 'tutorial_session') {
    return 'tutorial'
  }

  if (isPastSlotForDate(slot, dateValue, referenceNow) || (slot.state === 'blocked' && slot.status === 'past')) {
    return 'past'
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

function getSlotLabel(slot, dateValue, referenceNow) {
  if (slot.source === 'tutorial_session') {
    return 'Tutoria'
  }

  if (isPastSlotForDate(slot, dateValue, referenceNow) || (slot.state === 'blocked' && slot.status === 'past')) {
    return 'Hora pasada'
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

function TutorTutorialSessionsPage() {
  const [form, setForm] = useState(() => createDefaultForm())
  const [editingSessionId, setEditingSessionId] = useState('')
  const [sessions, setSessions] = useState([])
  const [labs, setLabs] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [availabilityRefreshNonce, setAvailabilityRefreshNonce] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clockTick, setClockTick] = useState(Date.now())
  const [focusedSession, setFocusedSession] = useState(null)
  const [isLoadingFocusedSession, setIsLoadingFocusedSession] = useState(false)
  const todayIso = todayLocalDateString()
  const maxReservationIso = maxReservableDateString()
  const nowReference = useMemo(() => new Date(clockTick), [clockTick])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, CLOCK_REFRESH_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const loadSessions = async () => {
    try {
      const data = await listMyTutorialSessions()
      setSessions(data)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar tus tutorias.')
    }
  }

  const loadLabs = async () => {
    try {
      const data = await listAdminLabs()
      const activeLabs = Array.isArray(data) ? data.filter((lab) => lab?.is_active !== false) : []
      setLabs(activeLabs)
      setForm((previous) => {
        if (previous.laboratory_id || activeLabs.length === 0) {
          return previous
        }
        return {
          ...previous,
          laboratory_id: String(activeLabs[0].id || ''),
          location: String(activeLabs[0].name || ''),
        }
      })
    } catch (err) {
      setError(err.message || 'No se pudo cargar los laboratorios disponibles para tutorias.')
    }
  }

  useEffect(() => {
    loadSessions()
    loadLabs()

    const unsubscribe = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic === 'tutorial_session') {
        loadSessions()
        setAvailabilityRefreshNonce((value) => value + 1)
      }
    })

    return () => unsubscribe?.()
  }, [])

  const totalSeats = useMemo(
    () => sessions.reduce((sum, session) => sum + session.max_students, 0),
    [sessions],
  )

  const selectedLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(form.laboratory_id)) || null,
    [form.laboratory_id, labs],
  )

  const editingSession = useMemo(
    () => sessions.find((session) => session.id === editingSessionId) || null,
    [editingSessionId, sessions],
  )

  useEffect(() => {
    let mounted = true

    if (!form.laboratory_id || !form.session_date || isDateBeforeToday(form.session_date) || isDateBeyondReservationLimit(form.session_date)) {
      setSlots([])
      setSelectedSlotKey('')
      return () => {
        mounted = false
      }
    }

    setIsLoadingSlots(true)
    getLabAvailability(form.laboratory_id, form.session_date)
      .then((payload) => {
        if (!mounted) {
          return
        }
        const nextSlots = Array.isArray(payload?.slots) ? payload.slots : []
        setSlots(nextSlots)

        const currentKey = `${form.start_time}-${form.end_time}`
        const matchingSlot = nextSlots.find(
          (slot) =>
            getSlotKey(slot) === currentKey
            && (
              slot.state === 'available'
              || (slot.source === 'tutorial_session' && slot.source_id === editingSessionId)
            ),
        )
        if (matchingSlot) {
          setSelectedSlotKey(getSlotKey(matchingSlot))
        } else {
          setSelectedSlotKey('')
          setForm((previous) => ({
            ...previous,
            start_time: '',
            end_time: '',
          }))
        }
      })
      .catch((err) => {
        if (!mounted) {
          return
        }
        setSlots([])
        setSelectedSlotKey('')
        setError(err.message || 'No se pudieron cargar los bloques del laboratorio para tutorias.')
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingSlots(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [availabilityRefreshNonce, editingSessionId, form.end_time, form.laboratory_id, form.session_date, form.start_time])

  const selectedSlot = useMemo(
    () => slots.find((slot) => getSlotKey(slot) === selectedSlotKey) || null,
    [selectedSlotKey, slots],
  )

  const sessionStart = useMemo(
    () => buildLocalDateTime(form.session_date, form.start_time),
    [form.session_date, form.start_time],
  )

  const sessionEnd = useMemo(
    () => buildLocalDateTime(form.session_date, form.end_time),
    [form.session_date, form.end_time],
  )

  const validationMessage = useMemo(() => {
    if (!selectedLab) {
      return 'Debes seleccionar un laboratorio valido para publicar la tutoria.'
    }
    if (isDateBeforeToday(form.session_date)) {
      return 'No puedes publicar tutorias en fechas anteriores a hoy.'
    }
    if (isDateBeyondReservationLimit(form.session_date)) {
      return 'Solo puedes publicar tutorias con un maximo de un mes de anticipacion.'
    }
    if (String(form.topic || '').trim().length < MIN_TOPIC_LENGTH) {
      return `El tema debe tener al menos ${MIN_TOPIC_LENGTH} caracteres.`
    }
    const isCurrentTutorialSlot = selectedSlot?.source === 'tutorial_session' && selectedSlot?.source_id === editingSessionId
    if (!selectedSlot || (!isCurrentTutorialSlot && selectedSlot.state !== 'available')) {
      return 'Debes seleccionar un bloque disponible del laboratorio para publicar la tutoria.'
    }
    if (isPastSlotForDate(selectedSlot, form.session_date, nowReference)) {
      return 'No puedes publicar tutorias en bloques que ya comenzaron o ya transcurrieron.'
    }
    if (!sessionStart || !sessionEnd || sessionEnd <= sessionStart) {
      return 'La hora de fin debe ser posterior a la hora de inicio.'
    }
    if (sessionStart <= nowReference) {
      return 'No puedes publicar una tutoria en un horario pasado o que ya comenzo.'
    }
    const seats = Number(form.max_students || 0)
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
      return `El cupo maximo debe estar entre 1 y ${MAX_SEATS} estudiantes.`
    }
    if (String(form.description || '').trim().length > MAX_DESCRIPTION_LENGTH) {
      return `La descripcion no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres.`
    }
    return ''
  }, [editingSessionId, form.description, form.max_students, form.session_date, form.topic, nowReference, selectedLab, selectedSlot, sessionEnd, sessionStart])

  const canSubmit = !validationMessage && labs.length > 0

  const handleFormChange = (field, value) => {
    setForm((previous) => {
      if (field === 'laboratory_id') {
        const nextLab = labs.find((lab) => String(lab.id) === String(value)) || null
        return {
          ...previous,
          laboratory_id: String(value || ''),
          location: String(nextLab?.name || ''),
          start_time: '',
          end_time: '',
        }
      }

      if (field === 'session_date') {
        return {
          ...previous,
          session_date: value,
          start_time: '',
          end_time: '',
        }
      }

      if (field === 'max_students') {
        return {
          ...previous,
          max_students: value,
        }
      }

      return {
        ...previous,
        [field]: value,
      }
    })

    if (field === 'laboratory_id' || field === 'session_date') {
      setSelectedSlotKey('')
    }
  }

  const resetEditor = () => {
    setEditingSessionId('')
    setSelectedSlotKey('')
    setForm(createDefaultForm({
      session_date: todayLocalDateString(),
      laboratory_id: String(selectedLab?.id || labs[0]?.id || ''),
      location: String(selectedLab?.name || labs[0]?.name || ''),
    }))
  }

  const handleStartEditing = (session) => {
    if (!session) {
      return
    }

    setEditingSessionId(session.id)
    setForm(createDefaultForm({
      topic: session.topic,
      tutor_name: session.tutor_name || '',
      description: session.description,
      laboratory_id: String(session.laboratory_id || ''),
      location: String(session.location || ''),
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      max_students: session.max_students,
    }))
    setSelectedSlotKey(`${session.start_time}-${session.end_time}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSelectSlot = (slot) => {
    const isCurrentTutorialSlot = slot?.source === 'tutorial_session' && slot?.source_id === editingSessionId
    if (slot.state !== 'available' && !isCurrentTutorialSlot) {
      return
    }

    setSelectedSlotKey(getSlotKey(slot))
    setForm((previous) => ({
      ...previous,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }))
  }

  const handleOpenTutorialDetails = async (sessionId) => {
    if (!sessionId) {
      return
    }

    const localSession = sessions.find((session) => session.id === sessionId) || null
    if (localSession) {
      setFocusedSession(localSession)
    }
    setIsLoadingFocusedSession(true)

    try {
      const tutorial = await getTutorialSessionById(sessionId)
      setFocusedSession(tutorial)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle de la tutoria.')
    } finally {
      setIsLoadingFocusedSession(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (validationMessage) {
      setError(validationMessage)
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        ...form,
        laboratory_id: String(selectedLab?.id || ''),
        location: String(selectedLab?.name || ''),
        max_students: Number(form.max_students),
      }

      if (editingSessionId) {
        await updateTutorialSession(editingSessionId, payload)
        setMessage(
          editingSession?.enrolled_count > 0
            ? 'Tutoria actualizada. Los estudiantes inscritos ya fueron notificados del cambio.'
            : 'Tutoria actualizada correctamente.',
        )
      } else {
        await createTutorialSession(payload)
        setMessage('Tutoria publicada correctamente. Ya esta visible para los estudiantes.')
      }

      setEditingSessionId('')
      setForm(createDefaultForm({
        session_date: form.session_date,
        laboratory_id: String(selectedLab?.id || ''),
        location: String(selectedLab?.name || ''),
      }))
      setSelectedSlotKey('')
      setAvailabilityRefreshNonce((value) => value + 1)
      await loadSessions()
    } catch (err) {
      setError(err.message || (editingSessionId ? 'No se pudo actualizar la tutoria.' : 'No se pudo publicar la tutoria.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (session) => {
    setDeletingId(session.id)
    setError('')
    setMessage('')

    try {
      await deleteTutorialSession(session.id)
      if (editingSessionId === session.id) {
        resetEditor()
      }
      setMessage(
        session.enrolled_count > 0
          ? 'Tutoria eliminada. Las inscripciones se cancelaron y los estudiantes fueron notificados.'
          : 'Bloque de tutoria eliminado correctamente.',
      )
      setAvailabilityRefreshNonce((value) => value + 1)
      await loadSessions()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la tutoria.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="tutorials-page" aria-label="Gestion de tutorias">
      <header className="tutorials-header">
        <div>
          <p className="tutorials-kicker">Soporte academico</p>
          <h2>Publicar horarios de tutorias</h2>
          <p>Configura bloques con dias, horas y cupos. El sistema evita conflictos con tus propias reservas de laboratorio.</p>
        </div>
        <div className="tutorials-summary">
          <div><span>Sesiones</span><strong>{sessions.length}</strong></div>
          <div><span>Cupos</span><strong>{totalSeats}</strong></div>
        </div>
      </header>

      {message ? <p className="tutorials-message success">{message}</p> : null}
      {error ? <p className="tutorials-message error">{error}</p> : null}

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>{editingSessionId ? 'Editar bloque' : 'Nuevo bloque'}</h3>
          <p className="tutorials-panel-subtitle">
            {editingSessionId
              ? 'Ajusta horario, laboratorio o cupos. Si ya hay estudiantes inscritos, el sistema les avisara del cambio.'
              : 'Publica una sesion visible de inmediato para estudiantes y auxiliares.'}
          </p>
        </div>

        <form className="tutorials-form" onSubmit={handleSubmit}>
          <div className="tutorials-form-grid">
            <label>
              <span>Tema</span>
              <input
                type="text"
                value={form.topic}
                maxLength={120}
                onChange={(event) => handleFormChange('topic', event.target.value)}
                placeholder="Ej. Refuerzo de algoritmos"
                required
              />
            </label>
            <label>
              <span>Tutor visible</span>
              <input
                type="text"
                value={form.tutor_name}
                maxLength={120}
                onChange={(event) => handleFormChange('tutor_name', event.target.value)}
                placeholder="Se mostrara este nombre a los estudiantes"
              />
            </label>
            <label>
              <span>Laboratorio</span>
              <select
                value={form.laboratory_id}
                onChange={(event) => handleFormChange('laboratory_id', event.target.value)}
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
                value={form.session_date}
                min={todayIso}
                max={maxReservationIso}
                onChange={(event) => handleFormChange('session_date', event.target.value)}
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
              />
            </label>
            <label>
              <span>Hora de fin</span>
              <input
                type="text"
                value={form.end_time}
                readOnly
                placeholder="Selecciona un bloque"
              />
            </label>
            <label>
              <span>Cupo maximo</span>
              <input
                type="number"
                min="1"
                max={String(MAX_SEATS)}
                step="1"
                value={form.max_students}
                onChange={(event) => handleFormChange('max_students', event.target.value)}
                required
              />
            </label>
          </div>

          {selectedLab ? (
            <div className="tutorial-slot-panel">
              <div className="tutorial-slot-header">
                <div>
                  <strong>Bloques del dia</strong>
                  <p>Asi el tutor puede ver que espacios estan libres, ocupados, bloqueados o en mantenimiento antes de publicar.</p>
                </div>
                <div className="tutorial-slot-legend">
                  <span className="tutorial-slot-legend-item available">
                    <span className="tutorial-slot-legend-dot" /> Disponible
                  </span>
                  <span className="tutorial-slot-legend-item tutorial">
                    <span className="tutorial-slot-legend-dot" /> Tutoria
                  </span>
                  <span className="tutorial-slot-legend-item busy">
                    <span className="tutorial-slot-legend-dot" /> Ocupado
                  </span>
                  <span className="tutorial-slot-legend-item maintenance">
                    <span className="tutorial-slot-legend-dot" /> Mantenimiento
                  </span>
                  <span className="tutorial-slot-legend-item blocked-other">
                    <span className="tutorial-slot-legend-dot" /> Bloqueado
                  </span>
                  <span className="tutorial-slot-legend-item past">
                    <span className="tutorial-slot-legend-dot" /> Hora pasada
                  </span>
                </div>
              </div>

              {isLoadingSlots ? (
                <p className="tutorials-empty">Cargando bloques del laboratorio...</p>
              ) : slots.length === 0 ? (
                <p className="tutorials-empty">No hay bloques configurados o disponibles para la fecha seleccionada.</p>
              ) : (
                <div className="tutorial-slot-grid">
                  {slots.map((slot) => {
                    const slotKey = getSlotKey(slot)
                    const isSelected = selectedSlotKey === slotKey
                    const isCurrentTutorial = slot.source === 'tutorial_session' && slot.source_id === editingSessionId
                    const isAvailable = (slot.state === 'available' || isCurrentTutorial) && !isPastSlotForDate(slot, form.session_date, nowReference)
                    const isTutorial = slot.source === 'tutorial_session'
                    return (
                      <button
                        key={slotKey}
                        type="button"
                        className={`tutorial-slot ${getSlotTone(slot, form.session_date, nowReference)}${isSelected ? ' is-selected' : ''}`}
                        disabled={!isAvailable && !isTutorial}
                        onClick={() => {
                          if (isTutorial && !isCurrentTutorial) {
                            handleOpenTutorialDetails(slot.source_id)
                            return
                          }
                          handleSelectSlot(slot)
                        }}
                      >
                        <strong>{slot.start_time} - {slot.end_time}</strong>
                        <span>{getSlotLabel(slot, form.session_date, nowReference)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          <label>
            <span>Descripcion</span>
            <textarea
              rows="4"
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={form.description}
              onChange={(event) => handleFormChange('description', event.target.value)}
              placeholder="Explica para que temas o estudiantes esta orientada la tutoria."
            />
          </label>

          <div className="tutorials-inline-meta">
            <span>Ubicacion asignada: {selectedLab?.name || 'Selecciona un laboratorio'}</span>
            <span>Solo se permiten bloques futuros y hasta un mes de anticipacion.</span>
          </div>

          {validationMessage ? <p className="tutorials-inline-hint">{validationMessage}</p> : null}

          <div className="tutorials-actions">
            {editingSessionId ? (
              <button type="button" className="tutorials-secondary" onClick={resetEditor}>
                Cancelar edicion
              </button>
            ) : null}
            <button type="submit" className="tutorials-primary" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (editingSessionId ? 'Guardando...' : 'Publicando...') : (editingSessionId ? 'Guardar cambios' : 'Publicar tutoria')}
            </button>
          </div>
        </form>
      </section>

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Mis tutorias publicadas</h3>
          <p className="tutorials-panel-subtitle">
            Si eliminas una sesion con inscritos, el sistema cancela las inscripciones y notifica a los estudiantes afectados.
          </p>
        </div>

        {sessions.length === 0 ? (
          <p className="tutorials-empty">Todavia no publicaste tutorias.</p>
        ) : (
          <div className="tutorials-grid">
            {sessions.map((session) => (
              <article key={session.id} className="tutorial-card tutor-card">
                <div className="tutorial-card-head">
                  <div>
                    <span className="tutorial-badge">Publicada</span>
                    <h4>{session.topic}</h4>
                  </div>
                  <strong className="tutorial-seats">{session.enrolled_count}/{session.max_students}</strong>
                </div>

                <p className="tutorial-copy">{session.description || 'Sin descripcion adicional.'}</p>

                <div className="tutorial-meta">
                  <span>{session.session_date}</span>
                  <span>{session.start_time} - {session.end_time}</span>
                  <span>{session.location || 'Ubicacion por definir'}</span>
                </div>

                <div className="tutorial-enrolled-list">
                  <strong>Inscritos</strong>
                  {session.enrolled_students.length === 0 ? (
                    <p>Aun no hay estudiantes registrados.</p>
                  ) : (
                    session.enrolled_students.map((student) => (
                      <span key={`${session.id}-${student.student_id}`}>{student.student_name}</span>
                    ))
                  )}
                </div>

                <div className="tutorials-actions">
                  <button
                    type="button"
                    className="tutorials-secondary"
                    onClick={() => handleStartEditing(session)}
                  >
                    Editar bloque
                  </button>
                  <button
                    type="button"
                    className="tutorials-danger"
                    disabled={deletingId === session.id}
                    onClick={() => handleDelete(session)}
                  >
                    {deletingId === session.id ? 'Eliminando...' : 'Eliminar bloque'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {focusedSession || isLoadingFocusedSession ? (
        <TutorialSessionDetailModal
          session={focusedSession}
          title="Bloque de tutoria"
          onClose={() => {
            if (!isLoadingFocusedSession) {
              setFocusedSession(null)
            }
          }}
        />
      ) : null}
    </section>
  )
}

export default TutorTutorialSessionsPage
