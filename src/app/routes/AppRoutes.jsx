import { useEffect, useState } from 'react'
import LoginView from '../../features/auth/pages/LoginView'
import HomeView from '../../features/home/pages/HomeView'
import { APP_ROOT_PATH, LOGIN_PATH, normalizePath } from '../../shared/config/navigationLinks'

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/'
  }

  return normalizePath(window.location.pathname || '/')
}

function updateBrowserPath(nextPath, { replace = false } = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedPath = normalizePath(nextPath || '/')
  const currentPath = getCurrentPath()

  if (normalizedPath === currentPath) {
    return
  }

  const historyMethod = replace ? 'replaceState' : 'pushState'
  window.history[historyMethod]({}, '', normalizedPath)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AppRoutes({ isAuthenticated, user, onLogin, onInstitutionalLogin, onRefreshSession, onLogout }) {
  const [currentPath, setCurrentPath] = useState(getCurrentPath)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    const syncPath = () => {
      setCurrentPath(getCurrentPath())
    }

    window.addEventListener('popstate', syncPath)
    return () => {
      window.removeEventListener('popstate', syncPath)
    }
  }, [])

  useEffect(() => {
    if (isLoggingOut && !isAuthenticated) {
      setIsLoggingOut(false)
    }
  }, [isAuthenticated, isLoggingOut])

  useEffect(() => {
    if (isLoggingOut) {
      return
    }

    if (!isAuthenticated && (currentPath === '/' || (!currentPath.startsWith('/app') && currentPath !== LOGIN_PATH))) {
      updateBrowserPath(LOGIN_PATH, { replace: true })
      return
    }

    if (isAuthenticated && (currentPath === '/' || currentPath === LOGIN_PATH)) {
      updateBrowserPath(APP_ROOT_PATH, { replace: true })
    }
  }, [currentPath, isAuthenticated, isLoggingOut])

  const handleNavigate = (nextPath, options = {}) => {
    updateBrowserPath(nextPath, options)
  }

  const handleLogout = () => {
    setIsLoggingOut(true)
    onLogout?.()
    updateBrowserPath(LOGIN_PATH, { replace: true })
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={onLogin} onInstitutionalLogin={onInstitutionalLogin} />
  }

  return (
    <HomeView
      user={user}
      currentPath={currentPath}
      onNavigate={handleNavigate}
      onRefreshSession={onRefreshSession}
      onLogout={handleLogout}
    />
  )
}

export default AppRoutes
