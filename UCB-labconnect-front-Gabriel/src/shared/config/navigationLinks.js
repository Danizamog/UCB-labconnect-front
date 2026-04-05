export const LOGIN_PATH = '/login'
export const APP_ROOT_PATH = '/app'

export const NAVIGATION_LINKS = [
  { id: 'home', label: 'Inicio', icon: 'home', path: APP_ROOT_PATH },
  { id: 'admin_reservas', label: 'Reservas Lab', icon: 'admin_reservas', path: '/app/admin/reservas', requiredAnyPermission: ['*', 'gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'] },
  { id: 'tutorials_manage', label: 'Publicar Tutorias', icon: 'tutorials_manage', path: '/app/tutorias/publicar', requiredAnyPermission: ['*', 'gestionar_tutorias'] },
  { id: 'profiles', label: 'Perfiles', icon: 'profiles', path: '/app/admin/perfiles', requiredAnyPermission: ['*', 'gestionar_roles_permisos', 'reactivar_cuentas'] },
  { id: 'roles', label: 'Roles', icon: 'roles', path: '/app/admin/roles', requiredAnyPermission: ['*', 'gestionar_roles_permisos'] },
  { id: 'penalties', label: 'Penalizaciones', icon: 'penalties', path: '/app/admin/penalizaciones', requiredAnyPermission: ['*', 'gestionar_penalizaciones'] },
  { id: 'areas', label: 'Areas', icon: 'areas', path: '/app/admin/areas', requiredAnyPermission: ['*', 'gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'] },
  { id: 'laboratorios', label: 'Laboratorios', icon: 'laboratorios', path: '/app/admin/laboratorios', requiredAnyPermission: ['*', 'gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'] },
  { id: 'equipos', label: 'Equipos', icon: 'equipos', path: '/app/admin/equipos', requiredAnyPermission: ['*', 'gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento'] },
  { id: 'materiales', label: 'Materiales', icon: 'materiales', path: '/app/admin/materiales', requiredAnyPermission: ['*', 'gestionar_stock', 'gestionar_reactivos_quimicos'] },
  { id: 'calendar', label: 'Calendario', icon: 'calendar', path: '/app/reservas/calendario', userOnly: true },
  { id: 'tutorials_public', label: 'Tutorias', icon: 'tutorials_public', path: '/app/tutorias', userOnly: true },
  { id: 'reserve', label: 'Reservar', icon: 'reserve', path: '/app/reservas/nueva', userOnly: true },
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
