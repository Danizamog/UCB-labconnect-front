import { getAuthToken } from '../../../shared/utils/storage'

const API_BASE_URL = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const ROLES_ENDPOINT = import.meta.env.VITE_ROLES_ENDPOINT || '/roles'
const configuredUsersEndpoint = import.meta.env.VITE_ROLE_USERS_ENDPOINT
// El antiguo /users pertenece al directorio de auth y exige otros permisos.
const USERS_ENDPOINT = !configuredUsersEndpoint || configuredUsersEndpoint === '/users'
  ? `${ROLES_ENDPOINT}/users` : configuredUsersEndpoint
const requestCache = new Map()
const inFlightRequests = new Map()

function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
  }

  const resolvedToken = token || getAuthToken()
  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`
  }

  return headers
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

function clearRolesCache() {
  requestCache.clear()
  inFlightRequests.clear()
}

async function apiRequest(path, { method = 'GET', token, body, cacheTtlMs = 0, skipCache = false, signal } = {}) {
  const resolvedMethod = String(method || 'GET').toUpperCase()
  const resolvedToken = token || getAuthToken() || ''
  const url = `${API_BASE_URL}${path}`
  const canCache = resolvedMethod === 'GET' && cacheTtlMs > 0 && !skipCache
  const cacheKey = buildRequestCacheKey(url, resolvedMethod, resolvedToken)

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
      signal,
      method: resolvedMethod,
      headers: buildHeaders(resolvedToken),
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `Error ${response.status}`)
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

function normalizeArrayResponse(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.data)) {
    return data.data
  }

  return []
}

function mapRoleRecord(record) {
  return {
    id: record.id,
    nombre: record.nombre ?? record.name ?? '',
    descripcion: record.descripcion ?? record.description ?? '',
    permisos: record.permisos ?? record.permissions ?? [],
    created: record.created,
    updated: record.updated,
  }
}

function mapUserRecord(record, allRoles = []) {
  const expandedRole = record.expand?.role

  let roleObj = null
  if (expandedRole) {
    roleObj = {
      id: expandedRole.id,
      nombre: expandedRole.nombre ?? expandedRole.name ?? '',
      descripcion: expandedRole.descripcion ?? expandedRole.description ?? '',
      permisos: expandedRole.permisos ?? expandedRole.permissions ?? [],
    }
  } else if (record.role && typeof record.role === 'object') {
    roleObj = {
      id: record.role.id,
      nombre: record.role.nombre ?? record.role.name ?? '',
      descripcion: record.role.descripcion ?? record.role.description ?? '',
      permisos: record.role.permisos ?? record.role.permissions ?? [],
    }
  } else if (typeof record.role === 'string') {
    const foundRole = allRoles.find((r) => r.nombre === record.role)
    if (foundRole) {
      roleObj = foundRole
    }
  }

  return {
    id: record.id,
    name: record.name ?? '',
    email: record.email ?? record.username ?? '',
    roleId: roleObj?.id || null,
    role: roleObj,
    created: record.created,
    updated: record.updated,
  }
}

export async function listRoles({ token } = {}) {
  const data = await apiRequest(ROLES_ENDPOINT, { token, cacheTtlMs: 30000 })
  const records = normalizeArrayResponse(data)

  return records.map(mapRoleRecord)
}

export async function listPermissionsCatalog({ token } = {}) {
  return apiRequest(`${ROLES_ENDPOINT}/permissions/catalog`, { token, cacheTtlMs: 30000 })
}

export async function createRole(role, { token } = {}) {
  const record = await apiRequest(ROLES_ENDPOINT, {
    method: 'POST',
    token,
    body: {
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: role.permisos,
      reason: role.reason,
    },
  })
  clearRolesCache()

  return mapRoleRecord(record)
}

export async function updateRole(roleId, role, { token } = {}) {
  const payload = {
    nombre: role.nombre,
    descripcion: role.descripcion,
    permisos: role.permisos,
    reason: role.reason,
  }

  const record = await apiRequest(`${ROLES_ENDPOINT}/${roleId}`, {
      method: 'PUT',
      token,
      body: payload,
    })
  clearRolesCache()

  return mapRoleRecord(record)
}

export async function deleteRole(roleId, { token, reason } = {}) {
  await apiRequest(`${ROLES_ENDPOINT}/${roleId}?reason=${encodeURIComponent(reason || '')}`, {
    method: 'DELETE',
    token,
  })
  clearRolesCache()

  return true
}

export async function listUsersWithRoles({ token } = {}) {
  const [data, roles] = await Promise.all([
    apiRequest(`${USERS_ENDPOINT}?expand=role`, { token, cacheTtlMs: 15000 }),
    listRoles({ token }),
  ])
  const records = normalizeArrayResponse(data)

  return records.map((record) => mapUserRecord(record, roles))
}

export async function assignUserRole(userId, roleId, { token, reason } = {}) {
  const [record, roles] = await Promise.all([
    apiRequest(`/roles/users/${userId}`, {
      method: 'PATCH',
      token,
      body: {
        roleId: roleId,
        reason,
      },
    }),
    listRoles({ token }),
  ])
  
  clearRolesCache()

  return mapUserRecord(record, roles)
}

export function listRoleHistory({ page = 1, per_page = 20, query = '', action = '', date_from = '', date_to = '', snapshot_at = '' } = {}, { signal } = {}) {
  const params = new URLSearchParams({ page: String(page), per_page: String(per_page) })
  Object.entries({ query, action, date_from, date_to, snapshot_at }).forEach(([key, value]) => { if (value) params.set(key, value) })
  return apiRequest(`${ROLES_ENDPOINT}/history?${params}`, { signal })
}
