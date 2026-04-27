import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelTutorialEnrollment,
  enrollInTutorialSession,
  listMyEnrolledTutorialSessions,
  listPublicTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../services/tutorialSessionsService'
import { FOCUSED_TUTORIAL_KEY, OPEN_TUTORIAL_EVENT } from '../utils/focusTutorialNavigation'
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
  const [focusedSessionId, setFocusedSessionId] = useState('')
  const [enrollingId, setEnrollingId] = useState('')
  const [cancellingId, setCancellingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [clockTick, setClockTick] = useState(() => Date.now())

  const loadSessions = useCallback(async () => {
    try {
      const [publicSessions, enrolledSessions] = await Promise.all([
        listPublicTutorialSessions(),
        listMyEnrolledTutorialSessions(),
      ])
      setSessions(publicSessions)
      setMySessions(enrolledSessions)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la cartelera de tutorias.')
    }
  }, [])

  useEffect(() => {
    loadSessions()

    const unsubscribe = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic === 'tutorial_session') {
        loadSessions()
      }

      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === (user?.user_id || '') ||
          recipients.includes(user?.user_id || '')

        if (isCurrentUserNotification) {
          loadSessions()
        }
      }
    })

    return () => unsubscribe?.()
  }, [loadSessions, user?.user_id])

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

  const availableSessions = useMemo(
    () => sessions.filter((session) => session.is_published),
    [sessions],
  )

  const nowReference = useMemo(() => new Date(clockTick), [clockTick])

  const focusedState = useMemo(
    () => (focusedSession ? getEnrollmentState(focusedSession, user?.user_id, nowReference) : null),
    [focusedSession, nowReference, user?.user_id],
  )

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
