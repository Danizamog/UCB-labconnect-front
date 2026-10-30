import { MATERIAL_PERMISSIONS, RESERVATION_PERMISSIONS, TUTORIAL_PERMISSIONS } from '../lib/moduleAccess.js'
export const LOGIN_PATH = '/login'
export const APP_ROOT_PATH = '/app'
export const SECURITY_VIEW_PERMISSIONS = [
  'consultar_auditoria_seguridad', 'consultar_eventos_autenticacion', 'consultar_sesiones_usuarios',
  'consultar_incidentes_seguridad', 'revisar_accesos_rbac', 'exportar_reportes_seguridad',
  'gestionar_roles', 'asignar_roles',
]
export const USER_ACCOUNT_PERMISSIONS = [
  'consultar_usuarios',
  'modificar_usuarios',
  'dar_baja_usuarios',
  'desbloquear_usuarios',
  'reiniciar_credenciales',
]

export const NAVIGATION_LINKS = [
  { id: 'home', label: 'Inicio', icon: 'home', path: APP_ROOT_PATH },
  { id: 'account', label: 'Mi cuenta', icon: 'account', path: '/app/mi-cuenta' },
  { id: 'security', label: 'Seguridad', icon: 'security', path: '/app/seguridad', requiredAnyPermission: SECURITY_VIEW_PERMISSIONS },
  { id: 'admin_reservas', label: 'Solicitudes y acceso', icon: 'admin_reservas', path: '/app/admin/reservas', requiredAnyPermission: RESERVATION_PERMISSIONS },
  { id: 'analytics', label: 'Analisis de uso', icon: 'analytics', path: '/app/admin/analisis', requiredAnyPermission: ['consultar_estadisticas'] },
  { id: 'ia_predicciones', label: 'Predicciones', icon: 'ia_predicciones', path: '/app/admin/predicciones', requiredAnyPermission: ['consultar_estadisticas'] },
  { id: 'tutorials_manage', label: 'Tutorias docentes', icon: 'tutorials_manage', path: '/app/tutorias/publicar', requiredAnyPermission: TUTORIAL_PERMISSIONS },
  { id: 'mis_clases', label: 'Mis clases', icon: 'mis_clases', path: '/app/docente/clases', requiredAnyPermission: ['gestionar_clases_propias', 'solicitar_recursos_clase'] },
  { id: 'directory', label: 'Directorio institucional', icon: 'profiles', path: '/app/directorio', requiredAnyPermission: ['consultar_directorio_operativo'] },
  { id: 'profiles', label: 'Cuentas de usuarios', icon: 'profiles', path: '/app/admin/perfiles', requiredAnyPermission: USER_ACCOUNT_PERMISSIONS },
  { id: 'roles', label: 'Roles y permisos', icon: 'roles', path: '/app/admin/roles', requiredAnyPermission: ['consultar_roles', 'gestionar_roles', 'asignar_roles', 'revisar_accesos_rbac'] },
  { id: 'penalties', label: 'Sanciones y bloqueos', icon: 'penalties', path: '/app/admin/penalizaciones', requiredAnyPermission: ['gestionar_penalizaciones'] },
  { id: 'areas', label: 'Areas academicas', icon: 'areas', path: '/app/admin/areas', requiredAnyPermission: ['gestionar_estructura_laboratorios'] },
  { id: 'laboratorios', label: 'Espacios de laboratorio', icon: 'laboratorios', path: '/app/admin/laboratorios', requiredAnyPermission: ['gestionar_estructura_laboratorios'] },
  { id: 'horarios_laboratorios', label: 'Horarios de laboratorios', icon: 'horarios_laboratorios', path: '/app/admin/horarios-laboratorios', requiredAnyPermission: ['gestionar_horarios_laboratorio'] },
  { id: 'equipos', label: 'Equipos y prestamos', icon: 'equipos', path: '/app/admin/equipos', requiredAnyPermission: ['gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento', 'gestionar_prestamos', 'registrar_tickets_equipo'] },
  { id: 'materiales', label: 'Materiales y stock', icon: 'materiales', path: '/app/admin/materiales', requiredAnyPermission: MATERIAL_PERMISSIONS },
  { id: 'calendar', label: 'Ver disponibilidad', icon: 'calendar', path: '/app/reservas/calendario', allowedRoles: ['Estudiante', 'Invitado', 'Docente', 'Encargado de Laboratorio'] },
  { id: 'tutorials_public', label: 'Apoyo y tutorias', icon: 'tutorials_public', path: '/app/tutorias', allowedRoles: ['Estudiante', 'Invitado'] },
  { id: 'tutorials_history', label: 'Historial Tutorias', icon: 'history', path: '/app/tutorias/historial', allowedRoles: ['Estudiante'] },
  { id: 'history', label: 'Historial', icon: 'history', path: '/app/historial', allowedRoles: ['Estudiante', 'Docente', 'Encargado de Laboratorio'] },
  { id: 'reserve', label: 'Reservar laboratorio', icon: 'reserve', path: '/app/reservas/nueva', allowedRoles: ['Estudiante'] },
  { id: 'logout', label: 'Salir', action: 'logout', icon: 'logout' },
]

export function normalizePath(pathname = '/') {
  if (!pathname || pathname === '/') {
    return '/'
  }

  const withoutHash = pathname.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  const normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`

  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }

  return normalized
}

export function getNavigationLinkBySection(sectionId) {
  return NAVIGATION_LINKS.find((link) => link.id === sectionId) || null
}

export function getNavigationLinkByPath(pathname) {
  const normalizedPath = normalizePath(pathname)
  return NAVIGATION_LINKS.find((link) => link.path === normalizedPath) || null
}

export function getSectionIdFromPath(pathname) {
  const normalizedPath = normalizePath(pathname)

  if (normalizedPath === '/' || normalizedPath === APP_ROOT_PATH) {
    return 'home'
  }

  return getNavigationLinkByPath(normalizedPath)?.id || null
}

export function getPathFromSection(sectionId) {
  return getNavigationLinkBySection(sectionId)?.path || APP_ROOT_PATH
}
