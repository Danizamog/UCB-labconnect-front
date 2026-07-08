import { getAuthToken } from '../../../shared/utils/storage'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const reservationsBase = gatewayBase.endsWith('/v1') ? gatewayBase : `${gatewayBase}/v1`

export const ACADEMIC_BLOCKS = [
  { start_time: '07:15', end_time: '08:00' },
  { start_time: '08:00', end_time: '08:45' },
  { start_time: '09:00', end_time: '09:45' },
  { start_time: '09:45', end_time: '10:30' },
  { start_time: '10:45', end_time: '11:30' },
  { start_time: '11:30', end_time: '12:15' },
  { start_time: '12:30', end_time: '13:15' },
  { start_time: '13:15', end_time: '14:00' },
  { start_time: '14:15', end_time: '15:00' },
  { start_time: '15:00', end_time: '15:45' },
  { start_time: '16:00', end_time: '16:45' },
  { start_time: '16:45', end_time: '17:30' },
  { start_time: '17:45', end_time: '18:30' },
  { start_time: '18:30', end_time: '19:15' },
  { start_time: '19:30', end_time: '20:15' },
  { start_time: '20:15', end_time: '21:00' },
]

export const WEEKDAYS = [
  { value: 0, label: 'Lunes', short: 'Lun' },
  { value: 1, label: 'Martes', short: 'Mar' },
  { value: 2, label: 'Miercoles', short: 'Mie' },
  { value: 3, label: 'Jueves', short: 'Jue' },
  { value: 4, label: 'Viernes', short: 'Vie' },
  { value: 5, label: 'Sabado', short: 'Sab' },
  { value: 6, label: 'Domingo', short: 'Dom' },
]

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

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  })

  if (response.status === 204) {
    return null
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`)
  }
  return data
}

function mapSchedule(record) {
  return {
    id: record?.id || '',
    laboratory_id: record?.laboratory_id || '',
    weekday: Number(record?.weekday ?? 0),
    start_time: record?.start_time || '',
    end_time: record?.end_time || '',
    subject: record?.subject || '',
    description: record?.description || '',
    is_active: record?.is_active !== false,
    teacher_id: record?.teacher_id || '',
    teacher_name: record?.teacher_name || '',
    created: record?.created || '',
    updated: record?.updated || '',
  }
}

export async function listLabSchedules({ laboratory_id, weekday, teacher_id } = {}) {
  const params = new URLSearchParams()
  if (laboratory_id) params.set('laboratory_id', laboratory_id)
  if (teacher_id) params.set('teacher_id', teacher_id)
  if (weekday !== undefined && weekday !== null && weekday !== '') {
    params.set('weekday', String(weekday))
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  const data = await request(`${reservationsBase}/lab-schedules${query}`)
  return Array.isArray(data) ? data.map(mapSchedule) : []
}

// Clases asignadas al docente autenticado (para el portal docente).
export async function listMyTeacherClasses() {
  const data = await request(`${reservationsBase}/lab-schedules?teacher_id=me`)
  return Array.isArray(data) ? data.map(mapSchedule) : []
}

export async function createLabSchedule(payload) {
  const data = await request(`${reservationsBase}/lab-schedules`, {
    method: 'POST',
    body: JSON.stringify({
      laboratory_id: String(payload.laboratory_id || ''),
      weekday: Number(payload.weekday),
      start_time: String(payload.start_time || ''),
      end_time: String(payload.end_time || ''),
      subject: String(payload.subject || '').trim(),
      description: String(payload.description || '').trim(),
      teacher_id: String(payload.teacher_id || ''),
      teacher_name: String(payload.teacher_name || '').trim(),
      is_active: payload.is_active !== false,
    }),
  })
  return mapSchedule(data || {})
}

export async function updateLabSchedule(scheduleId, payload) {
  const body = {}
  if (payload.laboratory_id !== undefined) body.laboratory_id = String(payload.laboratory_id)
  if (payload.weekday !== undefined) body.weekday = Number(payload.weekday)
  if (payload.start_time !== undefined) body.start_time = String(payload.start_time)
  if (payload.end_time !== undefined) body.end_time = String(payload.end_time)
  if (payload.subject !== undefined) body.subject = String(payload.subject).trim()
  if (payload.description !== undefined) body.description = String(payload.description).trim()
  if (payload.teacher_id !== undefined) body.teacher_id = String(payload.teacher_id || '')
  if (payload.teacher_name !== undefined) body.teacher_name = String(payload.teacher_name || '').trim()
  if (payload.is_active !== undefined) body.is_active = Boolean(payload.is_active)

  const data = await request(`${reservationsBase}/lab-schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return mapSchedule(data || {})
}

export async function deleteLabSchedule(scheduleId) {
  await request(`${reservationsBase}/lab-schedules/${scheduleId}`, {
    method: 'DELETE',
  })
  return true
}
