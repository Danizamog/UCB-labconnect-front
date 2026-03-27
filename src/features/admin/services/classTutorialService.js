const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const classTutorialsBase = `${apiBase}/class-tutorials`

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

export function listClassTutorials(filters = {}) {
  const search = new URLSearchParams()
  if (filters.laboratoryId) {
    search.set('laboratory_id', String(filters.laboratoryId))
  }
  if (filters.date) {
    search.set('date', filters.date)
  }
  if (filters.sessionType) {
    search.set('session_type', filters.sessionType)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request(`${classTutorialsBase}${suffix}`)
}

export function createClassTutorial(payload) {
  return request(`${classTutorialsBase}/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateClassTutorial(itemId, payload) {
  return request(`${classTutorialsBase}/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteClassTutorial(itemId) {
  return request(`${classTutorialsBase}/${itemId}`, {
    method: 'DELETE',
  })
}
