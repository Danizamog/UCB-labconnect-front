const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const AUTH_LOGIN_ENDPOINT = `${apiBase}/auth/login`

function decodeJwtPayload(token) {
  try {
    const payloadBase64 = token.split('.')[1]
    if (!payloadBase64) return null

    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export async function signIn(credentials) {
  const { email, password } = credentials

  try {
    const response = await fetch(AUTH_LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: email?.trim().toLowerCase(),
        password,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        success: false,
        message: data?.detail || 'No se pudo iniciar sesión',
      }
    }

    const token = data?.access_token
    if (!token) {
      return {
        success: false,
        message: 'No se recibió token de autenticación',
      }
    }

    const payload = decodeJwtPayload(token)
    const user = payload
      ? {
          username: payload.sub,
          role: payload.role,
          user_id: payload.user_id,
        }
      : null

    localStorage.setItem('token', token)
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    }

    return { success: true, token, user }
  } catch {
    return {
      success: false,
      message: 'Error de conexión al autenticarse',
    }
  }
}
