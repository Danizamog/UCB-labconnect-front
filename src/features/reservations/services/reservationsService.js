import { listAdminLabs } from '../../admin/services/infrastructureService'
import { listUserProfiles } from '../../admin/services/profileService'
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

function normalizeErrorDetail(detail, fallbackMessage) {
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string' && detail.message.trim()) {
      return detail.message
    }

    if (detail.data && typeof detail.data === 'object') {
      const firstEntry = Object.entries(detail.data)[0]
      if (firstEntry) {
        const [field, value] = firstEntry
        if (value && typeof value === 'object' && typeof value.message === 'string' && value.message.trim()) {
          return `${field}: ${value.message}`
        }
      }
    }
  }

  return fallbackMessage
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
    const message = normalizeErrorDetail(data?.detail, `Error ${response.status}`)
    throw new Error(message)
  }
  return data
}

function splitDateTime(isoDateTime = '') {
  const normalized = String(isoDateTime || '').replace(' ', 'T')
  const [datePart = '', timePart = ''] = normalized.split('T')
  const hhmm = timePart.slice(0, 5)
  return { date: datePart, time: hhmm }
}

function buildLabsMap(labs) {
  const map = new Map()
  ;(Array.isArray(labs) ? labs : []).forEach((lab) => {
    const id = String(lab?.id || '').trim()
    if (!id) return
    map.set(id, String(lab?.name || lab?.title || id).trim() || id)
  })
  return map
}

function buildUsersMap(users) {
  const map = new Map()
  ;(Array.isArray(users) ? users : []).forEach((user) => {
    const id = String(user?.id || '').trim()
    if (!id) return
    map.set(id, {
      name: String(user?.name || user?.username || id).trim() || id,
      email: String(user?.username || '').trim(),
    })
  })
  return map
}

function mapReservation(record, context = {}) {
  const labsMap = context.labsMap instanceof Map ? context.labsMap : new Map()
  const usersMap = context.usersMap instanceof Map ? context.usersMap : new Map()
  const { date: startDate, time: startTime } = splitDateTime(record?.start_at)
  const { date: endDate, time: endTime } = splitDateTime(record?.end_at)
  const laboratoryId = String(record?.laboratory_id || '').trim()
  const requesterId = String(record?.requested_by || '').trim()
  const requester = usersMap.get(requesterId)
  const resolvedLabName = String(record?.laboratory_name || '').trim() || labsMap.get(laboratoryId) || laboratoryId
  const resolvedRequesterName = String(record?.requested_by_name || '').trim() || requester?.name || requesterId
  const resolvedRequesterEmail = String(record?.requested_by_email || '').trim() || requester?.email || ''

  return {
    id: record?.id,
    laboratory_id: laboratoryId,
    laboratory_name: resolvedLabName,
    area_id: record?.area_id || '',
    requested_by: requesterId,
    requested_by_name: resolvedRequesterName,
    requested_by_email: resolvedRequesterEmail,
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
  const [data, labsResult, usersResult] = await Promise.all([
    request(`${reservationsBase}/reservations${query}`),
    listAdminLabs().catch(() => []),
    listUserProfiles().catch(() => []),
  ])

  const labsMap = buildLabsMap(labsResult)
  const usersMap = buildUsersMap(usersResult)
  const mapped = Array.isArray(data)
    ? data.map((item) => mapReservation(item, { labsMap, usersMap }))
    : []

  return mapped
    .filter((reservation) => (!filters.requested_by || reservation.requested_by === filters.requested_by))
    .sort((a, b) => {
      if (a.date === b.date) {
        return b.start_time.localeCompare(a.start_time)
      }
      return b.date.localeCompare(a.date)
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

export async function updateReservationStatus(reservationId, status, options = {}) {
  const cancelReason = String(options?.cancel_reason || '').trim()

  const record = await request(`${reservationsBase}/reservations/${reservationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      cancel_reason: status === 'rejected' ? cancelReason : '',
    }),
  })
  return mapReservation(record)
}

export async function markReservationCheckIn(reservationId) {
  const record = await request(`${reservationsBase}/reservations/${reservationId}/check-in`, {
    method: 'PATCH',
  })
  return mapReservation(record)
}

export async function markReservationCheckOut(reservationId) {
  const record = await request(`${reservationsBase}/reservations/${reservationId}/check-out`, {
    method: 'PATCH',
  })
  return mapReservation(record)
}

export async function markReservationAbsent(reservationId) {
  const record = await request(`${reservationsBase}/reservations/${reservationId}/absent`, {
    method: 'PATCH',
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
