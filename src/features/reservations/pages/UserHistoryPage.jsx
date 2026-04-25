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
const FILTER_TYPES = {
  ALL: 'all',
  RESERVATIONS: 'reservations',
  TUTORIALS: 'tutorials',
}

function parseDateTimeValue(value) {
  const parsed = new Date(String(value || '').replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseDateTime(obj, dateField, timeField, datetimeField) {
  if (obj?.[datetimeField]) {
    const parsed = parseDateTimeValue(obj[datetimeField])
    if (parsed) return parsed
  }

  if (obj?.[dateField] && obj?.[timeField]) {
    return parseDateTimeValue(`${obj[dateField]}T${obj[timeField]}:00`)
  }

  return null
}

function parseReservationStart(reservation) {
  return parseDateTime(reservation, 'date', 'start_time', 'start_at')
}

function parseTutorialEnd(session) {
  return parseDateTime(session, 'session_date', 'end_time', 'end_at')
}

function mapTutorialAudience(session, currentUserId) {
  return session?.tutor_id === currentUserId ? 'Tutoria brindada' : 'Tutoria inscrita'
}

function normalizeKeyword(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function buildSearchableText(fields) {
  return fields
    .map((value) => normalizeKeyword(value))
    .join(' ')
}

function filterByKeyword(items, normalizedKeyword, fieldsExtractor) {
  if (!normalizedKeyword) {
    return items
  }

  return items.filter((item) => {
    const searchableText = buildSearchableText(fieldsExtractor(item))
    return searchableText.includes(normalizedKeyword)
  })
}

function formatTutorialExactDate(session) {
  if (session?.start_at) {
    return formatDateTime(session.start_at)
  }

  if (session?.session_date) {
    return session.session_date
  }

  return 'Fecha no disponible'
}

function UserHistoryPage({ user }) {
  const [reservations, setReservations] = useState([])
  const [tutorials, setTutorials] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL)
  const [keyword, setKeyword] = useState('')

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

      const seenIds = new Set()
      const uniqueTutorials = mergedTutorials.filter((item) => {
        if (!item?.id || seenIds.has(item.id)) {
          return false
        }
        seenIds.add(item.id)
        return true
      })

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

  const normalizedKeyword = useMemo(() => normalizeKeyword(keyword), [keyword])

  const filteredReservationHistory = useMemo(() => {
    return filterByKeyword(reservationHistory, normalizedKeyword, (reservation) => [
      reservation?.laboratory_name,
      reservation?.laboratory_id,
      reservation?.purpose,
      reservation?.status,
      reservation?.start_at,
      reservation?.start_time,
      reservation?.end_time,
    ])
  }, [normalizedKeyword, reservationHistory])

  const filteredTutorialHistory = useMemo(() => {
    return filterByKeyword(tutorialHistory, normalizedKeyword, (session) => [
      session?.topic,
      session?.description,
      session?.tutor_name,
      session?.location,
      session?.laboratory_id,
      session?.session_date,
      session?.start_at,
      session?.end_at,
    ])
  }, [normalizedKeyword, tutorialHistory])

  const shouldShowReservations = activeFilter === FILTER_TYPES.ALL || activeFilter === FILTER_TYPES.RESERVATIONS
  const shouldShowTutorials = activeFilter === FILTER_TYPES.ALL || activeFilter === FILTER_TYPES.TUTORIALS

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
          <strong>{filteredReservationHistory.length}</strong>
        </article>
        <article>
          <span>Tutorias finalizadas</span>
          <strong>{filteredTutorialHistory.length}</strong>
        </article>
      </div>

      <div className="history-controls" aria-label="Filtros del historial">
        <div className="history-tabs" role="tablist" aria-label="Filtrar historial por tipo">
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === FILTER_TYPES.ALL}
            className={`history-tab ${activeFilter === FILTER_TYPES.ALL ? 'is-active' : ''}`}
            onClick={() => setActiveFilter(FILTER_TYPES.ALL)}
          >
            Todo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === FILTER_TYPES.RESERVATIONS}
            className={`history-tab ${activeFilter === FILTER_TYPES.RESERVATIONS ? 'is-active' : ''}`}
            onClick={() => setActiveFilter(FILTER_TYPES.RESERVATIONS)}
          >
            Reservas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === FILTER_TYPES.TUTORIALS}
            className={`history-tab ${activeFilter === FILTER_TYPES.TUTORIALS ? 'is-active' : ''}`}
            onClick={() => setActiveFilter(FILTER_TYPES.TUTORIALS)}
          >
            Tutorias
          </button>
        </div>

        <label className="history-keyword">
          <span>Buscar por palabra clave</span>
          <input
            type="search"
            placeholder="Tutor, tema, materia, fecha, laboratorio..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
      </div>

      {shouldShowReservations ? (
      <section className="history-panel" aria-label="Historial de reservas">
        <div className="history-panel-head">
          <h3>Reservas</h3>
          <p>Incluye reservas pasadas, canceladas o rechazadas.</p>
        </div>

        {isLoading && filteredReservationHistory.length === 0 ? (
          <p className="history-empty">Cargando historial de reservas...</p>
        ) : filteredReservationHistory.length === 0 ? (
          <p className="history-empty">Aun no tienes reservas en historial.</p>
        ) : (
          <div className="history-list">
            {filteredReservationHistory.map((reservation) => (
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
      ) : null}

      {shouldShowTutorials ? (
      <section className="history-panel" aria-label="Historial de tutorias">
        <div className="history-panel-head">
          <h3>Tutorias</h3>
          <p>Sesiones inscritas o impartidas que ya finalizaron.</p>
        </div>

        {isLoading && filteredTutorialHistory.length === 0 ? (
          <p className="history-empty">Cargando historial de tutorias...</p>
        ) : filteredTutorialHistory.length === 0 ? (
          <p className="history-empty">Aun no tienes tutorias finalizadas en historial.</p>
        ) : (
          <div className="history-list">
            {filteredTutorialHistory.map((session) => (
              <article key={session.id} className="history-card">
                <div className="history-card-top">
                  <span className="history-chip">{session.audience}</span>
                  <span className="history-status is-completed">Finalizada</span>
                </div>
                <h4>{session.topic || 'Tutoria'}</h4>
                <p>{session.description || 'Sesion academica finalizada.'}</p>
                <div className="history-meta">
                  <span><strong>Tutor:</strong> {session.tutor_name || 'No disponible'}</span>
                  <span><strong>Tema/Materia:</strong> {session.topic || 'No definido'}</span>
                  <span><strong>Fecha exacta:</strong> {formatTutorialExactDate(session)}</span>
                  <span>{session.location || session.laboratory_id || 'Sin ubicacion'}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      ) : null}
    </section>
  )
}

export default UserHistoryPage
