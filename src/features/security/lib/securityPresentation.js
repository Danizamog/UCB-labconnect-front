export const ROLE_ACTIONS = {
  'role.created': 'Rol creado', 'role.updated': 'Permisos o datos del rol modificados',
  'role.deleted': 'Rol eliminado', 'user.role_assigned': 'Rol asignado a una persona', 'user.role_removed': 'Rol retirado de una persona',
}
export const EVENT_LABELS = {
  'auth.login.succeeded': 'Ingreso con contraseña', 'auth.login.failed': 'Intento de ingreso fallido',
  'auth.sso_login.succeeded': 'Ingreso con Google', 'auth.sso_login.blocked': 'Acceso con Google bloqueado',
  'auth.account.locked': 'Cuenta bloqueada por intentos fallidos', 'auth.account.unlocked': 'Cuenta desbloqueada',
  'auth.password.changed': 'Contraseña actualizada', 'auth.password.reset': 'Contraseña reiniciada por un administrador',
  'auth.session.revoked': 'Sesión cerrada', 'auth.captcha.failed': 'Verificación CAPTCHA rechazada',
  'auth.captcha.unavailable': 'Verificación CAPTCHA no disponible', 'user.deactivated': 'Cuenta dada de baja',
  'user.test_account.created': 'Cuenta de prueba creada', 'laboratory.test_manager.assigned': 'Encargado de prueba asignado',
}
const REASONS = {
  invalid_credentials: 'El correo o la contraseña no coincidieron.', three_failed_logins: 'Se alcanzaron tres intentos de contraseña incorrecta.',
  account_locked: 'La cuenta estaba bloqueada.', challenge_rejected: 'No se completó correctamente el CAPTCHA.',
  verification_unavailable: 'El servicio de verificación no pudo responder.', password_changed: 'La persona cambió su contraseña.',
  administrative_password_reset: 'Un administrador reinició las credenciales.', user_logout: 'La persona cerró su sesión.',
}

export function parseSecurityDate(value) {
  if (!value) return null
  const normalized = String(value).trim().replace(' ', 'T')
  const parsed = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
export function securityDate(value) {
  const parsed = parseSecurityDate(value)
  return parsed ? parsed.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/La_Paz' }) : 'Sin fecha registrada'
}
export function securityDay(value) {
  const parsed = parseSecurityDate(value)
  if (!parsed) return ''
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parsed)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const humanReason = (value) => REASONS[value] || value || 'No se registró un motivo adicional.'
export const eventLabel = (record) => EVENT_LABELS[record.action] || ROLE_ACTIONS[record.action] || record.title || 'Actividad registrada'
export const readablePermission = (value) => String(value || '').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
export function eventResult(record) {
  if (/(?:^|\.)(?:blocked|locked)$/.test(record.action || '')) return { label: 'Bloqueado', tone: 'danger', value: 'blocked' }
  if (['failed', 'failure', 'error', 'denied'].includes(String(record.result).toLowerCase())) return { label: 'Fallido', tone: 'danger', value: 'failed' }
  if (['success', 'succeeded', 'ok'].includes(String(record.result).toLowerCase())) return { label: 'Correcto', tone: 'success', value: 'success' }
  return { label: 'Registrado', tone: 'neutral', value: 'recorded' }
}
export function sessionState(record, now = Date.now()) {
  const status = String(record.status || '').toLowerCase()
  if (['revoked', 'revocada', 'cerrada', 'closed'].includes(status)) return { label: 'Cerrada o revocada', tone: 'neutral', value: 'revoked' }
  const expiry = parseSecurityDate(record.expires_at)
  if (status === 'expired' || (expiry && expiry.getTime() <= now)) return { label: 'Vencida', tone: 'warning', value: 'expired' }
  if (['active', 'vigente'].includes(status) && expiry && expiry.getTime() > now) return { label: 'Vigente', tone: 'success', value: 'active' }
  return { label: 'Estado sin confirmar', tone: 'neutral', value: 'unknown' }
}
export function incidentState(record) {
  const status = String(record.status || '').toLowerCase()
  if (['closed', 'resolved', 'cerrado', 'resuelto'].includes(status)) return { label: 'Resuelto', tone: 'success', value: 'closed' }
  if (['in_progress', 'investigating', 'en_progreso'].includes(status)) return { label: 'En revisión', tone: 'warning', value: 'review' }
  return { label: status ? 'Abierto' : 'Sin clasificar', tone: 'warning', value: 'open' }
}
