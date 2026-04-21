const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const reservationsBase = `${apiBase}/v1`
const inventoryBase = `${apiBase}/inventory`

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

function clearInfrastructureCache() {
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

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  })

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

export function listAdminAreas() {
  return request(`${reservationsBase}/areas/all`, { cacheTtlMs: 60000 })
}

export function createArea(payload) {
  return request(`${reservationsBase}/areas`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function updateArea(areaId, payload) {
  return request(`${reservationsBase}/areas/${areaId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function deleteArea(areaId) {
  return request(`${reservationsBase}/areas/${areaId}`, {
    method: 'DELETE',
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function listAdminLabs() {
  return request(`${reservationsBase}/labs/all`, { cacheTtlMs: 60000 })
}

export function createLab(payload) {
  return request(`${reservationsBase}/labs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function updateLab(labId, payload) {
  return request(`${reservationsBase}/labs/${labId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function deleteLab(labId) {
  return request(`${reservationsBase}/labs/${labId}`, {
    method: 'DELETE',
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function listAssets() {
  return request(`${inventoryBase}/assets`, { cacheTtlMs: 5000 })
}

export function createAsset(payload) {
  return request(`${inventoryBase}/assets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function updateAsset(assetId, payload) {
  return request(`${inventoryBase}/assets/${assetId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function updateAssetStatus(assetId, status) {
  return request(`${inventoryBase}/assets/${assetId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function listAssetStatusHistory(assetId) {
  return request(`${inventoryBase}/asset-maintenance/assets/${assetId}/history`, { cacheTtlMs: 5000 })
}

export function listAssetMaintenanceTickets(filters = {}) {
  const query = buildQuery(filters)
  return request(`${inventoryBase}/asset-maintenance${query}`, { cacheTtlMs: 5000 })
}

export function createAssetMaintenanceTicket(assetId, payload) {
  return request(`${inventoryBase}/asset-maintenance/assets/${assetId}/tickets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function closeAssetMaintenanceTicket(ticketId, payload) {
  return request(`${inventoryBase}/asset-maintenance/tickets/${ticketId}/close`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function listAssetResponsibilityFlags() {
  return request(`${inventoryBase}/asset-maintenance/user-flags`, { cacheTtlMs: 5000 })
}

function mapLoanRecord(record) {
  return {
    id: record?.id || '',
    asset_id: record?.asset_id || '',
    asset_name: record?.asset_name || '',
    asset_serial_number: record?.asset_serial_number || '',
    laboratory_id: record?.laboratory_id || '',
    laboratory_name: record?.laboratory_name || '',
    borrower_id: record?.borrower_id || '',
    borrower_name: record?.borrower_name || '',
    borrower_email: record?.borrower_email || '',
    borrower_role: record?.borrower_role || '',
    purpose: record?.purpose || '',
    notes: record?.notes || '',
    status: record?.status || 'active',
    loaned_by: record?.loaned_by || '',
    returned_by: record?.returned_by || '',
    loaned_at: record?.loaned_at || '',
    due_at: record?.due_at || '',
    returned_at: record?.returned_at || '',
    return_condition: record?.return_condition || 'ok',
    return_notes: record?.return_notes || '',
    incident_notes: record?.incident_notes || '',
    created: record?.created || '',
    updated: record?.updated || '',
  }
}

function mapLoanDashboard(record) {
  return {
    total_records: Number(record?.total_records || 0),
    active_count: Number(record?.active_count || 0),
    returned_count: Number(record?.returned_count || 0),
    damaged_returns_count: Number(record?.damaged_returns_count || 0),
    active_loans: Array.isArray(record?.active_loans) ? record.active_loans.map(mapLoanRecord) : [],
  }
}

export function deleteAsset(assetId) {
  return request(`${inventoryBase}/assets/${assetId}`, {
    method: 'DELETE',
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function listMaterials() {
  return request(`${inventoryBase}/stock-items`, { cacheTtlMs: 5000 })
}

export function getStockItemsReport({
  laboratoryId = null,
  onlyLowOrOut = false,
  statusFilter = null,
  search = null,
} = {}) {
  const params = new URLSearchParams()
  if (laboratoryId) {
    params.set('laboratory_id', String(laboratoryId))
  }
  if (onlyLowOrOut) {
    params.set('only_low_or_out', 'true')
  }
  if (statusFilter) {
    params.set('status_filter', String(statusFilter))
  }
  if (search) {
    params.set('search', String(search))
  }

  const query = params.toString()
  return request(`${inventoryBase}/reports/stock-items${query ? `?${query}` : ''}`, { cacheTtlMs: 3000 })
}

export function createMaterial(payload) {
  return request(`${inventoryBase}/stock-items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function updateMaterial(materialId, payload) {
  return request(`${inventoryBase}/stock-items/${materialId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function updateMaterialQuantity(materialId, quantityAvailable) {
  return request(`${inventoryBase}/stock-items/${materialId}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity_available: quantityAvailable }),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function listMaterialMovements(materialId = null, limit = 40) {
  const search = new URLSearchParams()
  if (materialId) {
    search.set('stock_item_id', materialId)
  }
  search.set('limit', limit)
  return request(`${inventoryBase}/stock-items/movements?${search.toString()}`, { cacheTtlMs: 5000 })
}

export function createMaterialMovement(materialId, payload) {
  return request(`${inventoryBase}/stock-items/${materialId}/movements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    clearInfrastructureCache()
    return data
  })
}

export function deleteMaterial(materialId) {
  return request(`${inventoryBase}/stock-items/${materialId}`, {
    method: 'DELETE',
  }).then((data) => {
    clearInfrastructureCache()
    return data
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

export async function listLoansDashboard() {
  const data = await request(`${inventoryBase}/loans/dashboard`, { cacheTtlMs: 3000 })
  return mapLoanDashboard(data || {})
}

export async function listLoanRecords(filters = {}) {
  const data = await request(`${inventoryBase}/loans/${buildQuery(filters)}`, { cacheTtlMs: 3000 })
  return Array.isArray(data) ? data.map(mapLoanRecord) : []
}

export async function listAssetLoanHistory(assetId) {
  const data = await request(`${inventoryBase}/loans/assets/${assetId}/history`, { cacheTtlMs: 3000 })
  return Array.isArray(data) ? data.map(mapLoanRecord) : []
}

export async function createLoanRecord(payload) {
  const data = await request(`${inventoryBase}/loans`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  clearInfrastructureCache()
  return mapLoanRecord(data || {})
}

export async function returnLoanRecord(loanId, payload) {
  const normalizedPayload = typeof payload === 'string'
    ? { return_notes: payload || null }
    : {
        return_notes: payload?.return_notes || null,
        return_condition: payload?.return_condition || 'ok',
        incident_notes: payload?.incident_notes || null,
      }

  const data = await request(`${inventoryBase}/loans/${loanId}/return`, {
    method: 'PATCH',
    body: JSON.stringify(normalizedPayload),
  })
  clearInfrastructureCache()
  return mapLoanRecord(data || {})
}
