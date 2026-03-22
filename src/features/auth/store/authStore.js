import { useState } from 'react'
import { signIn } from '../services/authService'

export function useAuthStore() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const login = async (credentials) => {
    const response = await signIn(credentials)

    if (response.success) {
      setIsAuthenticated(true)
    }

    return response
  }

  const logout = () => {
    setIsAuthenticated(false)
  }

  return {
    isAuthenticated,
    login,
    logout,
  }
}
