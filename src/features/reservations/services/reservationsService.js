import { listAdminLabs } from '../../admin/services/infrastructureService'
import { getAuthToken } from '../../../shared/utils/storage'
import { clearStoredSession } from '../../auth/services/authService'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const reservationsBase = gatewayBase.endsWith('/v1') ? gatewayBase : `${gatewayBase}/v1`
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

function buildRequestCacheKey(url, options = {}, token = '') {
  const method = String(options.method || 'GET').toUpperCase()
  return `${method}:${url}:${token}`
}

function clearReservationsCache() {
  requestCache.clear()
  inFlightRequests.clear()
}

async function request(url, options = {}) {
  const { cacheTtlMs = 0, skipCache = false, ...fetchOptions } = options
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const token = getAuthToken() || ''
  const canCache = method === 'GET' && cacheTtlMs > 0 && !skipCache
  const cacheKey = buildRequestCacheKey(url, fetchOptions, token)

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

function splitDateTime(isoDateTime = '') {
  const normalized = String(isoDateTime || '').replace(' ', 'T')
  const [datePart = '', timePart = ''] = normalized.split('T')
  const hhmm = timePart.slice(0, 5)
  return { date: datePart, time: hhmm }
}

function mapReservation(record) {
  const { date: startDate, time: startTime } = splitDateTime(record?.start_at)
  const { date: endDate, time: endTime } = splitDateTime(record?.end_at)
  const { time: checkInTime } = splitDateTime(record?.check_in_at)
  const { time: checkOutTime } = splitDateTime(record?.check_out_at)

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
    cancel_reason: record?.cancel_reason || '',
    is_active: record?.is_active !== false,
    created: record?.created || '',
    updated: record?.updated || '',
    station_label: record?.station_label || '',
    check_in_at: record?.check_in_at || '',
    check_out_at: record?.check_out_at || '',
    check_in_time: checkInTime || '',
    check_out_time: checkOutTime || '',
    is_walk_in: Boolean(record?.is_walk_in),
    user_modification_count: Number(record?.user_modification_count || 0),
  }
}

function mapReservationPage(record) {
  return {
    items: Array.isArray(record?.items) ? record.items.map(mapReservation) : [],
    pageNumber: Number(record?.pageNumber || 0),
    pageSize: Number(record?.pageSize || 10),
    totalElements: Number(record?.totalElements || 0),
    totalPages: Number(record?.totalPages || 0),
    sortBy: String(record?.sortBy || 'start_at'),
    sortType: String(record?.sortType || 'DESC').toUpperCase(),
    where: String(record?.where || ''),
  }
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export function isLabAccessibleToUser(lab, user) {
  if (!lab || lab.is_active === false) {
    return false
  }

  const permissions = Array.isArray(user?.permissions) ? user.permissions : []
  if (user?.role === 'admin' || permissions.includes('*')) {
    return true
  }

  const allowedRoles = normalizeStringArray(lab?.allowed_roles)
  if (allowedRoles.length > 0 && !allowedRoles.includes(String(user?.role || '').trim())) {
    return false
  }

  const allowedUserIds = normalizeStringArray(lab?.allowed_user_ids)
  if (allowedUserIds.length > 0 && !allowedUserIds.includes(String(user?.user_id || '').trim())) {
    return false
  }

  const requiredPermissions = normalizeStringArray(lab?.required_permissions)
  if (requiredPermissions.length > 0 && !requiredPermissions.some((permission) => permissions.includes(permission))) {
    return false
  }

  return true
}

function mapNotification(record) {
  const payload = record?.payload && typeof record.payload === 'object' ? record.payload : {}
  const previousStart = splitDateTime(payload?.old_start_at)
  const previousEnd = splitDateTime(payload?.old_end_at)
  const nextStart = splitDateTime(payload?.new_start_at)
  const nextEnd = splitDateTime(payload?.new_end_at)
  const reminderStart = splitDateTime(payload?.starts_at)
  const reservationStart = splitDateTime(payload?.start_at)
  const tutorialOldStart = {
    date: payload?.old_session_date || '',
    time: payload?.old_start_time || '',
  }
  const tutorialOldEnd = {
    date: payload?.old_session_date || '',
    time: payload?.old_end_time || '',
  }
  const tutorialNewStart = {
    date: payload?.new_session_date || '',
    time: payload?.new_start_time || '',
  }
  const tutorialNewEnd = {
    date: payload?.new_session_date || '',
    time: payload?.new_end_time || '',
  }

  return {
    id: record?.id || '',
    recipient_user_id: record?.recipient_user_id || '',
    type: record?.notification_type || '',
    title: record?.title || 'Cambio detectado',
    message: record?.message || '',
    is_read: Boolean(record?.is_read),
    created_at: record?.created_at || '',
    payload,
    reservation_id: payload?.reservation_id || '',
    purpose: payload?.purpose || payload?.topic || '',
    change_kinds: Array.isArray(payload?.change_kinds) ? payload.change_kinds : [],
    old_laboratory_id: payload?.old_laboratory_id || '',
    new_laboratory_id: payload?.new_laboratory_id || '',
    old_laboratory_name: payload?.old_laboratory_name || '',
    new_laboratory_name: payload?.new_laboratory_name || '',
    old_date: previousStart.date || previousEnd.date || '',
    new_date: nextStart.date || nextEnd.date || '',
    old_time_range: previousStart.time && previousEnd.time ? `${previousStart.time} - ${previousEnd.time}` : '',
    new_time_range: nextStart.time && nextEnd.time ? `${nextStart.time} - ${nextEnd.time}` : '',
    actor_name: payload?.actor_name || '',
    reminder_kind: payload?.reminder_kind || '',
    reminder_laboratory_id: payload?.laboratory_id || '',
    reminder_date: reminderStart.date || payload?.session_date || '',
    reminder_time: reminderStart.time || payload?.start_time || '',
    reminder_end_time: payload?.end_time || '',
    reminder_location: payload?.location || payload?.laboratory_name || '',
    reminder_tutor_name: payload?.tutor_name || '',
    reminder_event_type: record?.notification_type === 'tutorial_reminder' ? 'tutorial' : 'reservation',
    status: payload?.status || '',
    cancel_reason: payload?.cancel_reason || '',
    target_path: payload?.target_path || '',
    tutorial_session_id: payload?.tutorial_session_id || '',
    tutorial_date: payload?.session_date || payload?.new_session_date || '',
    tutorial_start_time: payload?.start_time || payload?.new_start_time || '',
    tutorial_end_time: payload?.end_time || payload?.new_end_time || '',
    tutorial_location: payload?.location || payload?.new_location || '',
    tutor_name: payload?.tutor_name || payload?.new_tutor_name || '',
    old_tutor_name: payload?.old_tutor_name || '',
    new_tutor_name: payload?.new_tutor_name || '',
    old_tutorial_location: payload?.old_location || '',
    new_tutorial_location: payload?.new_location || '',
    old_tutorial_date: tutorialOldStart.date || tutorialOldEnd.date || '',
    new_tutorial_date: tutorialNewStart.date || tutorialNewEnd.date || '',
    old_tutorial_time_range: tutorialOldStart.time && tutorialOldEnd.time ? `${tutorialOldStart.time} - ${tutorialOldEnd.time}` : '',
    new_tutorial_time_range: tutorialNewStart.time && tutorialNewEnd.time ? `${tutorialNewStart.time} - ${tutorialNewEnd.time}` : '',
    start_date: nextStart.date || reminderStart.date || reservationStart.date || '',
    start_time: nextStart.time || reminderStart.time || reservationStart.time || '',
    penalty_id: payload?.penalty_id || '',
    penalty_reason: payload?.reason || '',
    penalty_end_at: payload?.ends_at || '',
    penalty_evidence_id: payload?.evidence_report_id || '',
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
    evidence_ticket_id: record?.evidence_ticket_id || '',
    evidence_report_id: record?.evidence_report_id || '',
    incident_scope: record?.incident_scope || 'asset',
    incident_laboratory_id: record?.incident_laboratory_id || '',
    incident_date: record?.incident_date || '',
    incident_start_time: record?.incident_start_time || '',
    incident_end_time: record?.incident_end_time || '',
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

export async function listAvailableLabs(user = null) {
  const labs = await listAdminLabs()
  return labs.filter((lab) => isLabAccessibleToUser(lab, user))
}

export async function listReservations(filters = {}) {
  const search = new URLSearchParams()
  if (filters.laboratory_id) search.set('laboratory_id', filters.laboratory_id)
  if (filters.date) search.set('day', filters.date)
  if (filters.status) search.set('status', filters.status)

  const query = search.toString() ? `?${search.toString()}` : ''
  const data = await request(`${reservationsBase}/reservations${query}`, { cacheTtlMs: 2000 })
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

export async function getReservationById(reservationId) {
  if (!reservationId) {
    throw new Error('No se pudo identificar la reserva seleccionada.')
  }

  const data = await request(`${reservationsBase}/reservations/${reservationId}`, { cacheTtlMs: 500 })
  return mapReservation(data || {})
}

export async function listReservationsPage(filters = {}) {
  const search = new URLSearchParams()
  search.set('pageNumber', String(Math.max(Number(filters.pageNumber || 0), 0)))
  search.set('pageSize', String(Math.max(Number(filters.pageSize || 10), 1)))
  search.set('sortBy', String(filters.sortBy || 'start_at'))
  search.set('sortType', String(filters.sortType || 'DESC').toUpperCase())

  if (filters.laboratory_id) search.set('laboratory_id', filters.laboratory_id)
  if (filters.date) search.set('day', filters.date)
  if (filters.status && filters.status !== 'all') search.set('status', filters.status)
  if (filters.where) search.set('where', String(filters.where).trim())

  const data = await request(`${reservationsBase}/reservations/search?${search.toString()}`, { cacheTtlMs: 2000 })
  return mapReservationPage(data || {})
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
  clearReservationsCache()
  return mapReservation(record)
}

export async function updateReservation(reservationId, payload) {
  const normalized = {
    laboratory_id: String(payload.laboratory_id || ''),
    area_id: String(payload.area_id || ''),
    purpose: String(payload.purpose || '').trim(),
    start_at: `${payload.date}T${payload.start_time}:00`,
    end_at: `${payload.date}T${payload.end_time}:00`,
    notes: String(payload.notes || ''),
  }

  if (!reservationId || !normalized.laboratory_id || !payload.date || !payload.start_time || !payload.end_time) {
    throw new Error('Debes completar laboratorio, fecha y horario para actualizar la reserva.')
  }

  const record = await request(`${reservationsBase}/reservations/${reservationId}`, {
    method: 'PATCH',
    body: JSON.stringify(normalized),
  })
  clearReservationsCache()
  return mapReservation(record)
}

export async function deleteReservation(reservationId) {
  if (!reservationId) {
    throw new Error('No se pudo identificar la reserva a cancelar.')
  }

  await request(`${reservationsBase}/reservations/${reservationId}`, {
    method: 'DELETE',
  })
  clearReservationsCache()
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
  clearReservationsCache()
  return mapReservation(record)
}

export async function registerReservationEntry(reservationId, payload = {}) {
  const record = await request(`${reservationsBase}/reservations/${reservationId}/check-in`, {
    method: 'PATCH',
    body: JSON.stringify({
      station_label: String(payload.station_label || '').trim(),
      occupant_name: String(payload.occupant_name || '').trim(),
      occupant_email: String(payload.occupant_email || '').trim(),
      notes: String(payload.notes || '').trim(),
    }),
  })
  clearReservationsCache()
  return mapReservation(record)
}

export async function registerReservationExit(reservationId) {
  const record = await request(`${reservationsBase}/reservations/${reservationId}/check-out`, {
    method: 'PATCH',
  })
  clearReservationsCache()
  return mapReservation(record)
}

export async function markReservationAbsent(reservationId) {
  const record = await request(`${reservationsBase}/reservations/${reservationId}/absent`, {
    method: 'PATCH',
  })
  clearReservationsCache()
  return mapReservation(record)
}

export async function createWalkInReservation(payload) {
  const record = await request(`${reservationsBase}/reservations/walk-in`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  clearReservationsCache()
  return mapReservation(record)
}

export async function getOccupancyDashboard(laboratoryId = '') {
  const query = laboratoryId ? `?laboratory_id=${encodeURIComponent(laboratoryId)}` : ''
  return request(`${reservationsBase}/reservations/occupancy${query}`, { cacheTtlMs: 1500 })
}

export async function getReservationStatsHourly(options = {}) {
  const search = new URLSearchParams()
  if (options.laboratory_id) search.set('laboratory_id', options.laboratory_id)
  if (options.from) search.set('from', options.from)
  if (options.to) search.set('to', options.to)
  const query = search.toString() ? `?${search.toString()}` : ''
  const url = `${reservationsBase}/reservations/stats/hourly${query}`
  return request(url, { cacheTtlMs: options.cacheTtlMs || 60_000 })
}

export async function getReservationStatsTopSlots(options = {}) {
  const search = new URLSearchParams()
  if (options.laboratory_id) search.set('laboratory_id', options.laboratory_id)
  if (options.from) search.set('from', options.from)
  if (options.to) search.set('to', options.to)
  if (options.limit) search.set('limit', String(options.limit))
  const query = search.toString() ? `?${search.toString()}` : ''
  const url = `${reservationsBase}/reservations/stats/top-slots${query}`
  return request(url, { cacheTtlMs: options.cacheTtlMs || 60_000 })
}

export async function getReservationStatsHeatmap(options = {}) {
  const search = new URLSearchParams()
  if (options.laboratory_id) search.set('laboratory_id', options.laboratory_id)
  if (options.from) search.set('from', options.from)
  if (options.to) search.set('to', options.to)
  const query = search.toString() ? `?${search.toString()}` : ''
  const url = `${reservationsBase}/reservations/stats/heatmap${query}`
  return request(url, { cacheTtlMs: options.cacheTtlMs || 60_000 })
}

export async function getLabAvailability(laboratoryId, day) {
  if (!laboratoryId || !day) {
    return { slots: [], slot_minutes: 60 }
  }

  const search = new URLSearchParams({ day })
  return request(`${reservationsBase}/availability/labs/${laboratoryId}?${search.toString()}`, { cacheTtlMs: 1500 })
}

export async function listReservationNotifications(options = {}) {
  const skipCache = Boolean(options?.skipCache)
  const data = await request(`${reservationsBase}/notifications/mine`, {
    cacheTtlMs: skipCache ? 0 : 1500,
    skipCache,
  })
  return Array.isArray(data) ? data.map(mapNotification) : []
}

export async function markReservationNotificationAsRead(notificationId) {
  const record = await request(`${reservationsBase}/notifications/${notificationId}/read`, {
    method: 'PUT',
  })
  clearReservationsCache()
  return mapNotification(record)
}

export async function markAllReservationNotificationsAsRead() {
  const data = await request(`${reservationsBase}/notifications/read-all`, {
    method: 'PUT',
  })
  clearReservationsCache()
  return data
}

export async function listMyPenalties() {
  const data = await request(`${reservationsBase}/penalties/mine`, { cacheTtlMs: 1500 })
  return Array.isArray(data) ? data.map(mapPenalty) : []
}

export async function listPenalties(filters = {}) {
  const search = new URLSearchParams()
  if (filters.active_only) {
    search.set('active_only', 'true')
  }
  const query = search.toString() ? `?${search.toString()}` : ''
  const data = await request(`${reservationsBase}/penalties${query}`, { cacheTtlMs: 1500 })
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
      evidence_ticket_id: String(payload.evidence_ticket_id || '').trim(),
      evidence_report_id: String(payload.evidence_report_id || '').trim(),
      incident_scope: String(payload.incident_scope || 'asset').trim(),
      incident_laboratory_id: String(payload.incident_laboratory_id || '').trim(),
      incident_date: String(payload.incident_date || '').trim(),
      incident_start_time: String(payload.incident_start_time || '').trim(),
      incident_end_time: String(payload.incident_end_time || '').trim(),
      asset_id: String(payload.asset_id || '').trim(),
      starts_at: String(payload.starts_at || '').trim(),
      ends_at: String(payload.ends_at || '').trim(),
      notes: String(payload.notes || '').trim(),
    }),
  })
  clearReservationsCache()
  return mapPenalty(record)
}

export async function liftPenalty(penaltyId, options = {}) {
  const data = await request(`${reservationsBase}/penalties/${penaltyId}/lift`, {
    method: 'PATCH',
    body: JSON.stringify({
      lift_reason: String(options.lift_reason || '').trim(),
    }),
  })
  clearReservationsCache()
  return mapPenalty(data?.penalty || {})
}

export function subscribeReservationsRealtime(onMessage) {
  let isActive = true
  let ws = null
  let reconnectTimer = null
  const RECONNECT_DELAY_MS = 3000

  function getWsUrl() {
    const configured = (import.meta.env.VITE_RESERVATION_WS_URL || '').replace(/\/$/, '')
    if (configured) {
      return configured.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    }
    return 'ws://localhost:8005/v1/ws/reservations'
  }

  function connect() {
    if (!isActive) return

    let url = getWsUrl()
    const token = getAuthToken()
    if (token) {
      try {
        const wsUrl = new URL(url)
        wsUrl.searchParams.set('token', token)
        url = wsUrl.toString()
      } catch {
        // Keep original url if it cannot be parsed.
      }
    }

    console.log('[RealtimeWS] Connecting to', url)

    try {
      ws = new WebSocket(url)
    } catch (err) {
      console.error('[RealtimeWS] Failed to create WebSocket:', err)
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      console.log('[RealtimeWS] Connected')
    }

    ws.onmessage = (event) => {
      if (!isActive) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') return
        onMessage?.(data)
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      console.log('[RealtimeWS] Disconnected')
      ws = null
      scheduleReconnect()
    }

    ws.onerror = (err) => {
      console.error('[RealtimeWS] Error:', err)
      ws?.close()
    }
  }

  function scheduleReconnect() {
    if (!isActive) return
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
  }

  connect()

  return () => {
    console.log('[RealtimeWS] Unsubscribing')
    isActive = false
    clearTimeout(reconnectTimer)
    if (ws) {
      ws.onclose = null
      ws.close()
      ws = null
    }
  }
}
