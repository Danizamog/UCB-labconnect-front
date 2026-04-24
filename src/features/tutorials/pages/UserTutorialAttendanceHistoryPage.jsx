import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listMyEnrolledTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../services/tutorialSessionsService'
import { formatDateTime } from '../../../shared/utils/formatters'
import './UserTutorialAttendanceHistoryPage.css'

function parseDateTimeValue(value) {
  const parsed = new Date(String(value || '').replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseSessionEnd(session) {
  if (session?.end_at) {
    const parsed = parseDateTimeValue(session.end_at)
    if (parsed) {
      return parsed
    }
  }

  if (session?.session_date && session?.end_time) {
    return parseDateTimeValue(`${session.session_date}T${session.end_time}:00`)
  }

  return null
}

function UserTutorialAttendanceHistoryPage({ user }) {
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const enrolledSessions = await listMyEnrolledTutorialSessions()
      setSessions(Array.isArray(enrolledSessions) ? enrolledSessions : [])
    } catch (err) {
      setSessions([])
      setError(err.message || 'No se pudo cargar el historial de tutorias atendidas.')
    } finally {
      setIsLoading(false)
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

  const completedSessions = useMemo(() => {
    const now = Date.now()

    return sessions
      .filter((session) => {
        const endAt = parseSessionEnd(session)
        return Boolean(endAt) && endAt.getTime() <= now
      })
      .sort((left, right) => {
        const leftTime = parseSessionEnd(left)?.getTime() || 0
        const rightTime = parseSessionEnd(right)?.getTime() || 0
        return rightTime - leftTime
      })
  }, [sessions])

  const totalHours = useMemo(() => {
    return completedSessions.reduce((acc, session) => {
      const startAt = parseDateTimeValue(session?.start_at)
      const endAt = parseDateTimeValue(session?.end_at)
      if (!startAt || !endAt) {
        return acc
      }

      const durationMs = Math.max(endAt.getTime() - startAt.getTime(), 0)
      return acc + durationMs
    }, 0)
  }, [completedSessions])

  const totalHoursRounded = Math.round((totalHours / (1000 * 60 * 60)) * 10) / 10

  return (
    <section className="tutorial-history-page" aria-label="Historial de tutorias atendidas">
      <header className="tutorial-history-header">
        <div>
          <p className="tutorial-history-kicker">Seguimiento academico</p>
          <h2>Historial de tutorias atendidas</h2>
          <p>Consulta las sesiones donde participaste, con su fecha, tutor y duracion acumulada.</p>
        </div>
        <button type="button" className="tutorial-history-refresh" onClick={loadSessions} disabled={isLoading}>
          {isLoading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {error ? <p className="tutorial-history-alert error">{error}</p> : null}

      <div className="tutorial-history-summary">
        <article>
          <span>Tutorias atendidas</span>
          <strong>{completedSessions.length}</strong>
        </article>
        <article>
          <span>Horas acumuladas</span>
          <strong>{Number.isFinite(totalHoursRounded) ? totalHoursRounded : 0} h</strong>
        </article>
      </div>

      <section className="tutorial-history-panel" aria-label="Listado de tutorias atendidas">
        <div className="tutorial-history-panel-head">
          <h3>Sesiones finalizadas</h3>
          <p>Se incluyen las tutorias inscritas por ti que ya concluyeron.</p>
        </div>

        {isLoading && completedSessions.length === 0 ? (
          <p className="tutorial-history-empty">Cargando historial de tutorias...</p>
        ) : completedSessions.length === 0 ? (
          <p className="tutorial-history-empty">Aun no tienes tutorias atendidas en tu historial.</p>
        ) : (
          <div className="tutorial-history-list">
            {completedSessions.map((session) => (
              <article key={session.id} className="tutorial-history-card">
                <div className="tutorial-history-card-top">
                  <span className="tutorial-history-chip">Tutoria atendida</span>
                  <span className="tutorial-history-status">Finalizada</span>
                </div>

                <h4>{session.topic || 'Tutoria'}</h4>
                <p>{session.description || 'Sesion academica completada.'}</p>

                <div className="tutorial-history-meta">
                  <span><strong>Tutor:</strong> {session.tutor_name || 'No disponible'}</span>
                  <span><strong>Fecha:</strong> {formatDateTime(session.start_at)}</span>
                  <span><strong>Horario:</strong> {session.start_time} - {session.end_time}</span>
                  <span><strong>Lugar:</strong> {session.location || session.laboratory_id || 'Sin ubicacion'}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default UserTutorialAttendanceHistoryPage
