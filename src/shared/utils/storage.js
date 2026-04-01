/**
 * Devuelve el token de autenticación almacenado.
 * @returns {string}
 */
export function getAuthToken() {
  return localStorage.getItem('token') || localStorage.getItem('access_token') || ''
}
