export const LOGIN_PATH = '/login'
export const APP_ROOT_PATH = '/app'

export const NAVIGATION_LINKS = [
  { id: 'home', label: 'Inicio', icon: 'home', path: APP_ROOT_PATH },
  { id: 'reserve', label: 'Reservar practica', icon: 'reserve', path: '/app/reservar-practica', userOnly: true },
  { id: 'calendar', label: 'Calendario', icon: 'calendar', path: '/app/calendario', userOnly: true },
  { id: 'requests', label: 'Mis reservas', icon: 'requests', path: '/app/mis-reservas', userOnly: true },
  { id: 'reservations', label: 'Reservas', icon: 'reservations', path: '/app/admin/reservas', requiredAnyPermission: ['*', 'gestionar_reservas', 'gestionar_reservas_materiales', 'gestionar_reglas_reserva', 'gestionar_roles_permisos'] },
  { id: 'profiles', label: 'Perfiles', icon: 'profiles', path: '/app/admin/perfiles', requiredAnyPermission: ['*', 'gestionar_roles_permisos', 'reactivar_cuentas'] },
  { id: 'roles', label: 'Roles', icon: 'roles', path: '/app/admin/roles', requiredAnyPermission: ['*', 'gestionar_roles_permisos'] },
  { id: 'sessions', label: 'Clases y tutorias', icon: 'sessions', path: '/app/admin/clases-tutorias', requiredAnyPermission: ['*', 'gestionar_tutorias', 'gestionar_inscripciones_tutorias', 'gestionar_asistencia_tutorias', 'gestionar_observaciones_tutorias', 'gestionar_notificaciones'] },
  { id: 'assets', label: 'Infraestructura', icon: 'assets', path: '/app/admin/infraestructura', requiredAnyPermission: ['*', 'gestionar_reservas', 'gestionar_reservas_materiales', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio', 'gestionar_inventario', 'gestionar_stock', 'gestionar_estado_equipos', 'gestionar_mantenimiento', 'gestionar_reactivos_quimicos', 'adjuntar_evidencia_inventario'] },
  { id: 'loans', label: 'Prestamos', icon: 'loans', path: '/app/admin/prestamos', requiredAnyPermission: ['*', 'gestionar_prestamos', 'generar_reportes', 'consultar_estadisticas'] },
  { id: 'profile', label: 'Perfil', icon: 'profile', path: '/app/perfil' },
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
