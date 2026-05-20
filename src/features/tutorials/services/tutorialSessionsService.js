import { getAuthToken } from '../../../shared/utils/storage'
import { subscribeReservationsRealtime } from '../../reservations/services/reservationsService'
import { clearStoredSession } from '../../auth/services/authService'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const tutorialsBase = gatewayBase.endsWith('/v1') ? gatewayBase : `${gatewayBase}/v1`
const requestCache = new Map()
const inFlightRequests = new Map()

function authHeaders(withJson = false) {
  const token = getAuthToken()
  const headers = {
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function parseJson(response, fallback) {
  return response.json().catch(() => fallback)
}

function cloneCachedValue(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function buildRequestCacheKey(url, method, token) {
  return `${method}:${url}:${token || ''}`
}

function clearTutorialSessionsCache() {
  requestCache.clear()
  inFlightRequests.clear()
}

// Prefijos de URL para invalidacion granular. Mutaciones de tutorias no deberian
// tirar todo el cache (afectaba listados publicos / mine / my-enrollments por
// cada accion del tutor o estudiante).
const CACHE_PREFIXES = {
  tutorials: '/tutorial-sessions',
}

function clearCacheByNamespaces(...namespaces) {
  const prefixes = namespaces.map((ns) => CACHE_PREFIXES[ns] || ns).filter(Boolean)
  if (prefixes.length === 0) return
  const matches = (key) => prefixes.some((prefix) => key.includes(prefix))
  for (const key of [...requestCache.keys()]) {
    if (matches(key)) requestCache.delete(key)
  }
  for (const key of [...inFlightRequests.keys()]) {
    if (matches(key)) inFlightRequests.delete(key)
  }
}

async function request(url, options = {}) {
  const { cacheTtlMs = 0, skipCache = false, ...fetchOptions } = options
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const token = getAuthToken() || ''
  const canCache = method === 'GET' && cacheTtlMs > 0 && !skipCache
  const cacheKey = buildRequestCacheKey(url, method, token)

  if (canCache) {
    const cachedEntry = requestCache.get(cacheKey)
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cloneCachedValue(cachedEntry.data)
    }

    const existingRequest = inFlightRequests.get(cacheKey)
    if (existingRequest) {
      return cloneCachedValue(await existingRequest)
    }
  }

  const fetchPromise = (async () => {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...authHeaders(Boolean(fetchOptions.body)),
        ...(fetchOptions.headers || {}),
      },
    })

    const data = await parseJson(response, null)
    if (!response.ok) {
      if (response.status === 401) {
        clearStoredSession()
      }
      throw new Error(data?.detail || `Error ${response.status}`)
    }

    if (canCache) {
      requestCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + cacheTtlMs,
      })
    }

    return data
  })()

  if (canCache) {
    inFlightRequests.set(cacheKey, fetchPromise)
  }

  try {
    const result = await fetchPromise
    return canCache ? cloneCachedValue(result) : result
  } finally {
    if (canCache) {
      inFlightRequests.delete(cacheKey)
    }
  }
}

function mapTutorialSession(record) {
  const enrolledStudents = Array.isArray(record?.enrolled_students) ? record.enrolled_students : []

  return {
    id: record?.id || '',
    tutor_id: record?.tutor_id || '',
    tutor_name: record?.tutor_name || 'Tutor',
    tutor_email: record?.tutor_email || '',
    topic: record?.topic || '',
    description: record?.description || '',
    laboratory_id: record?.laboratory_id || '',
    location: record?.location || '',
    session_date: record?.session_date || '',
    start_time: record?.start_time || '',
    end_time: record?.end_time || '',
    start_at: record?.start_at || '',
    end_at: record?.end_at || '',
    max_students: Number(record?.max_students || 0),
    is_published: record?.is_published !== false,
    approval_status: String(record?.approval_status || 'pending'),
    approval_reason: String(record?.approval_reason || ''),
    tutor_observation: record?.tutor_observation || '',
    enrolled_students: enrolledStudents.map((student) => ({
      student_id: student?.student_id || '',
      student_name: student?.student_name || 'Estudiante',
      student_email: student?.student_email || '',
      created_at: student?.created_at || '',
      attended: student?.attended === true,
      performance_observation: student?.performance_observation || '',
    })),
    created: record?.created || '',
    updated: record?.updated || '',
    enrolled_count: enrolledStudents.length,
    seats_left: Math.max(Number(record?.max_students || 0) - enrolledStudents.length, 0),
  }
}

export async function listPublicTutorialSessions(filters = {}) {
  const params = new URLSearchParams()
  if (filters.topic_search) params.append('topic_search', filters.topic_search)
  if (filters.session_date) params.append('session_date', filters.session_date)
  if (filters.laboratory_id) params.append('laboratory_id', filters.laboratory_id)

  const query = params.toString()
  const url = `${tutorialsBase}/tutorial-sessions${query ? `?${query}` : ''}`
  const data = await request(url, { cacheTtlMs: 5000 })
  return Array.isArray(data) ? data.map(mapTutorialSession) : []
}

export async function listMyTutorialSessions() {
  const data = await request(`${tutorialsBase}/tutorial-sessions/mine`, { cacheTtlMs: 5000 })
  return Array.isArray(data) ? data.map(mapTutorialSession) : []
}

export async function listPendingTutorialSessions() {
  const data = await request(`${tutorialsBase}/tutorial-sessions/pending`, { cacheTtlMs: 1500, skipCache: true })
  return Array.isArray(data) ? data.map(mapTutorialSession) : []
}

export async function updateTutorialSessionApproval(sessionId, statusValue, reason = '') {
  if (!sessionId) {
    throw new Error('No se pudo identificar la tutoria para aprobar o rechazar.')
  }

  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}/approval`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: String(statusValue || ''),
      reason: String(reason || ''),
    }),
  })
  clearCacheByNamespaces('tutorials')
  return mapTutorialSession(record)
}

export async function listMyEnrolledTutorialSessions() {
  const data = await request(`${tutorialsBase}/tutorial-sessions/my-enrollments`, { cacheTtlMs: 5000 })
  return Array.isArray(data) ? data.map(mapTutorialSession) : []
}

export async function getTutorialSessionById(sessionId) {
  if (!sessionId) {
    throw new Error('No se pudo identificar la tutoria seleccionada.')
  }

  const data = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}`, { cacheTtlMs: 5000 })
  return mapTutorialSession(data || {})
}

export async function createTutorialSession(payload) {
  const record = await request(`${tutorialsBase}/tutorial-sessions`, {
    method: 'POST',
    body: JSON.stringify({
      topic: String(payload.topic || '').trim(),
      description: String(payload.description || '').trim(),
      laboratory_id: String(payload.laboratory_id || '').trim(),
      location: String(payload.location || '').trim(),
      session_date: String(payload.session_date || ''),
      start_time: String(payload.start_time || ''),
      end_time: String(payload.end_time || ''),
      max_students: Number(payload.max_students || 0),
      ...(payload.tutor_name ? { tutor_name: String(payload.tutor_name).trim() } : {}),
    }),
  })
  clearCacheByNamespaces('tutorials')
  return mapTutorialSession(record)
}

export async function updateTutorialSession(sessionId, payload) {
  if (!sessionId) {
    throw new Error('No se pudo identificar la tutoria a actualizar.')
  }

  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      topic: String(payload.topic || '').trim(),
      description: String(payload.description || '').trim(),
      laboratory_id: String(payload.laboratory_id || '').trim(),
      location: String(payload.location || '').trim(),
      session_date: String(payload.session_date || ''),
      start_time: String(payload.start_time || ''),
      end_time: String(payload.end_time || ''),
      max_students: Number(payload.max_students || 0),
      ...(payload.tutor_name ? { tutor_name: String(payload.tutor_name).trim() } : {}),
      ...(payload.tutor_email ? { tutor_email: String(payload.tutor_email).trim() } : {}),
    }),
  })
  clearCacheByNamespaces('tutorials')
  return mapTutorialSession(record)
}

export async function updateTutorialSessionObservation(sessionId, tutorObservation) {
  if (!sessionId) {
    throw new Error('No se pudo identificar la tutoria para registrar observaciones.')
  }

  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}/observation`, {
    method: 'PATCH',
    body: JSON.stringify({
      tutor_observation: String(tutorObservation || '').trim(),
    }),
  })
  clearCacheByNamespaces('tutorials')
  return mapTutorialSession(record)
}

export async function updateTutorialEnrollmentAttendance(sessionId, studentId, payload) {
  if (!sessionId) {
    throw new Error('No se pudo identificar la tutoria para registrar asistencia.')
  }
  if (!studentId) {
    throw new Error('No se pudo identificar al estudiante inscrito.')
  }

  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}/attendance/${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      attended: payload?.attended === true,
      performance_observation: String(payload?.performance_observation || '').trim().slice(0, 200),
    }),
  })
  clearCacheByNamespaces('tutorials')
  return mapTutorialSession(record)
}

export async function deleteTutorialSession(sessionId) {
  await request(`${tutorialsBase}/tutorial-sessions/${sessionId}`, {
    method: 'DELETE',
  })
  clearCacheByNamespaces('tutorials')
}

export async function enrollInTutorialSession(sessionId) {
  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}/enroll`, {
    method: 'POST',
  })
  clearCacheByNamespaces('tutorials')
  return mapTutorialSession(record)
}

export async function cancelTutorialEnrollment(sessionId) {
  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}/enroll`, {
    method: 'DELETE',
  })
  clearCacheByNamespaces('tutorials')
  return mapTutorialSession(record)
}

export function subscribeTutorialSessionsRealtime(onMessage, options = {}) {
  const { topics: extraTopics, laboratoryIds, ...rest } = options
  const topics = Array.isArray(extraTopics) && extraTopics.length > 0
    ? extraTopics
    : ['tutorial_session', 'user_notification']

  return subscribeReservationsRealtime((event) => {
    if (event?.topic === 'tutorial_session' || event?.topic === 'user_notification') {
      onMessage?.(event)
    }
  }, { ...rest, topics, laboratoryIds })
}
