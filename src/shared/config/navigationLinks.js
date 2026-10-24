export const LOGIN_PATH = '/login'
export const APP_ROOT_PATH = '/app'

export const NAVIGATION_LINKS = [
  { id: 'home', label: 'Inicio', icon: 'home', path: APP_ROOT_PATH },
  { id: 'account', label: 'Mi cuenta', icon: 'account', path: '/app/mi-cuenta' },
  { id: 'security', label: 'Auditoria de seguridad', icon: 'security', path: '/app/seguridad', requiredAnyPermission: ['consultar_auditoria_seguridad', 'revisar_accesos_rbac'] },
  { id: 'admin_reservas', label: 'Solicitudes y acceso', icon: 'admin_reservas', path: '/app/admin/reservas', requiredAnyPermission: ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio', 'aprobar_clases', 'aprobar_tutorias'] },
  { id: 'analytics', label: 'Analisis de uso', icon: 'analytics', path: '/app/admin/analisis', requiredAnyPermission: ['consultar_estadisticas'] },
  { id: 'ia_predicciones', label: 'Predicciones', icon: 'ia_predicciones', path: '/app/admin/predicciones', requiredAnyPermission: ['consultar_estadisticas'] },
  { id: 'tutorials_manage', label: 'Tutorias docentes', icon: 'tutorials_manage', path: '/app/tutorias/publicar', requiredAnyPermission: ['gestionar_tutorias_propias'] },
  { id: 'mis_clases', label: 'Mis clases', icon: 'mis_clases', path: '/app/docente/clases', requiredAnyPermission: ['gestionar_clases_propias', 'solicitar_recursos_clase'] },
  { id: 'profiles', label: 'Cuentas de usuarios', icon: 'profiles', path: '/app/admin/perfiles', requiredAnyPermission: ['consultar_usuarios', 'modificar_usuarios', 'dar_baja_usuarios', 'desbloquear_usuarios', 'reiniciar_credenciales'] },
  { id: 'roles', label: 'Roles y permisos', icon: 'roles', path: '/app/admin/roles', requiredAnyPermission: ['consultar_roles', 'gestionar_roles', 'asignar_roles'] },
  { id: 'penalties', label: 'Sanciones y bloqueos', icon: 'penalties', path: '/app/admin/penalizaciones', requiredAnyPermission: ['gestionar_penalizaciones'] },
  { id: 'areas', label: 'Areas academicas', icon: 'areas', path: '/app/admin/areas', requiredAnyPermission: ['gestionar_estructura_laboratorios'] },
  { id: 'laboratorios', label: 'Espacios de laboratorio', icon: 'laboratorios', path: '/app/admin/laboratorios', requiredAnyPermission: ['gestionar_estructura_laboratorios'] },
  { id: 'horarios_laboratorios', label: 'Horarios de laboratorios', icon: 'horarios_laboratorios', path: '/app/admin/horarios-laboratorios', requiredAnyPermission: ['gestionar_horarios_laboratorio'] },
  { id: 'equipos', label: 'Equipos y prestamos', icon: 'equipos', path: '/app/admin/equipos', requiredAnyPermission: ['gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento', 'gestionar_prestamos', 'registrar_tickets_equipo'] },
  { id: 'materiales', label: 'Materiales y stock', icon: 'materiales', path: '/app/admin/materiales', requiredAnyPermission: ['gestionar_stock', 'gestionar_reactivos_quimicos', 'gestionar_reservas_materiales'] },
  { id: 'calendar', label: 'Ver disponibilidad', icon: 'calendar', path: '/app/reservas/calendario', allowedRoles: ['Estudiante', 'Docente', 'Encargado de Laboratorio'] },
  { id: 'tutorials_public', label: 'Apoyo y tutorias', icon: 'tutorials_public', path: '/app/tutorias', allowedRoles: ['Estudiante'] },
  { id: 'tutorials_history', label: 'Historial Tutorias', icon: 'history', path: '/app/tutorias/historial', allowedRoles: ['Estudiante'] },
  { id: 'history', label: 'Historial', icon: 'history', path: '/app/historial', allowedRoles: ['Estudiante', 'Docente', 'Encargado de Laboratorio'] },
  { id: 'reserve', label: 'Reservar laboratorio', icon: 'reserve', path: '/app/reservas/nueva', allowedRoles: ['Estudiante', 'Docente', 'Encargado de Laboratorio'] },
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
