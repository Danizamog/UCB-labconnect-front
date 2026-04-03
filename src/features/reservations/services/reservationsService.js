import { listAdminLabs } from '../../admin/services/infrastructureService'
import { getAuthToken } from '../../../shared/utils/storage'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const reservationsBase = gatewayBase.endsWith('/v1') ? gatewayBase : `${gatewayBase}/v1`

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

function splitDateTime(isoDateTime = '') {
  const normalized = String(isoDateTime || '').replace(' ', 'T')
  const [datePart = '', timePart = ''] = normalized.split('T')
  const hhmm = timePart.slice(0, 5)
  return { date: datePart, time: hhmm }
}

function mapReservation(record) {
  const { date: startDate, time: startTime } = splitDateTime(record?.start_at)
  const { date: endDate, time: endTime } = splitDateTime(record?.end_at)

  return {
    id: record?.id,
    laboratory_id: record?.laboratory_id || '',
    laboratory_name: record?.laboratory_name || '',
    area_id: record?.area_id || '',
    requested_by: record?.requested_by || '',
    requested_by_name: record?.requested_by_name || '',
    requested_by_email: record?.requested_by_email || '',
    purpose: record?.purpose || '',
    start_at: record?.start_at || '',
    end_at: record?.end_at || '',
    start_time: startTime,
    end_time: endTime,
    date: startDate || endDate,
    status: record?.status || 'pending',
    notes: record?.notes || '',
    is_active: record?.is_active !== false,
    created: record?.created || '',
    updated: record?.updated || '',
  }
}

function mapPenalty(record) {
  return {
    id: record?.id || '',
    user_id: record?.user_id || '',
    user_name: record?.user_name || '',
    user_email: record?.user_email || '',
    reason: record?.reason || '',
    evidence_type: record?.evidence_type || 'damage_report',
    evidence_report_id: record?.evidence_report_id || '',
    asset_id: record?.asset_id || '',
    related_reservation_id: record?.related_reservation_id || '',
    starts_at: record?.starts_at || '',
    ends_at: record?.ends_at || '',
    notes: record?.notes || '',
    status: record?.status || 'scheduled',
    is_active: Boolean(record?.is_active),
    email_sent: Boolean(record?.email_sent),
    created_at: record?.created_at || '',
    updated_at: record?.updated_at || '',
    created_by: record?.created_by || '',
    created_by_name: record?.created_by_name || '',
    lifted_at: record?.lifted_at || '',
    lifted_by: record?.lifted_by || '',
    lifted_by_name: record?.lifted_by_name || '',
    lift_reason: record?.lift_reason || '',
  }
}

export async function listAvailableLabs() {
  const labs = await listAdminLabs()
  return labs.filter((lab) => lab.is_active !== false)
}

export async function listReservations(filters = {}) {
  const search = new URLSearchParams()
  if (filters.laboratory_id) search.set('laboratory_id', filters.laboratory_id)
  if (filters.date) search.set('day', filters.date)
  if (filters.status) search.set('status', filters.status)

  const query = search.toString() ? `?${search.toString()}` : ''
  const data = await request(`${reservationsBase}/reservations${query}`)
  const mapped = Array.isArray(data) ? data.map(mapReservation) : []

  return mapped
    .filter((reservation) => (!filters.requested_by || reservation.requested_by === filters.requested_by))
    .sort((a, b) => {
      if (a.date === b.date) {
        return a.start_time.localeCompare(b.start_time)
      }
      return a.date.localeCompare(b.date)
    })
}

export async function createReservation(payload, user) {
  const normalized = {
    laboratory_id: String(payload.laboratory_id || ''),
    area_id: String(payload.area_id || ''),
    requested_by: String(user?.user_id || ''),
    purpose: String(payload.purpose || '').trim(),
    start_at: `${payload.date}T${payload.start_time}:00`,
    end_at: `${payload.date}T${payload.end_time}:00`,
    attendees_count: Number(payload.attendees_count || 0) || 0,
    notes: String(payload.notes || ''),
  }

  if (!normalized.laboratory_id || !payload.date || !payload.start_time || !payload.end_time) {
    throw new Error('Debes seleccionar laboratorio, fecha y un rango horario valido.')
  }

  const record = await request(`${reservationsBase}/reservations`, {
    method: 'POST',
    body: JSON.stringify(normalized),
  })
  return mapReservation(record)
}

export async function updateReservationStatus(reservationId, status, actor = 'admin') {
  const record = await request(`${reservationsBase}/reservations/${reservationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      notes: actor,
    }),
  })
  return mapReservation(record)
}

export async function getLabAvailability(laboratoryId, day) {
  if (!laboratoryId || !day) {
    return { slots: [], slot_minutes: 60 }
  }

  const search = new URLSearchParams({ day })
  return request(`${reservationsBase}/availability/labs/${laboratoryId}?${search.toString()}`)
}

export async function listMyPenalties() {
  const data = await request(`${reservationsBase}/penalties/mine`)
  return Array.isArray(data) ? data.map(mapPenalty) : []
}

export async function listPenalties(filters = {}) {
  const search = new URLSearchParams()
  if (filters.active_only) {
    search.set('active_only', 'true')
  }
  const query = search.toString() ? `?${search.toString()}` : ''
  const data = await request(`${reservationsBase}/penalties${query}`)
  return Array.isArray(data) ? data.map(mapPenalty) : []
}

export async function createPenalty(payload) {
  const record = await request(`${reservationsBase}/penalties`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: String(payload.user_id || '').trim(),
      user_name: String(payload.user_name || '').trim(),
      user_email: String(payload.user_email || '').trim().toLowerCase(),
      reason: String(payload.reason || '').trim(),
      evidence_type: String(payload.evidence_type || 'damage_report'),
      evidence_report_id: String(payload.evidence_report_id || '').trim(),
      asset_id: String(payload.asset_id || '').trim(),
      starts_at: String(payload.starts_at || '').trim(),
      ends_at: String(payload.ends_at || '').trim(),
      notes: String(payload.notes || '').trim(),
    }),
  })
  return mapPenalty(record)
}

export async function liftPenalty(penaltyId, options = {}) {
  const data = await request(`${reservationsBase}/penalties/${penaltyId}/lift`, {
    method: 'PATCH',
    body: JSON.stringify({
      lift_reason: String(options.lift_reason || '').trim(),
    }),
  })
  return mapPenalty(data?.penalty || {})
}

export function subscribeReservationsRealtime(onMessage) {
  const wsUrl = (import.meta.env.VITE_RESERVATION_WS_URL || 'ws://localhost:8005/v1/ws/reservations').trim()
  const socket = new WebSocket(wsUrl)

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data)
      onMessage?.(payload)
    } catch {
      onMessage?.(null)
    }
  }

  return () => {
    socket.close()
  }
}
