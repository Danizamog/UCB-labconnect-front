import { getAuthToken } from '../../../shared/utils/storage'

const base = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')

async function get(path) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
  const data = await response.json().catch(() => ([]))
  if (!response.ok) throw new Error(data?.detail || `Error ${response.status}`)
  return Array.isArray(data) ? data : (data?.items || data?.data || data)
}

export async function loadSecurityDashboard() {
  const sources = {
    audit: '/security/audit-events?per_page=100', auth: '/security/auth-events?per_page=100',
    sessions: '/security/sessions?per_page=100', incidents: '/security/incidents?per_page=100',
    reviews: '/security/access-reviews?per_page=100', users: '/users?per_page=200', roles: '/roles',
  }
  const entries = Object.entries(sources)
  const results = await Promise.allSettled(entries.map(([, path]) => get(path)))
  const data = { errors: [] }
  results.forEach((result, index) => {
    const key = entries[index][0]
    if (result.status === 'fulfilled') data[key] = Array.isArray(result.value) ? result.value : []
    else { data[key] = []; data.errors.push(`${key}: ${result.reason?.message || 'No disponible'}`) }
  })
  return data
}

export function exportSecurityReport() { return get('/security/reports/export') }
