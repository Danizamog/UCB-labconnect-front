import { getAuthToken } from '../../../shared/utils/storage'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase

async function request(path, options = {}) {
  const token = getAuthToken()
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.detail || `Error ${response.status}`)
  return data
}

export function getMyAccount() {
  return request('/users/me')
}

export function changeMyPassword(payload) {
  return request('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) })
}
