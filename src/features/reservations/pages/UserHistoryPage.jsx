import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  searchMyReservationHistory,
  subscribeReservationsRealtime,
} from '../services/reservationsService'
import {
  listMyEnrolledTutorialSessions,
  listMyTutorialSessions,
} from '../../tutorials/services/tutorialSessionsService'
import { formatLocalDateTime, formatStatus, parseLocalDateTime } from '../../../shared/utils/formatters'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './UserHistoryPage.css'

const FILTER_TYPES = {
  ALL: 'all',
  RESERVATIONS: 'reservations',
  TUTORIALS: 'tutorials',
}
const RESERVATION_PAGE_SIZE_OPTIONS = [10, 25, 50]
const TUTORIAL_VISIBLE_INITIAL = 20
const TUTORIAL_VISIBLE_STEP = 20

// Usar parseLocalDateTime para que start_at/end_at (que el backend devuelve
// como UTC pero contiene la hora local del usuario) no se corra por la zona
// horaria del navegador al hacer comparaciones contra Date.now().
function parseDateTimeValue(value) {
  return parseLocalDateTime(value)
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
    return formatLocalDateTime(session.start_at)
  }

  if (session?.session_date) {
    return session.session_date
  }

  return 'Fecha no disponible'
}

function UserHistoryPage({ user }) {
  const [reservations, setReservations] = useState([])
  const [reservationPage, setReservationPage] = useState(0)
  const [reservationPageSize, setReservationPageSize] = useState(RESERVATION_PAGE_SIZE_OPTIONS[0])
  const [reservationTotalElements, setReservationTotalElements] = useState(0)
  const [reservationTotalPages, setReservationTotalPages] = useState(0)
  const [isLoadingReservations, setIsLoadingReservations] = useState(false)
  const [tutorials, setTutorials] = useState([])
  const [tutorialVisibleCount, setTutorialVisibleCount] = useState(TUTORIAL_VISIBLE_INITIAL)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL)
  const [keyword, setKeyword] = useState('')

  const loadReservationsOnly = useCallback(async (options = {}) => {
    const pageNumber = Number.isInteger(options.pageNumber) ? options.pageNumber : reservationPage
    const pageSize = options.pageSize || reservationPageSize
    setIsLoadingReservations(true)
    try {
      const result = await searchMyReservationHistory({
        pageNumber,
        pageSize,
        sortBy: 'start_at',
        sortType: 'DESC',
        skipCache: Boolean(options.skipCache),
      })
      setReservations(Array.isArray(result?.items) ? result.items : [])
      setReservationTotalElements(Number(result?.totalElements || 0))
      setReservationTotalPages(Number(result?.totalPages || 0))
    } catch {
      setReservations([])
      setReservationTotalElements(0)
      setReservationTotalPages(0)
    } finally {
      setIsLoadingReservations(false)
    }
  }, [reservationPage, reservationPageSize])

  const canManageTutorials = hasAnyPermission(user, ['gestionar_tutorias'])

  const loadTutorialsOnly = useCallback(async () => {
    try {
      const fetchers = [listMyEnrolledTutorialSessions()]
      if (canManageTutorials) {
        fetchers.push(listMyTutorialSessions())
      }
      const results = await Promise.allSettled(fetchers)

      const merged = []
      results.forEach((result) => {
        if (result?.status === 'fulfilled' && Array.isArray(result.value)) {
          merged.push(...result.value)
        }
      })

      const seenIds = new Set()
      setTutorials(merged.filter((item) => {
        if (!item?.id || seenIds.has(item.id)) return false
        seenIds.add(item.id)
        return true
      }))
    } catch {
      setTutorials([])
    }
  }, [canManageTutorials])

  const loadHistory = useCallback(async (options = {}) => {
    setIsLoading(true)
    setError('')
    try {
      await Promise.all([loadReservationsOnly(options), loadTutorialsOnly()])
    } catch {
      setError('No se pudo cargar el historial en este momento.')
    } finally {
      setIsLoading(false)
    }
  }, [loadReservationsOnly, loadTutorialsOnly])

  const tutorialReloadTimerRef = useRef(null)
  const reservationsReloadTimerRef = useRef(null)
  const userIdRef = useRef(String(user?.user_id || ''))
  const loadReservationsOnlyRef = useRef(loadReservationsOnly)
  const loadTutorialsOnlyRef = useRef(loadTutorialsOnly)
  const loadHistoryRef = useRef(loadHistory)

  useEffect(() => {
    userIdRef.current = String(user?.user_id || '')
  }, [user?.user_id])

  useEffect(() => {
    loadReservationsOnlyRef.current = loadReservationsOnly
  }, [loadReservationsOnly])

  useEffect(() => {
    loadTutorialsOnlyRef.current = loadTutorialsOnly
  }, [loadTutorialsOnly])

  useEffect(() => {
    loadHistoryRef.current = loadHistory
  }, [loadHistory])

  useEffect(() => {
    loadReservationsOnly()
  }, [loadReservationsOnly])

  useEffect(() => {
    loadTutorialsOnly()
  }, [loadTutorialsOnly])

  useEffect(() => {
    const scheduleTutorialReload = () => {
      window.clearTimeout(tutorialReloadTimerRef.current)
      tutorialReloadTimerRef.current = window.setTimeout(() => {
        loadTutorialsOnlyRef.current?.()
      }, 1500)
    }

    const scheduleReservationsReload = () => {
      window.clearTimeout(reservationsReloadTimerRef.current)
      reservationsReloadTimerRef.current = window.setTimeout(() => {
        loadReservationsOnlyRef.current?.({ skipCache: true })
      }, 800)
    }

    const tutorialEventConcernsUser = (event) => {
      const userId = userIdRef.current
      if (!userId) return false
      const record = event?.record || {}
      if (String(record.tutor_id || '') === userId) return true
      const enrolled = Array.isArray(record.enrolled_students) ? record.enrolled_students : []
      return enrolled.some((student) => String(student?.student_id || '') === userId)
    }

    const notificationConcernsUser = (event) => {
      const userId = userIdRef.current
      if (!userId) return false
      const recipients = Array.isArray(event?.recipients) ? event.recipients : []
      return event?.record?.recipient_user_id === userId || recipients.includes(userId)
    }

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'lab_reservation') {
        const requestedBy = String(event?.record?.requested_by || '')
        if (requestedBy && requestedBy === userIdRef.current) {
          scheduleReservationsReload()
        }
        return
      }
      if (event?.topic === 'tutorial_session') {
        if (tutorialEventConcernsUser(event)) {
          scheduleTutorialReload()
        }
        return
      }
      if (event?.topic === 'user_notification' && notificationConcernsUser(event)) {
        scheduleTutorialReload()
      }
    }, {
      topics: ['lab_reservation', 'tutorial_session', 'user_notification'],
      onResync: () => loadHistoryRef.current?.({ skipCache: true }),
    })

    return () => {
      window.clearTimeout(tutorialReloadTimerRef.current)
      window.clearTimeout(reservationsReloadTimerRef.current)
      unsubscribe?.()
    }
  }, [])

  const reservationHistory = reservations

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

  const visibleTutorialHistory = useMemo(
    () => filteredTutorialHistory.slice(0, tutorialVisibleCount),
    [filteredTutorialHistory, tutorialVisibleCount],
  )

  useEffect(() => {
    setTutorialVisibleCount(TUTORIAL_VISIBLE_INITIAL)
  }, [normalizedKeyword])

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
          <strong>{reservationTotalElements}</strong>
        </article>
        <article>
          <span>Tutorias finalizadas</span>
          <strong>{tutorialHistory.length}</strong>
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
          <p>
            Incluye tus reservas aprobadas, en curso, completadas, canceladas o rechazadas.
            {normalizedKeyword ? ' La búsqueda filtra solo la página actual.' : ''}
          </p>
        </div>

        {isLoadingReservations && filteredReservationHistory.length === 0 ? (
          <p className="history-empty">Cargando historial de reservas...</p>
        ) : filteredReservationHistory.length === 0 ? (
          <p className="history-empty">
            {normalizedKeyword
              ? 'Ninguna reserva de esta página coincide con la búsqueda. Cambia de página o limpia el filtro.'
              : 'Aun no tienes reservas en historial.'}
          </p>
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
                  <span>{formatLocalDateTime(reservation.start_at)}</span>
                  <span>{reservation.start_time} - {reservation.end_time}</span>
                </div>
                {reservation.cancel_reason ? <p className="history-warning">Motivo: {reservation.cancel_reason}</p> : null}
              </article>
            ))}
          </div>
        )}

        {reservationTotalElements > 0 ? (
          <div className="history-pagination">
            <span className="history-pagination-info">
              Página {Math.min(reservationPage + 1, Math.max(reservationTotalPages, 1))} de {Math.max(reservationTotalPages, 1)}
              {' '}— {reservationTotalElements} reserva{reservationTotalElements === 1 ? '' : 's'} en total
            </span>
            <div className="history-pagination-controls">
              <label>
                <span className="visually-hidden">Reservas por página</span>
                <select
                  value={reservationPageSize}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value) || RESERVATION_PAGE_SIZE_OPTIONS[0]
                    setReservationPageSize(nextSize)
                    setReservationPage(0)
                  }}
                  aria-label="Reservas por página"
                >
                  {RESERVATION_PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size} por página</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setReservationPage((prev) => Math.max(prev - 1, 0))}
                disabled={reservationPage <= 0 || isLoadingReservations}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setReservationPage((prev) => prev + 1)}
                disabled={reservationPage + 1 >= reservationTotalPages || isLoadingReservations}
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
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
          <>
          <div className="history-list">
            {visibleTutorialHistory.map((session) => (
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
          {filteredTutorialHistory.length > visibleTutorialHistory.length ? (
            <div className="history-pagination">
              <span className="history-pagination-info">
                Mostrando {visibleTutorialHistory.length} de {filteredTutorialHistory.length}
              </span>
              <div className="history-pagination-controls">
                <button
                  type="button"
                  onClick={() => setTutorialVisibleCount((prev) => prev + TUTORIAL_VISIBLE_STEP)}
                >
                  Ver mas
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>
      ) : null}
    </section>
  )
}

export default UserHistoryPage
