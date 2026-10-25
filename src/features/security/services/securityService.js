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
async function get(path) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${getAuthToken()}` }, cache: 'no-store' })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.detail || `No se pudo consultar esta fuente (${response.status}).`)
  if (data === null) throw new Error('La fuente devolvió una respuesta no válida.')
  return data
}
export async function loadSecurityDashboard(user) {
  const entries = Object.entries(SECURITY_SOURCES).filter(([, source]) => source.permissions.some((permission) => user?.permissions?.includes(permission)))
  const results = await Promise.allSettled(entries.map(([, source]) => get(source.path)))
  const data = { errors: [], available: [], roleChangeCount: null }
  Object.keys(SECURITY_SOURCES).forEach((key) => { data[key] = [] })
  results.forEach((result, index) => {
    const [key, source] = entries[index]
    if (result.status === 'fulfilled') {
      const value = result.value
      data[key] = Array.isArray(value) ? value : value.items || []
      data.available.push(key)
      if (key === 'roleHistory') data.roleChangeCount = Number(value.totalItems || 0)
    } else data.errors.push({ key, label: source.label, message: result.reason?.message || 'Fuente no disponible.' })
  })
  return data
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
