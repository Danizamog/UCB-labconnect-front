import { getAuthToken } from '../../../shared/utils/storage'
import { subscribeReservationsRealtime } from '../../reservations/services/reservationsService'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const tutorialsBase = gatewayBase.endsWith('/v1') ? gatewayBase : `${gatewayBase}/v1`

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

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  })

  const data = await parseJson(response, null)
  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`)
  }
  return data
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
    enrolled_students: enrolledStudents.map((student) => ({
      student_id: student?.student_id || '',
      student_name: student?.student_name || 'Estudiante',
      student_email: student?.student_email || '',
      created_at: student?.created_at || '',
    })),
    created: record?.created || '',
    updated: record?.updated || '',
    enrolled_count: enrolledStudents.length,
    seats_left: Math.max(Number(record?.max_students || 0) - enrolledStudents.length, 0),
  }
}

export async function listPublicTutorialSessions() {
  const data = await request(`${tutorialsBase}/tutorial-sessions`)
  return Array.isArray(data) ? data.map(mapTutorialSession) : []
}

export async function listMyTutorialSessions() {
  const data = await request(`${tutorialsBase}/tutorial-sessions/mine`)
  return Array.isArray(data) ? data.map(mapTutorialSession) : []
}

export async function listMyEnrolledTutorialSessions() {
  const data = await request(`${tutorialsBase}/tutorial-sessions/my-enrollments`)
  return Array.isArray(data) ? data.map(mapTutorialSession) : []
}

export async function getTutorialSessionById(sessionId) {
  if (!sessionId) {
    throw new Error('No se pudo identificar la tutoria seleccionada.')
  }

  const data = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}`)
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
  return mapTutorialSession(record)
}

export async function deleteTutorialSession(sessionId) {
  await request(`${tutorialsBase}/tutorial-sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

export async function enrollInTutorialSession(sessionId) {
  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}/enroll`, {
    method: 'POST',
  })
  return mapTutorialSession(record)
}

export async function cancelTutorialEnrollment(sessionId) {
  const record = await request(`${tutorialsBase}/tutorial-sessions/${sessionId}/enroll`, {
    method: 'DELETE',
  })
  return mapTutorialSession(record)
}

export function subscribeTutorialSessionsRealtime(onMessage) {
  return subscribeReservationsRealtime((event) => {
    if (event?.topic === 'tutorial_session' || event?.topic === 'user_notification') {
      onMessage?.(event)
    }
  })
}
