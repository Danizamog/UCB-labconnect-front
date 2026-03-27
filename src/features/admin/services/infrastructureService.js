const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const reservationsBase = `${apiBase}/v1`
const inventoryBase = `${apiBase}/inventory`

import { getAuthToken } from '../../../shared/utils/storage'

async function parseJson(response, fallback) {
  return response.json().catch(() => fallback)
}

async function request(url, options = {}) {
  const token = getAuthToken()
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  const data = await parseJson(response, null)

  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`)
  }

  return data
}

export function listAdminAreas() {
  return request(`${reservationsBase}/areas/all`)
}

export function createArea(payload) {
  return request(`${reservationsBase}/areas`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateArea(areaId, payload) {
  return request(`${reservationsBase}/areas/${areaId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteArea(areaId) {
  return request(`${reservationsBase}/areas/${areaId}`, {
    method: 'DELETE',
  })
}

export function listAdminLabs() {
  return request(`${reservationsBase}/labs/all`)
}

export function createLab(payload) {
  return request(`${reservationsBase}/labs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateLab(labId, payload) {
  return request(`${reservationsBase}/labs/${labId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteLab(labId) {
  return request(`${reservationsBase}/labs/${labId}`, {
    method: 'DELETE',
  })
}

export function listAssets() {
  return request(`${inventoryBase}/assets`)
}

export function createAsset(payload) {
  return request(`${inventoryBase}/assets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAsset(assetId, payload) {
  return request(`${inventoryBase}/assets/${assetId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updateAssetStatus(assetId, status) {
  return request(`${inventoryBase}/assets/${assetId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function listAssetStatusHistory(assetId) {
  return request(`${inventoryBase}/assets/${assetId}/status-history`)
}

export function deleteAsset(assetId) {
  return request(`${inventoryBase}/assets/${assetId}`, {
    method: 'DELETE',
  })
}

export function listMaterials() {
  return request(`${inventoryBase}/stock-items`)
}

export function createMaterial(payload) {
  return request(`${inventoryBase}/stock-items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMaterial(materialId, payload) {
  return request(`${inventoryBase}/stock-items/${materialId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updateMaterialQuantity(materialId, quantityAvailable) {
  return request(`${inventoryBase}/stock-items/${materialId}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity_available: quantityAvailable }),
  })
}

export function listMaterialMovements(materialId = null, limit = 40) {
  const search = new URLSearchParams()
  if (materialId) {
    search.set('stock_item_id', materialId)
  }
  search.set('limit', limit)
  return request(`${inventoryBase}/stock-items/movements?${search.toString()}`)
}

export function createMaterialMovement(materialId, payload) {
  return request(`${inventoryBase}/stock-items/${materialId}/movements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteMaterial(materialId) {
  return request(`${inventoryBase}/stock-items/${materialId}`, {
    method: 'DELETE',
  })
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value)
    }
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export function listLoansDashboard() {
  return request(`${inventoryBase}/loans/dashboard`)
}

export function listLoanRecords(filters = {}) {
  return request(`${inventoryBase}/loans/${buildQuery(filters)}`)
}

export function createLoanRecord(payload) {
  return request(`${inventoryBase}/loans`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function returnLoanRecord(loanId, payload) {
  const normalizedPayload = typeof payload === 'string'
    ? { return_notes: payload || null }
    : {
        return_notes: payload?.return_notes || null,
        return_condition: payload?.return_condition || 'ok',
        incident_notes: payload?.incident_notes || null,
      }

  return request(`${inventoryBase}/loans/${loanId}/return`, {
    method: 'PATCH',
    body: JSON.stringify(normalizedPayload),
  })
}
