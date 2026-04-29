export function getUserPermissions(user) {
  if (!user || !Array.isArray(user.permissions)) {
    return []
  }
  return user.permissions
}

export function isAdminUser(user) {
  const role = String(user?.role || '').toLowerCase().trim()
  return role === 'admin' || role === 'administrador'
}

export function hasAnyPermission(user, requiredPermissions = []) {
  if (!requiredPermissions.length) {
    return true
  }
  const permissions = getUserPermissions(user)
  if (isAdminUser(user) || permissions.includes('*')) {
    return true
  }
  return requiredPermissions.some((permission) => permissions.includes(permission))
}

export function hasPermission(user, permission) {
  return hasAnyPermission(user, [permission])
}
