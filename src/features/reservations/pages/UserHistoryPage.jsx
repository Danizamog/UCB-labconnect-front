import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listReservations,
  subscribeReservationsRealtime,
} from '../services/reservationsService'
import {
  listMyEnrolledTutorialSessions,
  listMyTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../../tutorials/services/tutorialSessionsService'
import { formatDateTime, formatStatus } from '../../../shared/utils/formatters'
import './UserHistoryPage.css'

const RESERVATION_HISTORY_STATUSES = new Set(['rejected', 'cancelled', 'completed', 'absent'])

function parseDateTimeValue(value) {
  const parsed = new Date(String(value || '').replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseReservationStart(reservation) {
  if (reservation?.start_at) {
    const parsed = parseDateTimeValue(reservation.start_at)
    if (parsed) {
      return parsed
    }
  }

  if (reservation?.date && reservation?.start_time) {
    return parseDateTimeValue(`${reservation.date}T${reservation.start_time}:00`)
  }

  return null
}

function parseTutorialEnd(session) {
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

function mapTutorialAudience(session, currentUserId) {
  return session?.tutor_id === currentUserId ? 'Tutoria brindada' : 'Tutoria inscrita'
}

function UserHistoryPage({ user }) {
  const [reservations, setReservations] = useState([])
  const [tutorials, setTutorials] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = useCallback(async (options = {}) => {
    setIsLoading(true)
    setError('')

    try {
      const [reservationsResult, enrolledResult, taughtResult] = await Promise.allSettled([
        listReservations({ skipCache: options.skipCache }),
        listMyEnrolledTutorialSessions(),
        listMyTutorialSessions(),
      ])

      if (reservationsResult.status === 'fulfilled') {
        setReservations(Array.isArray(reservationsResult.value) ? reservationsResult.value : [])
      } else {
        setReservations([])
      }

      const mergedTutorials = []
      if (enrolledResult.status === 'fulfilled' && Array.isArray(enrolledResult.value)) {
        mergedTutorials.push(...enrolledResult.value)
      }
      if (taughtResult.status === 'fulfilled' && Array.isArray(taughtResult.value)) {
        mergedTutorials.push(...taughtResult.value)
      }

      const uniqueTutorials = Array.from(
        mergedTutorials.reduce((acc, item) => {
          if (item?.id) {
            acc.set(item.id, item)
          }
          return acc
        }, new Map()),
      ).map(([, value]) => value)

      setTutorials(uniqueTutorials)

      if (reservationsResult.status === 'rejected' && enrolledResult.status === 'rejected' && taughtResult.status === 'rejected') {
        setError('No se pudo cargar el historial en este momento.')
      }
    } catch {
      setReservations([])
      setTutorials([])
      setError('No se pudo cargar el historial en este momento.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()

    const unsubscribeReservations = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'lab_reservation' || event?.topic === 'tutorial_session' || event?.topic === 'user_notification') {
        loadHistory({ skipCache: true })
      }
    })

    const unsubscribeTutorials = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic === 'tutorial_session' || event?.topic === 'user_notification') {
        loadHistory({ skipCache: true })
      }
    })

    return () => {
      unsubscribeReservations?.()
      unsubscribeTutorials?.()
    }
  }, [loadHistory])

  const reservationHistory = useMemo(() => {
    const currentUserId = String(user?.user_id || '')
    const now = Date.now()

    return reservations
      .filter((reservation) => reservation?.requested_by === currentUserId)
      .filter((reservation) => {
        if (RESERVATION_HISTORY_STATUSES.has(String(reservation?.status || ''))) {
          return true
        }

        const startAt = parseReservationStart(reservation)
        return Boolean(startAt) && startAt.getTime() <= now
      })
      .sort((left, right) => {
        const leftTime = parseReservationStart(left)?.getTime() || 0
        const rightTime = parseReservationStart(right)?.getTime() || 0
        return rightTime - leftTime
      })
  }, [reservations, user?.user_id])

  const tutorialHistory = useMemo(() => {
    const now = Date.now()
    const currentUserId = String(user?.user_id || '')

    return tutorials
      .filter((session) => {
        const endAt = parseTutorialEnd(session)
        return Boolean(endAt) && endAt.getTime() <= now
      })
      .sort((left, right) => {
        const leftTime = parseTutorialEnd(left)?.getTime() || 0
        const rightTime = parseTutorialEnd(right)?.getTime() || 0
        return rightTime - leftTime
      })
      .map((session) => ({
        ...session,
        audience: mapTutorialAudience(session, currentUserId),
      }))
  }, [tutorials, user?.user_id])

  return (
    <section className="history-page" aria-label="Historial de actividad">
      <header className="history-header">
        <div>
          <p className="history-kicker">Seguimiento personal</p>
          <h2>Historial de reservas y tutorias</h2>
          <p>Revisa tus actividades ya realizadas en laboratorios y sesiones de tutoria.</p>
        </div>
        <button type="button" className="history-refresh" onClick={() => loadHistory({ skipCache: true })} disabled={isLoading}>
          {isLoading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {error ? <p className="history-alert error">{error}</p> : null}

      <div className="history-summary">
        <article>
          <span>Reservas en historial</span>
          <strong>{reservationHistory.length}</strong>
        </article>
        <article>
          <span>Tutorias finalizadas</span>
          <strong>{tutorialHistory.length}</strong>
        </article>
      </div>

      <section className="history-panel" aria-label="Historial de reservas">
        <div className="history-panel-head">
          <h3>Reservas</h3>
          <p>Incluye reservas pasadas, canceladas o rechazadas.</p>
        </div>

        {isLoading && reservationHistory.length === 0 ? (
          <p className="history-empty">Cargando historial de reservas...</p>
        ) : reservationHistory.length === 0 ? (
          <p className="history-empty">Aun no tienes reservas en historial.</p>
        ) : (
          <div className="history-list">
            {reservationHistory.map((reservation) => (
              <article key={reservation.id} className="history-card">
                <div className="history-card-top">
                  <span className="history-chip">Reserva</span>
                  <span className={`history-status is-${reservation.status || 'neutral'}`}>
                    {formatStatus(reservation.status || '')}
                  </span>
                </div>
                <h4>{reservation.laboratory_name || reservation.laboratory_id || 'Laboratorio'}</h4>
                <p>{reservation.purpose || 'Sin motivo registrado'}</p>
                <div className="history-meta">
                  <span>{formatDateTime(reservation.start_at)}</span>
                  <span>{reservation.start_time} - {reservation.end_time}</span>
                </div>
                {reservation.cancel_reason ? <p className="history-warning">Motivo: {reservation.cancel_reason}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="history-panel" aria-label="Historial de tutorias">
        <div className="history-panel-head">
          <h3>Tutorias</h3>
          <p>Sesiones inscritas o impartidas que ya finalizaron.</p>
        </div>

        {isLoading && tutorialHistory.length === 0 ? (
          <p className="history-empty">Cargando historial de tutorias...</p>
        ) : tutorialHistory.length === 0 ? (
          <p className="history-empty">Aun no tienes tutorias finalizadas en historial.</p>
        ) : (
          <div className="history-list">
            {tutorialHistory.map((session) => (
              <article key={session.id} className="history-card">
                <div className="history-card-top">
                  <span className="history-chip">{session.audience}</span>
                  <span className="history-status is-completed">Finalizada</span>
                </div>
                <h4>{session.topic || 'Tutoria'}</h4>
                <p>{session.description || 'Sesion academica finalizada.'}</p>
                <div className="history-meta">
                  <span>{formatDateTime(session.start_at)}</span>
                  <span>{session.location || session.laboratory_id || 'Sin ubicacion'}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default UserHistoryPage
