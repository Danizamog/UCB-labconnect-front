import { getAuthToken } from '../../../shared/utils/storage'

const base = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
export const ROLE_HISTORY_PERMISSIONS = ['gestionar_roles', 'asignar_roles', 'revisar_accesos_rbac', 'consultar_auditoria_seguridad']
export const SECURITY_SOURCES = {
  audit: { path: '/security/audit-events?per_page=100', permissions: ['consultar_auditoria_seguridad'], label: 'Actividad del sistema' },
  auth: { path: '/security/auth-events?per_page=100', permissions: ['consultar_eventos_autenticacion'], label: 'Accesos a LabConnect' },
  sessions: { path: '/security/sessions?per_page=100', permissions: ['consultar_sesiones_usuarios'], label: 'Sesiones' },
  incidents: { path: '/security/incidents?per_page=100', permissions: ['consultar_incidentes_seguridad'], label: 'Incidentes' },
  reviews: { path: '/security/access-reviews?per_page=100', permissions: ['revisar_accesos_rbac'], label: 'Revisiones de acceso' },
  users: { path: '/users?per_page=200', permissions: ['consultar_usuarios'], label: 'Cuentas' },
  roles: { path: '/roles', permissions: ['consultar_roles', 'gestionar_roles', 'asignar_roles', 'revisar_accesos_rbac'], label: 'Roles' },
  roleHistory: { path: '/roles/history?per_page=1', permissions: ROLE_HISTORY_PERMISSIONS, label: 'Cambios de roles' },
}
async function get(path, { signal } = {}) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${getAuthToken()}` }, cache: 'no-store', signal })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.detail || `No se pudo consultar esta fuente (${response.status}).`)
  if (data === null) throw new Error('La fuente devolvió una respuesta no válida.')
  return data
}
export async function loadSecurityDashboard(user, { signal } = {}) {
  const entries = Object.entries(SECURITY_SOURCES).filter(([key, source]) => ['users', 'roles', 'roleHistory'].includes(key)
    && source.permissions.some((permission) => user?.permissions?.includes(permission)))
  if (['consultar_eventos_autenticacion', 'consultar_sesiones_usuarios', 'consultar_incidentes_seguridad'].some((permission) => user?.permissions?.includes(permission))) {
    entries.push(['summary', { path: '/security/summary', label: 'Indicadores de seguridad' }])
  }
  const results = await Promise.allSettled(entries.map(([, source]) => get(source.path, { signal })))
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError')
  const data = { errors: [], available: [], roleChangeCount: null, counts: {}, asOf: null }
  Object.keys(SECURITY_SOURCES).forEach((key) => { data[key] = [] })
  results.forEach((result, index) => {
    const [key, source] = entries[index]
    if (result.status === 'fulfilled') {
      const value = result.value
      if (key === 'summary') {
        data.counts = value.counts || {}; data.asOf = value.asOf
        data.available.push(...Object.keys(data.counts))
        data.errors.push(...(value.errors || []).map((item) => ({ ...item, label: SECURITY_SOURCES[item.key]?.label || item.key })))
        return
      }
      data[key] = Array.isArray(value) ? value : value.items || []
      data.available.push(key)
      if (key === 'roleHistory') data.roleChangeCount = Number(value.totalItems || 0)
    } else if (key === 'summary') {
      for (const name of ['auth', 'sessions', 'incidents']) {
        if (SECURITY_SOURCES[name].permissions.some((permission) => user?.permissions?.includes(permission))) {
          data.errors.push({ key: name, label: SECURITY_SOURCES[name].label, message: result.reason?.message || 'Indicador no disponible.' })
        }
      }
    } else data.errors.push({ key, label: source.label, message: result.reason?.message || 'Fuente no disponible.' })
  })
  return data
}

export function keepLastDashboard(previous, next) {
  const result = { ...next, counts: { ...next.counts }, available: [...next.available] }
  for (const item of next.errors) {
    if (!previous.available.includes(item.key)) continue
    result[item.key] = previous[item.key]
    result.available.push(item.key)
    if (item.key === 'roleHistory') result.roleChangeCount = previous.roleChangeCount
    if (Object.hasOwn(previous.counts || {}, item.key)) result.counts[item.key] = previous.counts[item.key]
  }
  return result
}

export function listSecurityRecords(source, filters, options = {}) {
  if (!['audit', 'auth', 'sessions', 'incidents', 'reviews'].includes(source)) throw new Error('Fuente de seguridad no válida.')
  const path = SECURITY_SOURCES[source].path.split('?')[0]
  const params = new URLSearchParams({ paginated: 'true', page: String(filters.page || 1), per_page: String(filters.per_page || 20) })
  for (const key of ['query', 'status', 'date_from', 'date_to', 'snapshot_at']) if (filters[key]) params.set(key, filters[key])
  return get(`${path}?${params}`, options)
}
export async function exportSecurityReport(user) {
  const report = await get('/security/reports/export')
  let roleChanges = []
  if (ROLE_HISTORY_PERMISSIONS.some((permission) => user?.permissions?.includes(permission))) {
    const first = await get('/roles/history?per_page=100&page=1')
    roleChanges = first.items || []
    if (first.totalPages > 1) roleChanges.push(...(await get('/roles/history?per_page=100&page=2')).items)
  }
  return { ...report, role_changes: roleChanges, exported_at: new Date().toISOString(),
    export_scope: 'Hasta 200 registros recientes por fuente. Los cambios de roles incluyen responsable, motivo y valores anteriores y nuevos.' }
}
