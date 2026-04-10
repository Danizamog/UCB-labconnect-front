import { getAuthToken } from '../../../shared/utils/storage'

const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const apiBase = gatewayBase.endsWith('/v1') ? gatewayBase.slice(0, -3) : gatewayBase
const AUTH_LOGIN_ENDPOINT = `${apiBase}/auth/login`
const AUTH_INSTITUTIONAL_ENDPOINT = `${apiBase}/auth/institutional`
const AUTH_INSTITUTIONAL_CONFIG_ENDPOINT = `${apiBase}/auth/institutional/config`
const AUTH_VALIDATE_ENDPOINT = `${apiBase}/auth/validate`
const PENALTIES_MINE_ENDPOINT = `${apiBase}/v1/penalties/mine`
const AUTH_WARNING_STORAGE_KEY = 'labconnect.auth_warning'

const FRONTEND_GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
const SESSION_VALIDATE_CACHE_TTL_MS = 1000
let validateSessionInFlight = null
let lastValidatedToken = ''
let lastValidateAt = 0
let lastValidateResponse = null

function resetValidateSessionCache() {
  validateSessionInFlight = null
  lastValidatedToken = ''
  lastValidateAt = 0
  lastValidateResponse = null
}

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
  const token = String(data?.access_token || '').trim()
  if (!token || token === 'undefined' || token === 'null') {
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
  localStorage.setItem('access_token', token)
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  }
  resetValidateSessionCache()

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
  localStorage.removeItem(AUTH_WARNING_STORAGE_KEY)
  resetValidateSessionCache()
}

function storeAuthWarning(message) {
  const normalized = String(message || '').trim()
  if (normalized) {
    localStorage.setItem(AUTH_WARNING_STORAGE_KEY, normalized)
    return
  }
  localStorage.removeItem(AUTH_WARNING_STORAGE_KEY)
}

async function loadPenaltyWarning(token) {
  if (!token) {
    return ''
  }

  try {
    const response = await fetch(PENALTIES_MINE_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 423) {
        return String(payload?.detail || '').trim()
      }
      return ''
    }

    const penalties = Array.isArray(payload) ? payload : []
    const activePenalty = Array.isArray(penalties)
      ? penalties.find((penalty) => penalty?.is_active)
      : null

    if (!activePenalty) {
      return ''
    }

    const reason = String(activePenalty.reason || 'Sin motivo registrado').trim()
    const endsAt = String(activePenalty.ends_at || '').trim()
    return endsAt
      ? `Tu cuenta tiene una penalizacion activa. Motivo: ${reason}. Vigente hasta ${endsAt}.`
      : `Tu cuenta tiene una penalizacion activa. Motivo: ${reason}.`
  } catch {
    return ''
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

    const authResponse = persistAuthResponse(data)
    if (!authResponse.success) {
      return authResponse
    }

    const warningMessage = await loadPenaltyWarning(authResponse.token)
    storeAuthWarning(warningMessage)
    return {
      ...authResponse,
      warningMessage,
    }
  } catch {
    return {
      success: false,
      message: 'Error de conexion al autenticarse',
    }
  }
}

export async function getInstitutionalSSOConfig() {
  const frontendFallbackConfig = FRONTEND_GOOGLE_CLIENT_ID
    ? {
        enabled: true,
        provider: 'google_oidc',
        client_id: FRONTEND_GOOGLE_CLIENT_ID,
        button_label: 'Continuar con Google UCB',
      }
    : {
        enabled: false,
        provider: null,
        client_id: null,
        button_label: 'Continuar con cuenta institucional',
      }

  try {
    const response = await fetch(AUTH_INSTITUTIONAL_CONFIG_ENDPOINT)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (frontendFallbackConfig.enabled) {
        return { success: true, config: frontendFallbackConfig }
      }

      return {
        success: false,
        message: data?.detail || 'No se pudo cargar la configuracion del acceso institucional',
      }
    }

    const backendEnabled = Boolean(data?.enabled)
    const backendClientId = data?.client_id || null

    return {
      success: true,
      config: {
        enabled: backendEnabled || frontendFallbackConfig.enabled,
        provider: data?.provider || (frontendFallbackConfig.enabled ? 'google_oidc' : null),
        client_id: backendClientId || frontendFallbackConfig.client_id,
        button_label: data?.button_label || 'Continuar con cuenta institucional',
      },
    }
  } catch {
    if (frontendFallbackConfig.enabled) {
      return { success: true, config: frontendFallbackConfig }
    }

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

    const authResponse = persistAuthResponse(data)
    if (!authResponse.success) {
      return authResponse
    }

    const warningMessage = await loadPenaltyWarning(authResponse.token)
    storeAuthWarning(warningMessage)
    return {
      ...authResponse,
      warningMessage,
    }
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

export function consumeStoredAuthWarning() {
  const message = localStorage.getItem(AUTH_WARNING_STORAGE_KEY) || ''
  localStorage.removeItem(AUTH_WARNING_STORAGE_KEY)
  return String(message || '').trim()
}

export async function validateSession() {
  const token = getAuthToken()

  if (!token) {
    return {
      success: false,
      shouldLogout: true,
      message: 'No hay sesion activa',
    }
  }

  try {
    if (
      lastValidateResponse &&
      lastValidatedToken === token &&
      Date.now() - lastValidateAt < SESSION_VALIDATE_CACHE_TTL_MS
    ) {
      return typeof globalThis.structuredClone === 'function'
        ? globalThis.structuredClone(lastValidateResponse)
        : JSON.parse(JSON.stringify(lastValidateResponse))
    }

    if (validateSessionInFlight && lastValidatedToken === token) {
      return validateSessionInFlight
    }

    lastValidatedToken = token
    validateSessionInFlight = (async () => {
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

        const failure = {
          success: false,
          shouldLogout,
          message: data?.detail || 'No se pudo validar la sesion',
        }

        lastValidatedToken = token
        lastValidateAt = Date.now()
        lastValidateResponse = failure
        return failure
      }

      const user = buildUserFromPayload(data)
      if (user) {
        localStorage.setItem('user', JSON.stringify(user))
      }

      const successResponse = {
        success: true,
        token,
        user,
        payload: data,
      }

      lastValidatedToken = token
      lastValidateAt = Date.now()
      lastValidateResponse = successResponse
      return successResponse
    })()

    return await validateSessionInFlight
  } catch {
    return {
      success: false,
      shouldLogout: false,
      message: 'No se pudo validar la sesion en este momento',
    }
  } finally {
    validateSessionInFlight = null
  }
}

export { clearStoredSession }
