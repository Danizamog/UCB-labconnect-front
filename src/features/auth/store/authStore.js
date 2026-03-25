import { useState } from 'react'
import { signIn } from '../services/authService'

export function useAuthStore() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem('token')),
  )

  const login = async (credentials) => {
    const response = await signIn(credentials)

    if (response.success) {
      setIsAuthenticated(true)
    }

    return response
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
  }

  return {
    isAuthenticated,
    login,
    logout,
  }
}
