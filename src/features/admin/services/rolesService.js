import { getAuthToken } from '../../../shared/utils/storage'

const API_BASE_URL = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const ROLES_ENDPOINT = import.meta.env.VITE_ROLES_ENDPOINT || '/roles'
const USERS_ENDPOINT = import.meta.env.VITE_ROLE_USERS_ENDPOINT || '/users'
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

async function apiRequest(path, { method = 'GET', token, body, cacheTtlMs = 0, skipCache = false } = {}) {
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

function mapUserRecord(record) {
  const expandedRole = record.expand?.role

  return {
    id: record.id,
    name: record.name ?? '',
    email: record.email ?? '',
    roleId: record.roleId ?? (typeof record.role === 'string' ? record.role : record.role?.id) ?? null,
    role: expandedRole
      ? {
          id: expandedRole.id,
          nombre: expandedRole.nombre ?? expandedRole.name ?? '',
          descripcion: expandedRole.descripcion ?? expandedRole.description ?? '',
          permisos: expandedRole.permisos ?? expandedRole.permissions ?? [],
        }
      : record.role && typeof record.role === 'object'
        ? {
            id: record.role.id,
            nombre: record.role.nombre ?? record.role.name ?? '',
            descripcion: record.role.descripcion ?? record.role.description ?? '',
            permisos: record.role.permisos ?? record.role.permissions ?? [],
          }
        : null,
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
  }

  let record

  try {
    record = await apiRequest(`${ROLES_ENDPOINT}/${roleId}`, {
      method: 'PUT',
      token,
      body: payload,
    })
  } catch {
    record = await apiRequest(`${ROLES_ENDPOINT}/${roleId}`, {
      method: 'PATCH',
      token,
      body: payload,
    })
  }
  clearRolesCache()

  return mapRoleRecord(record)
}

export async function deleteRole(roleId, { token } = {}) {
  await apiRequest(`${ROLES_ENDPOINT}/${roleId}`, {
    method: 'DELETE',
    token,
  })
  clearRolesCache()

  return true
}

export async function listUsersWithRoles({ token } = {}) {
  const data = await apiRequest(`${USERS_ENDPOINT}?expand=role`, { token, cacheTtlMs: 15000 })
  const records = normalizeArrayResponse(data)

  return records.map(mapUserRecord)
}

export async function assignUserRole(userId, roleId, { token } = {}) {
  let record

  try {
    record = await apiRequest(`${USERS_ENDPOINT}/${userId}/role`, {
      method: 'PATCH',
      token,
      body: {
        roleId,
      },
    })
  } catch {
    record = await apiRequest(`${USERS_ENDPOINT}/${userId}`, {
      method: 'PATCH',
      token,
      body: {
        roleId,
      },
    })
  }
  clearRolesCache()

  return mapUserRecord(record)
}
