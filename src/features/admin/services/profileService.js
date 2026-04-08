const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const profilesBase = `${apiBase}/users`

import { getAuthToken } from '../../../shared/utils/storage'
const requestCache = new Map()
const inFlightRequests = new Map()

async function parseJson(response, fallback) {
  return response.json().catch(() => fallback)
}

function cloneCachedValue(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function buildRequestCacheKey(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  return `${method}:${url}`
}

function clearProfilesCache() {
  requestCache.clear()
  inFlightRequests.clear()
}

async function request(url, options = {}) {
  const { cacheTtlMs = 0, skipCache = false, ...fetchOptions } = options
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const canCache = method === 'GET' && cacheTtlMs > 0 && !skipCache
  const cacheKey = buildRequestCacheKey(url, fetchOptions)

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
  const token = getAuthToken()
  const headers = {
    ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(fetchOptions.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, { ...fetchOptions, headers })
  const data = await parseJson(response, null)

  if (!response.ok) {
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

export function listUserProfiles() {
  return request(`${profilesBase}/`, { cacheTtlMs: 60000 })
}

export function createUserProfile(payload) {
  return request(`${profilesBase}/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearProfilesCache()
    return data
  })
}

export function updateUserProfile(userId, payload) {
  return request(`${profilesBase}/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearProfilesCache()
    return data
  })
}

export function deleteUserProfile(userId) {
  return request(`${profilesBase}/${userId}`, {
    method: 'DELETE',
  }).then((data) => {
    clearProfilesCache()
    return data
  })
}
