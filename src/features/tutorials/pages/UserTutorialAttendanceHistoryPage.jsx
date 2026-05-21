import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listMyEnrolledTutorialSessions,
  listMyTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../services/tutorialSessionsService'
import { formatLocalDateTime, parseLocalDateTime } from '../../../shared/utils/formatters'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './UserTutorialAttendanceHistoryPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function normalizeKeyword(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// start_at/end_at del backend vienen marcados con 'Z' aunque la hora es local.
// parseLocalDateTime evita que Date() les aplique la conversion UTC -> local
// (en Bolivia, UTC-4, esto correria las horas 4 hs hacia atras).
function parseDateTimeValue(value) {
  return parseLocalDateTime(value)
}

function normalizeTimeValue(timeValue) {
  const raw = String(timeValue || '').trim()
  if (!raw) {
    return ''
  }

  const [hours = '', minutes = '', seconds = ''] = raw.split(':')
  if (!hours || !minutes) {
    return ''
  }

  const safeHours = String(hours).padStart(2, '0')
  const safeMinutes = String(minutes).padStart(2, '0')
  const safeSeconds = String(seconds || '00').padStart(2, '0')
  return `${safeHours}:${safeMinutes}:${safeSeconds}`
}

function parseSessionDateAndTime(sessionDate, sessionTime) {
  if (!sessionDate || !sessionTime) {
    return null
  }

  const normalizedTime = normalizeTimeValue(sessionTime)
  if (!normalizedTime) {
    return null
  }

  return parseDateTimeValue(`${sessionDate}T${normalizedTime}`)
}

function parseSessionStart(session) {
  if (session?.start_at) {
    const parsed = parseDateTimeValue(session.start_at)
    if (parsed) {
      return parsed
    }
  }

  return parseSessionDateAndTime(session?.session_date, session?.start_time)
}

function parseSessionEnd(session) {
  if (session?.end_at) {
    const parsed = parseDateTimeValue(session.end_at)
    if (parsed) {
      return parsed
    }
  }

  return parseSessionDateAndTime(session?.session_date, session?.end_time)
}

function getSessionDateLabel(session) {
  if (session?.start_at) {
    return formatLocalDateTime(session.start_at)
  }
  const sessionStartAt = parseSessionStart(session)
  if (!sessionStartAt) {
    return session?.session_date || 'Sin fecha'
  }
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(sessionStartAt)
}

function UserTutorialAttendanceHistoryPage({ user }) {
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const canManageTutorials = hasAnyPermission(user, ['gestionar_tutorias'])

  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const fetchers = [listMyEnrolledTutorialSessions()]
      if (canManageTutorials) {
        fetchers.push(listMyTutorialSessions())
      }
      const results = await Promise.allSettled(fetchers)
      const [enrolledResult, taughtResult] = results

      const merged = []
      if (enrolledResult?.status === 'fulfilled' && Array.isArray(enrolledResult.value)) {
        merged.push(...enrolledResult.value)
      }
      if (taughtResult?.status === 'fulfilled' && Array.isArray(taughtResult.value)) {
        merged.push(...taughtResult.value)
      }

      const seenIds = new Set()
      const uniqueSessions = merged.filter((item) => {
        const sessionId = String(item?.id || '')
        if (!sessionId || seenIds.has(sessionId)) {
          return false
        }
        seenIds.add(sessionId)
        return true
      })

      setSessions(uniqueSessions)
    } catch (err) {
      setSessions([])
      setError(err.message || 'No se pudo cargar el historial de tutorias atendidas.')
    } finally {
      setIsLoading(false)
    }
  }, [canManageTutorials])

  const reloadTimerRef = useRef(null)

  useEffect(() => {
    loadSessions()

    const userId = String(user?.user_id || '')
    const scheduleReload = () => {
      window.clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = window.setTimeout(loadSessions, 1500)
    }

    const unsubscribe = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic === 'tutorial_session') {
        if (!userId) return
        const tutorId = String(event?.record?.tutor_id || '')
        const enrolled = Array.isArray(event?.record?.enrolled_students) ? event.record.enrolled_students : []
        const concerns =
          tutorId === userId
          || enrolled.some((student) => String(student?.student_id || '') === userId)
        if (concerns) scheduleReload()
        return
      }

      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === userId || recipients.includes(userId)
        if (isCurrentUserNotification) scheduleReload()
      }
    })

    return () => {
      window.clearTimeout(reloadTimerRef.current)
      unsubscribe?.()
    }
  }, [loadSessions, user?.user_id])

  // Parsea fechas una sola vez por sesion: filter + sort + total horas comparten
  // este array preprocesado. Sin esto el sort llama parseSessionEnd 2 veces por
  // elemento y el total recorre todo otra vez.
  const completedEntries = useMemo(() => {
    const now = Date.now()
    const entries = []
    for (const session of sessions) {
      const startMs = parseSessionStart(session)?.getTime() ?? 0
      const endMs = parseSessionEnd(session)?.getTime() ?? 0
      if (endMs && endMs <= now) {
        entries.push({ session, startMs, endMs })
      }
    }
    entries.sort((a, b) => b.endMs - a.endMs)
    return entries
  }, [sessions])

  const completedSessions = useMemo(
    () => completedEntries.map((entry) => entry.session),
    [completedEntries],
  )

  const totalHours = useMemo(() => {
    let acc = 0
    for (const { startMs, endMs } of completedEntries) {
      if (startMs && endMs) acc += Math.max(endMs - startMs, 0)
    }
    return acc
  }, [completedEntries])

  const totalHoursRounded = Math.round((totalHours / (1000 * 60 * 60)) * 10) / 10

  const normalizedKeyword = useMemo(() => normalizeKeyword(keyword), [keyword])

  const filteredSessions = useMemo(() => {
    if (!normalizedKeyword) return completedSessions
    return completedSessions.filter((session) => {
      const searchable = [
        session?.topic,
        session?.description,
        session?.tutor_name,
        session?.location,
        session?.laboratory_id,
        session?.session_date,
        session?.tutor_observation,
      ]
        .map((field) => normalizeKeyword(field))
        .join(' ')
      return searchable.includes(normalizedKeyword)
    })
  }, [completedSessions, normalizedKeyword])

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const visibleSessions = useMemo(() => {
    const start = safePage * pageSize
    return filteredSessions.slice(start, start + pageSize)
  }, [filteredSessions, safePage, pageSize])

  useEffect(() => {
    setPage(0)
  }, [normalizedKeyword, pageSize])

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

        <label className="tutorial-history-search">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="Tema, tutor, ubicación, fecha..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            aria-label="Buscar tutoria por palabra clave"
          />
        </label>

        {isLoading && filteredSessions.length === 0 ? (
          <p className="tutorial-history-empty">Cargando historial de tutorias...</p>
        ) : filteredSessions.length === 0 ? (
          <p className="tutorial-history-empty">
            {normalizedKeyword
              ? 'Ninguna tutoria de tu historial coincide con la búsqueda.'
              : 'Aun no tienes tutorias atendidas en tu historial.'}
          </p>
        ) : (
          <>
          <div className="tutorial-history-list">
            {visibleSessions.map((session) => (
              <article key={session.id} className="tutorial-history-card">
                <div className="tutorial-history-card-top">
                  <span className="tutorial-history-chip">Tutoria atendida</span>
                  <span className="tutorial-history-status">Finalizada</span>
                </div>

                <h4>{session.topic || 'Tutoria'}</h4>
                <p>{session.description || 'Sesion academica completada.'}</p>

                <div className="tutorial-history-meta">
                  <span><strong>Tutor:</strong> {session.tutor_name || 'No disponible'}</span>
                  <span><strong>Fecha:</strong> {getSessionDateLabel(session)}</span>
                  <span><strong>Horario:</strong> {session.start_time} - {session.end_time}</span>
                  <span><strong>Lugar:</strong> {session.location || session.laboratory_id || 'Sin ubicacion'}</span>
                </div>

                {session.tutor_observation ? (
                  <div className="tutorial-history-observation">
                    <strong>Observacion del tutor</strong>
                    <p>{session.tutor_observation}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          {filteredSessions.length > pageSize ? (
            <div className="tutorial-history-pagination">
              <span className="tutorial-history-pagination-info">
                Página {safePage + 1} de {totalPages} — {filteredSessions.length} tutoria{filteredSessions.length === 1 ? '' : 's'}
              </span>
              <div className="tutorial-history-pagination-controls">
                <label>
                  <span className="visually-hidden">Tutorias por página</span>
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value) || PAGE_SIZE_OPTIONS[0])}
                    aria-label="Tutorias por página"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} por página</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={safePage <= 0}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={safePage + 1 >= totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>
    </section>
  )
}

export default UserTutorialAttendanceHistoryPage
