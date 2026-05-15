import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelTutorialEnrollment,
  enrollInTutorialSession,
  listMyEnrolledTutorialSessions,
  listPublicTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../services/tutorialSessionsService'
import { listAdminLabs as getLaboratories } from '../../admin/services/infrastructureService'
import { FOCUSED_TUTORIAL_KEY, OPEN_TUTORIAL_EVENT } from '../utils/focusTutorialNavigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import './TutorialPages.css'

const CLOCK_REFRESH_MS = 30 * 1000

function parseSessionDate(value) {
  const parsed = new Date(value || '')
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getEnrollmentState(session, userId, referenceNow = new Date()) {
  const normalizedUserId = String(userId || '')
  const isOwnSession = session.tutor_id === normalizedUserId
  const isEnrolled = session.enrolled_students.some((student) => student.student_id === normalizedUserId)
  const isFull = session.seats_left <= 0
  const sessionStart = parseSessionDate(session?.start_at)
  const sessionEnd = parseSessionDate(session?.end_at)
  const hasStarted = Boolean(sessionStart) && sessionStart.getTime() <= referenceNow.getTime()
  const hasEnded = Boolean(sessionEnd) && sessionEnd.getTime() <= referenceNow.getTime()

  return {
    isOwnSession,
    isEnrolled,
    isFull,
    hasStarted,
    hasEnded,
    canEnroll: !isOwnSession && !isEnrolled && !isFull && !hasStarted && !hasEnded,
    canCancel: isEnrolled && !hasStarted && !hasEnded,
  }
}

function StudentTutorialSessionsPage({ user }) {
  const [sessions, setSessions] = useState([])
  const [mySessions, setMySessions] = useState([])
  const [laboratories, setLaboratories] = useState([])
  const [filters, setFilters] = useState({
    topic_search: '',
    session_date: '',
    laboratory_id: '',
    status: 'all', // 'all', 'active', 'finished'
  })
  const [focusedSessionId, setFocusedSessionId] = useState('')
  const [enrollingId, setEnrollingId] = useState('')
  const [cancellingId, setCancellingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [clockTick, setClockTick] = useState(() => Date.now())

  const loadPublicSessions = useCallback(async (currentFilters = filters) => {
    try {
      const publicSessions = await listPublicTutorialSessions({
        topic_search: currentFilters.topic_search,
        session_date: currentFilters.session_date,
        laboratory_id: currentFilters.laboratory_id,
      })
      setSessions(publicSessions)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la cartelera de tutorias.')
    }
  }, [filters])

  const loadLaboratories = useCallback(async () => {
    try {
      const labs = await getLaboratories()
      setLaboratories(labs.filter((l) => l.is_active !== false))
    } catch {
      // ignore
    }
  }, [])

  const loadMyEnrollments = useCallback(async () => {
    try {
      const enrolledSessions = await listMyEnrolledTutorialSessions()
      setMySessions(enrolledSessions)
    } catch {
      // ignore — la cartelera publica sigue siendo util sin las inscripciones
    }
  }, [])

  const loadSessions = useCallback(async () => {
    await Promise.all([loadPublicSessions(), loadMyEnrollments(), loadLaboratories()])
  }, [loadMyEnrollments, loadPublicSessions, loadLaboratories])

  const publicReloadTimerRef = useRef(null)
  const myReloadTimerRef = useRef(null)

  useEffect(() => {
    loadSessions()

    const userId = String(user?.user_id || '')
    const schedulePublicReload = () => {
      window.clearTimeout(publicReloadTimerRef.current)
      publicReloadTimerRef.current = window.setTimeout(loadPublicSessions, 1000)
    }
    const scheduleMyReload = () => {
      window.clearTimeout(myReloadTimerRef.current)
      myReloadTimerRef.current = window.setTimeout(loadMyEnrollments, 1000)
    }

    const unsubscribe = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic === 'tutorial_session') {
        schedulePublicReload()
        if (!userId) return
        const tutorId = String(event?.record?.tutor_id || '')
        const enrolled = Array.isArray(event?.record?.enrolled_students) ? event.record.enrolled_students : []
        const concerns = tutorId === userId
          || enrolled.some((student) => String(student?.student_id || '') === userId)
        if (concerns) scheduleMyReload()
        return
      }

      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === userId || recipients.includes(userId)
        if (isCurrentUserNotification) scheduleMyReload()
      }
    })

    return () => {
      window.clearTimeout(publicReloadTimerRef.current)
      window.clearTimeout(myReloadTimerRef.current)
      unsubscribe?.()
    }
  }, [loadMyEnrollments, loadPublicSessions, loadSessions, user?.user_id])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now())
    }, CLOCK_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const applyFocus = (sessionId) => {
      const normalizedId = String(sessionId || '').trim()
      if (!normalizedId) {
        return
      }
      setFocusedSessionId(normalizedId)
      localStorage.removeItem(FOCUSED_TUTORIAL_KEY)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const storedId = localStorage.getItem(FOCUSED_TUTORIAL_KEY)
    if (storedId) {
      applyFocus(storedId)
    }

    const handleOpenTutorial = (event) => {
      applyFocus(event?.detail?.sessionId)
    }

    window.addEventListener(OPEN_TUTORIAL_EVENT, handleOpenTutorial)
    return () => {
      window.removeEventListener(OPEN_TUTORIAL_EVENT, handleOpenTutorial)
    }
  }, [])

  const allKnownSessions = useMemo(() => {
    const sessionMap = new Map()
    ;[...mySessions, ...sessions].forEach((session) => {
      sessionMap.set(session.id, session)
    })
    return Array.from(sessionMap.values())
  }, [mySessions, sessions])

  const focusedSession = useMemo(
    () => allKnownSessions.find((session) => session.id === focusedSessionId) || null,
    [allKnownSessions, focusedSessionId],
  )

  const nowReference = useMemo(() => new Date(clockTick), [clockTick])

  const filteredSessions = useMemo(() => {
    let result = [...sessions]

    if (filters.status === 'active') {
      result = result.filter((s) => {
        const endAt = parseSessionDate(s.end_at)
        return endAt && endAt.getTime() > nowReference.getTime()
      })
    } else if (filters.status === 'finished') {
      result = result.filter((s) => {
        const endAt = parseSessionDate(s.end_at)
        return endAt && endAt.getTime() <= nowReference.getTime()
      })
    }

    return result.sort((a, b) => {
      const dateA = parseSessionDate(a.start_at)
      const dateB = parseSessionDate(b.start_at)
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0)
    })
  }, [sessions, filters.status, nowReference])

  const availableSessions = useMemo(
    () => filteredSessions.filter((session) => session.is_published),
    [filteredSessions],
  )

  const focusedState = useMemo(
    () => (focusedSession ? getEnrollmentState(focusedSession, user?.user_id, nowReference) : null),
    [focusedSession, nowReference, user?.user_id],
  )

  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value }
    setFilters(nextFilters)
    loadPublicSessions(nextFilters)
  }

  const handleResetFilters = () => {
    const reset = { topic_search: '', session_date: '', laboratory_id: '', status: 'all' }
    setFilters(reset)
    loadPublicSessions(reset)
  }

  const handleEnroll = async (session) => {
    setEnrollingId(session.id)
    setError('')
    setMessage('')

    try {
      await enrollInTutorialSession(session.id)
      setMessage('Inscripcion realizada correctamente. Ya tienes tu cupo reservado en la tutoria.')
      setFocusedSessionId(session.id)
      await loadSessions()
    } catch (err) {
      setError(err.message || 'No se pudo completar la inscripcion.')
    } finally {
      setEnrollingId('')
    }
  }

  const handleCancelEnrollment = async (session) => {
    setCancellingId(session.id)
    setError('')
    setMessage('')

    try {
      await cancelTutorialEnrollment(session.id)
      setMessage('Tu asistencia fue cancelada y el cupo se libero automaticamente para otros estudiantes.')
      await loadSessions()
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la asistencia a la tutoria.')
    } finally {
      setCancellingId('')
    }
  }

  return (
    <section className="tutorials-page tutorials-page-student" aria-label="Tutorias disponibles">
      <header className="tutorials-header">
        <div>
          <p className="tutorials-kicker">Apoyo academico</p>
          <h2>Apoyo y tutorias</h2>
          <p>Encuentra sesiones disponibles, revisa cupos y registrate en la que mejor encaje con tu horario.</p>
        </div>
        <div className="tutorials-summary">
          <div><span>Disponibles</span><strong>{availableSessions.length}</strong></div>
          <div><span>Mis tutorias</span><strong>{mySessions.length}</strong></div>
        </div>
      </header>

      {message ? <p className="tutorials-message success">{message}</p> : null}
      {error ? <p className="tutorials-message error">{error}</p> : null}

      {focusedSession ? (
        <section className="tutorials-panel tutorial-focus-panel">
          <div className="tutorials-panel-header">
            <h3>Tutoria destacada</h3>
            <p className="tutorials-panel-subtitle">
              Aqui se enfoca la sesion seleccionada desde el calendario, las notificaciones o tu panel de tutorias.
            </p>
          </div>

          <div className="tutorial-focus-hero">
            <div className="tutorial-focus-hero-copy">
              <span className="tutorial-badge">Sesion recomendada</span>
              <h4>{focusedSession.topic}</h4>
              <p>{focusedSession.description || 'Sesion pensada para reforzar contenidos y resolver dudas academicas con apoyo del tutor.'}</p>
            </div>
            <div className="tutorial-focus-hero-side">
              <span className="tutorial-focus-chip">{focusedSession.location || 'Laboratorio por definir'}</span>
              <strong>{focusedSession.seats_left} cupos disponibles</strong>
            </div>
          </div>

          <div className="tutorial-focus-grid">
            <div className="tutorial-focus-card">
              <span>Tutor</span>
              <strong>{focusedSession.tutor_name}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Horario</span>
              <strong>{focusedSession.session_date} | {focusedSession.start_time} - {focusedSession.end_time}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Cupos</span>
              <strong>{focusedSession.enrolled_count} / {focusedSession.max_students}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Disponibles</span>
              <strong>{focusedSession.seats_left}</strong>
            </div>
          </div>

          <div className="tutorial-focus-copy">
            <p><strong>Ubicacion:</strong> {focusedSession.location || 'Por definir'}</p>
            <p><strong>Descripcion:</strong> {focusedSession.description || 'Sin descripcion adicional.'}</p>
          </div>

          <div className="tutorial-focus-actions">
            {focusedState?.isOwnSession ? (
              <button type="button" className="tutorials-secondary" disabled>
                Es tu tutoria
              </button>
            ) : focusedState?.canCancel ? (
              <button
                type="button"
                className="tutorials-danger"
                disabled={cancellingId === focusedSession.id}
                onClick={() => handleCancelEnrollment(focusedSession)}
              >
                {cancellingId === focusedSession.id ? 'Cancelando...' : 'Cancelar asistencia'}
              </button>
            ) : focusedState?.isEnrolled ? (
              <button type="button" className="tutorials-secondary" disabled>
                {focusedState.hasStarted ? 'Tutoria en curso' : 'Ya inscrito'}
              </button>
            ) : focusedState?.hasStarted ? (
              <button type="button" className="tutorials-secondary" disabled>
                Sesion iniciada
              </button>
            ) : (
              <button
                type="button"
                className="tutorials-primary"
                disabled={!focusedState?.canEnroll || enrollingId === focusedSession.id}
                onClick={() => handleEnroll(focusedSession)}
              >
                {enrollingId === focusedSession.id ? 'Inscribiendo...' : focusedState?.isFull ? 'Sin cupos' : 'Inscribirme ahora'}
              </button>
            )}
          </div>
        </section>
      ) : null}

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Mis tutorias</h3>
          <p className="tutorials-panel-subtitle">
            Aqui ves las sesiones donde ya reservaste cupo. Si todavia no empiezan, puedes cancelar tu asistencia y liberar el cupo.
          </p>
        </div>

        {mySessions.length === 0 ? (
          <p className="tutorials-empty">Todavia no reservaste cupos en tutorias. Cuando te inscribas, tus sesiones apareceran aqui.</p>
        ) : (
          <div className="tutorials-grid">
            {mySessions.map((session) => {
              const sessionState = getEnrollmentState(session, user?.user_id, nowReference)

              return (
                <article key={session.id} className="tutorial-card is-enrolled">
                  <div className="tutorial-card-head">
                    <div>
                      <span className="tutorial-badge">Mi tutoria</span>
                      <h4>{session.topic}</h4>
                    </div>
                    <strong className="tutorial-seats">{session.seats_left} cupos libres</strong>
                  </div>

                  <div className="tutorial-card-facts">
                    <span>{session.tutor_name}</span>
                    <span>{session.session_date}</span>
                    <span>{session.start_time} - {session.end_time}</span>
                    <span>{session.location || 'Ubicacion por definir'}</span>
                  </div>

                  <div className="tutorial-meta">
                    <span>Inscritos: {session.enrolled_count} de {session.max_students}</span>
                    <span className={`tutorial-status-pill${sessionState.hasStarted ? ' active' : ''}`}>
                      {sessionState.hasStarted ? 'Tutoria en curso' : 'Reserva confirmada'}
                    </span>
                  </div>

                  <div className="tutorial-card-action-row">
                    <button
                      type="button"
                      className="tutorials-secondary"
                      onClick={() => {
                        setFocusedSessionId(session.id)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Ver detalle
                    </button>

                    {sessionState.canCancel ? (
                      <button
                        type="button"
                        className="tutorials-danger"
                        disabled={cancellingId === session.id}
                        onClick={() => handleCancelEnrollment(session)}
                      >
                        {cancellingId === session.id ? 'Cancelando...' : 'Cancelar asistencia'}
                      </button>
                    ) : (
                      <button type="button" className="tutorials-secondary" disabled>
                        {sessionState.hasStarted ? 'Tutoria iniciada' : 'Asistencia registrada'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Cartelera publica</h3>
          <p className="tutorials-panel-subtitle">
            Explora todas las tutorias publicadas y reserva tu cupo solo en sesiones futuras con capacidad disponible.
          </p>
        </div>

        <div className="tutorials-toolbar">
          <div className="tutorials-search-row">
            <label className="tutorials-search-field">
              <span className="tutorials-search-icon">
                <Search size={16} />
              </span>
              <input
                type="search"
                value={filters.topic_search}
                onChange={(event) => handleFilterChange('topic_search', event.target.value)}
                placeholder="Buscar por tema o descripción..."
                aria-label="Buscar tutoria por tema"
              />
            </label>
            <button type="button" className="tutorials-reset-button" onClick={handleResetFilters} title="Limpiar filtros">
              <X size={16} />
              <span>Limpiar</span>
            </button>
          </div>

          <div className="tutorials-filters-row">
            <div className="tutorials-filter-group">
              <div className="tutorials-filter-item">
                <label htmlFor="filter-date">Fecha</label>
                <input
                  id="filter-date"
                  type="date"
                  value={filters.session_date}
                  onChange={(event) => handleFilterChange('session_date', event.target.value)}
                />
              </div>

              <div className="tutorials-filter-item">
                <label htmlFor="filter-lab">Laboratorio</label>
                <select
                  id="filter-lab"
                  value={filters.laboratory_id}
                  onChange={(event) => handleFilterChange('laboratory_id', event.target.value)}
                >
                  <option value="">Todos los laboratorios</option>
                  {laboratories.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tutorials-status-filters">
              <button
                type="button"
                className={`tutorials-status-chip ${filters.status === 'all' ? 'is-active' : ''}`}
                onClick={() => handleFilterChange('status', 'all')}
              >
                Todas
              </button>
              <button
                type="button"
                className={`tutorials-status-chip ${filters.status === 'active' ? 'is-active' : ''}`}
                onClick={() => handleFilterChange('status', 'active')}
              >
                Activas
              </button>
              <button
                type="button"
                className={`tutorials-status-chip ${filters.status === 'finished' ? 'is-active' : ''}`}
                onClick={() => handleFilterChange('status', 'finished')}
              >
                Finalizadas
              </button>
            </div>
          </div>
        </div>

        {availableSessions.length === 0 ? (
          <p className="tutorials-empty">No hay tutorias publicadas por el momento.</p>
        ) : (
          <div className="tutorials-grid">
            {availableSessions.map((session) => {
              const isFocused = focusedSessionId === session.id
              const sessionState = getEnrollmentState(session, user?.user_id, nowReference)

              return (
                <article
                  key={session.id}
                  className={`tutorial-card${isFocused ? ' is-focused' : ''}`}
                >
                  <div className="tutorial-card-head">
                    <div>
                      <span className="tutorial-badge">Tutorias</span>
                      <h4>{session.topic}</h4>
                    </div>
                    <strong className="tutorial-seats">{session.seats_left} cupos</strong>
                  </div>

                  <p className="tutorial-copy">{session.description || 'Sesion abierta para resolver dudas y reforzar contenidos.'}</p>

                  <div className="tutorial-card-facts">
                    <span>{session.tutor_name}</span>
                    <span>{session.session_date}</span>
                    <span>{session.start_time} - {session.end_time}</span>
                    <span>{session.location || 'Ubicacion por definir'}</span>
                  </div>

                  <div className="tutorial-meta">
                    <span>Inscritos: {session.enrolled_count} de {session.max_students}</span>
                    <span>{session.seats_left} cupos disponibles</span>
                  </div>

                  <div className="tutorial-card-action-row">
                    <button
                      type="button"
                      className="tutorials-secondary"
                      onClick={() => {
                        setFocusedSessionId(session.id)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Ver detalle
                    </button>

                    {sessionState.isOwnSession ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        Es tu tutoria
                      </button>
                    ) : sessionState.canCancel ? (
                      <button
                        type="button"
                        className="tutorials-danger"
                        disabled={cancellingId === session.id}
                        onClick={() => handleCancelEnrollment(session)}
                      >
                        {cancellingId === session.id ? 'Cancelando...' : 'Cancelar asistencia'}
                      </button>
                    ) : sessionState.isEnrolled ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        {sessionState.hasStarted ? 'Tutoria iniciada' : 'Ya inscrito'}
                      </button>
                    ) : sessionState.hasStarted ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        Sesion iniciada
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tutorials-primary"
                        disabled={!sessionState.canEnroll || enrollingId === session.id}
                        onClick={() => handleEnroll(session)}
                      >
                        {enrollingId === session.id ? 'Inscribiendo...' : sessionState.isFull ? 'Sin cupos' : 'Inscribirme'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

export default StudentTutorialSessionsPage
