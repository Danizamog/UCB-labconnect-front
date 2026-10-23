import { getAuthToken } from '../../../shared/utils/storage'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase : `${gatewayBase}/v1`

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function getJson(path) {
  const response = await fetch(`${apiBase}${path}`, { headers: authHeaders() })

  if (!response.ok) {
    let detail = `Error ${response.status}`
    try {
      const body = await response.json()
      detail = body?.detail || detail
    } catch {
      // respuesta sin cuerpo JSON
    }
    const error = new Error(detail)
    error.status = response.status
    throw error
  }

  return response.json()
}

// Panorama agregado: riesgo de insumos, resumen de laboratorios y calidad de datos.
// force=true fuerza al backend a recalcular (ignora la cache) — usado por "Actualizar".
export async function getPredictionsOverview({ force = false } = {}) {
  return getJson(`/analytics/predict/overview${force ? '?refresh=true' : ''}`)
}

// Pronostico de ocupacion (horas reservadas por dia) para un laboratorio.
export async function getLaboratoryForecast(labId) {
  return getJson(`/analytics/predict/laboratories/${encodeURIComponent(labId)}`)
}

// Pronostico de agotamiento/demanda para un material (stock item).
export async function getSupplyForecast(stockItemId) {
  return getJson(`/analytics/predict/supplies/${encodeURIComponent(stockItemId)}`)
}
