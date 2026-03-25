const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const profilesBase = `${apiBase}/users`

function getToken() {
  return localStorage.getItem('token') || localStorage.getItem('access_token') || ''
}

async function parseJson(response, fallback) {
  return response.json().catch(() => fallback)
}

async function request(url, options = {}) {
  const token = getToken()
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, { ...options, headers })
  const data = await parseJson(response, null)

  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`)
  }

  return data
}

export function listUserProfiles() {
  return request(`${profilesBase}/`)
}

export function createUserProfile(payload) {
  return request(`${profilesBase}/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUserProfile(userId, payload) {
  return request(`${profilesBase}/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
