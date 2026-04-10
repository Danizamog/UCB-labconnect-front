/**
 * Devuelve el token de autenticación almacenado.
 * @returns {string}
 */
export function getAuthToken() {
  const rawToken = localStorage.getItem('token') || localStorage.getItem('access_token') || ''
  const token = String(rawToken || '').trim()
  return token && token !== 'undefined' && token !== 'null' ? token : ''
}
