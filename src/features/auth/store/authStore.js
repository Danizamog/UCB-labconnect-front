import { useCallback, useEffect, useRef, useState } from 'react'
import { clearStoredSession, signIn, signInWithInstitutionalSSO, validateSession } from '../services/authService'

const SESSION_REFRESH_COOLDOWN_MS = 15000

export function useAuthStore() {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user')
      return storedUser ? JSON.parse(storedUser) : null
    } catch {
      return null
    }
  })
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem('token') || localStorage.getItem('access_token')),
  )
  const refreshInFlightRef = useRef(null)
  const lastRefreshAtRef = useRef(0)
  const userRef = useRef(user)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const applyAuthenticatedUser = useCallback((nextUser) => {
    setIsAuthenticated(true)
    setUser(nextUser || null)
  }, [])

  const clearSession = useCallback(() => {
    clearStoredSession()
    setIsAuthenticated(false)
    setUser(null)
  }, [])

  const login = async (credentials) => {
    const response = await signIn(credentials)

    if (response.success) {
      applyAuthenticatedUser(response.user || null)
    }

    return response
  }

  const loginWithInstitutionalSSO = async (credential) => {
    const response = await signInWithInstitutionalSSO(credential)

    if (response.success) {
      applyAuthenticatedUser(response.user || null)
    }

    return response
  }

  const refreshSession = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && refreshInFlightRef.current) {
      return refreshInFlightRef.current
    }

    if (!force && now - lastRefreshAtRef.current < SESSION_REFRESH_COOLDOWN_MS) {
      return { success: true, skipped: true, user: userRef.current }
    }

    const refreshPromise = validateSession()
    refreshInFlightRef.current = refreshPromise

    const response = await refreshPromise

    if (response.success) {
      applyAuthenticatedUser(response.user || null)
      lastRefreshAtRef.current = Date.now()
      refreshInFlightRef.current = null
      return response
    }

    if (response.shouldLogout) {
      clearSession()
    }

    refreshInFlightRef.current = null
    return response
  }, [applyAuthenticatedUser, clearSession])

  useEffect(() => {
    if (!localStorage.getItem('token') && !localStorage.getItem('access_token')) {
      return undefined
    }

    const refreshInitialSession = async () => {
      await refreshSession({ force: true })
    }

    refreshInitialSession()

    const handleWindowFocus = () => {
      refreshSession()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSession()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshSession])

  const logout = () => {
    clearSession()
  }

  return {
    isAuthenticated,
    user,
    login,
    loginWithInstitutionalSSO,
    refreshSession,
    logout,
  }
}
