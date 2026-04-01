import { useEffect, useMemo, useState } from 'react'
import {
  enrollInTutorialSession,
  listPublicTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../services/tutorialSessionsService'
import './TutorialPages.css'

const FOCUSED_TUTORIAL_KEY = 'labconnect.focus_tutorial_session_id'
const OPEN_TUTORIAL_EVENT = 'labconnect:open-tutorial-session'

function StudentTutorialSessionsPage({ user }) {
  const [sessions, setSessions] = useState([])
  const [focusedSessionId, setFocusedSessionId] = useState('')
  const [enrollingId, setEnrollingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadSessions = async () => {
    try {
      const data = await listPublicTutorialSessions()
      setSessions(data)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la cartelera de tutorias.')
    }
  }

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
  }, [user?.user_id])

  useEffect(() => {
    const applyFocus = (sessionId) => {
      const normalizedId = String(sessionId || '').trim()
      if (!normalizedId) {
        return
      }
      setFocusedSessionId(normalizedId)
      localStorage.removeItem(FOCUSED_TUTORIAL_KEY)
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

  const focusedSession = useMemo(
    () => sessions.find((session) => session.id === focusedSessionId) || null,
    [focusedSessionId, sessions],
  )

  const availableSessions = useMemo(
    () => sessions.filter((session) => session.is_published),
    [sessions],
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

  return (
    <section className="tutorials-page tutorials-page-student" aria-label="Tutorias disponibles">
      <header className="tutorials-header">
        <div>
          <p className="tutorials-kicker">Apoyo academico</p>
          <h2>Tutorias disponibles</h2>
          <p>Consulta las sesiones publicadas por docentes y auxiliares, revisa cupos y registrate en la que necesites.</p>
        </div>
        <div className="tutorials-summary">
          <div><span>Disponibles</span><strong>{availableSessions.length}</strong></div>
        </div>
      </header>

      {message ? <p className="tutorials-message success">{message}</p> : null}
      {error ? <p className="tutorials-message error">{error}</p> : null}

      {focusedSession ? (
        <section className="tutorials-panel tutorial-focus-panel">
          <div className="tutorials-panel-header">
            <h3>Tutoria destacada</h3>
            <p className="tutorials-panel-subtitle">
              Se muestra aqui cuando entras desde una notificacion o tras completar una inscripcion.
            </p>
          </div>

          <div className="tutorial-focus-grid">
            <div className="tutorial-focus-card">
              <span>Tema</span>
              <strong>{focusedSession.topic}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Tutor</span>
              <strong>{focusedSession.tutor_name}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Horario</span>
              <strong>{focusedSession.session_date} · {focusedSession.start_time} - {focusedSession.end_time}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Cupos</span>
              <strong>{focusedSession.seats_left} disponibles</strong>
            </div>
          </div>

          <div className="tutorial-focus-copy">
            <p><strong>Ubicacion:</strong> {focusedSession.location || 'Por definir'}</p>
            <p><strong>Descripcion:</strong> {focusedSession.description || 'Sin descripcion adicional.'}</p>
          </div>
        </section>
      ) : null}

      <section className="tutorials-panel">
        {availableSessions.length === 0 ? (
          <p className="tutorials-empty">No hay tutorias publicadas por el momento.</p>
        ) : (
          <div className="tutorials-grid">
            {availableSessions.map((session) => {
              const isFocused = focusedSessionId === session.id
              const isOwnSession = session.tutor_id === (user?.user_id || '')
              const isEnrolled = session.enrolled_students.some((student) => student.student_id === (user?.user_id || ''))
              const isFull = session.seats_left <= 0

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

                  <div className="tutorial-meta">
                    <span>{session.tutor_name}</span>
                    <span>{session.session_date}</span>
                    <span>{session.start_time} - {session.end_time}</span>
                    <span>{session.location || 'Ubicacion por definir'}</span>
                  </div>

                  <div className="tutorial-students">
                    <strong>Inscritos</strong>
                    <span>{session.enrolled_count} de {session.max_students} ocupados</span>
                  </div>

                  <div className="tutorials-actions">
                    {isOwnSession ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        Es tu tutoria
                      </button>
                    ) : isEnrolled ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        Ya inscrito
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tutorials-primary"
                        disabled={isFull || enrollingId === session.id}
                        onClick={() => handleEnroll(session)}
                      >
                        {enrollingId === session.id ? 'Inscribiendo...' : isFull ? 'Sin cupos' : 'Inscribirme'}
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
