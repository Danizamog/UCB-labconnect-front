export function getUserPermissions(user) {
  if (!user || !Array.isArray(user.permissions)) {
    return []
  }
  return user.permissions
}

export function hasAnyPermission(user, requiredPermissions = []) {
  if (!requiredPermissions.length) {
    return true
  }
  const permissions = getUserPermissions(user)
  if (user?.role === 'admin' || permissions.includes('*')) {
    return true
  }
  return requiredPermissions.some((permission) => permissions.includes(permission))
}

export function hasPermission(user, permission) {
  return hasAnyPermission(user, [permission])
}
