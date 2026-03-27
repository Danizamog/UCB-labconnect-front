const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const AUTH_LOGIN_ENDPOINT = `${apiBase}/auth/login`
const AUTH_INSTITUTIONAL_ENDPOINT = `${apiBase}/auth/institutional`
const AUTH_INSTITUTIONAL_CONFIG_ENDPOINT = `${apiBase}/auth/institutional/config`
const AUTH_VALIDATE_ENDPOINT = `${apiBase}/auth/validate`
const SESSION_CLEARED_EVENT = 'labconnect:session-cleared'

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

function persistAuthResponse(data) {
  const token = data?.access_token
  if (!token) {
    return {
      success: false,
      message: 'No se recibio token de autenticacion',
    }
  }

  const payload = decodeJwtPayload(token)
  const user = payload
    ? {
        username: payload.sub,
        role: payload.role || 'user',
        user_id: payload.user_id,
        name: payload.name,
        picture: payload.picture,
        auth_provider: payload.auth_provider,
        permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      }
    : null

  localStorage.setItem('token', token)
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  }

  return { success: true, token, user }
}

function buildUserFromPayload(payload) {
  if (!payload) {
    return null
  }

  return {
    username: payload.subject || payload.sub,
    role: payload.role || 'user',
    user_id: payload.user_id,
    name: payload.name,
    picture: payload.picture,
    auth_provider: payload.auth_provider,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  }
}

function clearStoredSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('access_token')
  localStorage.removeItem('user')
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_CLEARED_EVENT))
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
        message: data?.detail || 'No se pudo iniciar sesion',
      }
    }

    return persistAuthResponse(data)
  } catch {
    return {
      success: false,
      message: 'Error de conexion al autenticarse',
    }
  }
}

export async function getInstitutionalSSOConfig() {
  try {
    const response = await fetch(AUTH_INSTITUTIONAL_CONFIG_ENDPOINT)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        success: false,
        message: data?.detail || 'No se pudo cargar la configuracion del acceso institucional',
      }
    }

    return {
      success: true,
      config: {
        enabled: Boolean(data?.enabled),
        provider: data?.provider || null,
        client_id: data?.client_id || null,
        button_label: data?.button_label || 'Continuar con cuenta institucional',
      },
    }
  } catch {
    return {
      success: false,
      message: 'No se pudo cargar la configuracion del acceso institucional',
    }
  }
}

export async function signInWithInstitutionalSSO(credential) {
  try {
    const response = await fetch(AUTH_INSTITUTIONAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        success: false,
        message: data?.detail || 'No se pudo iniciar sesion con la cuenta institucional',
      }
    }

    return persistAuthResponse(data)
  } catch {
    return {
      success: false,
      message: 'Error de conexion al autenticarse con la cuenta institucional',
    }
  }
}

export async function signInWithGoogle(credential) {
  return signInWithInstitutionalSSO(credential)
}

export async function validateSession() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token') || ''

  if (!token) {
    return {
      success: false,
      shouldLogout: true,
      message: 'No hay sesion activa',
    }
  }

  try {
    const response = await fetch(AUTH_VALIDATE_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const shouldLogout = response.status === 401
      if (shouldLogout) {
        clearStoredSession()
      }

      return {
        success: false,
        shouldLogout,
        message: data?.detail || 'No se pudo validar la sesion',
      }
    }

    const user = buildUserFromPayload(data)
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    }

    return {
      success: true,
      token,
      user,
      payload: data,
    }
  } catch {
    return {
      success: false,
      shouldLogout: false,
      message: 'No se pudo validar la sesion en este momento',
    }
  }
}

export { clearStoredSession, SESSION_CLEARED_EVENT }
