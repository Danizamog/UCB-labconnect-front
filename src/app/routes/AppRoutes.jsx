import { lazy, Suspense, useEffect, useState } from 'react'
import LoginView from '../../features/auth/pages/LoginView'
import HomeView from '../../features/home/pages/HomeView'
const MyAccountPage = lazy(() => import('../../features/account/pages/MyAccountPage'))
import { APP_ROOT_PATH, LOGIN_PATH, normalizePath } from '../../shared/config/navigationLinks'

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/'
  }

  return normalizePath(window.location.pathname || '/')
}

function getCurrentHash() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.location.hash || ''
}

function splitRoute(nextPath) {
  const [rawPath = '/', rawHash = ''] = String(nextPath || '/').split('#')
  const path = normalizePath(rawPath || '/')
  const hash = rawHash ? `#${String(rawHash).replace(/^#/, '')}` : ''
  return { path, hash }
}

function updateBrowserPath(nextPath, { replace = false } = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const { path, hash } = splitRoute(nextPath)
  const currentPath = getCurrentPath()
  const currentHash = getCurrentHash()

  if (path === currentPath && hash === currentHash) {
    return
  }

  const historyMethod = replace ? 'replaceState' : 'pushState'
  window.history[historyMethod]({}, '', `${path}${hash}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AppRoutes({ isAuthenticated, user, onLogin, onInstitutionalLogin, onRefreshSession, onLogout }) {
  const [currentPath, setCurrentPath] = useState(getCurrentPath)
  const [currentHash, setCurrentHash] = useState(getCurrentHash)

  useEffect(() => {
    const syncPath = () => {
      setCurrentPath(getCurrentPath())
      setCurrentHash(getCurrentHash())
    }

    window.addEventListener('popstate', syncPath)
    window.addEventListener('hashchange', syncPath)
    return () => {
      window.removeEventListener('popstate', syncPath)
      window.removeEventListener('hashchange', syncPath)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated && currentPath !== LOGIN_PATH) {
      updateBrowserPath(LOGIN_PATH, { replace: true })
      return
    }

    if (isAuthenticated && (currentPath === '/' || currentPath === LOGIN_PATH)) {
      updateBrowserPath(APP_ROOT_PATH, { replace: true })
    }
    if (isAuthenticated && user?.must_change_password && currentPath !== '/app/mi-cuenta') {
      updateBrowserPath('/app/mi-cuenta', { replace: true })
    }
  }, [currentPath, isAuthenticated, user?.must_change_password])

  const handleNavigate = (nextPath, options = {}) => {
    if (user?.must_change_password && splitRoute(nextPath).path !== '/app/mi-cuenta') {
      updateBrowserPath('/app/mi-cuenta', { replace: true })
      return
    }
    updateBrowserPath(nextPath, options)
  }

  const handleLogout = () => {
    onLogout?.()
  }

  const handlePasswordEstablished = async () => {
    const response = await onRefreshSession?.({ force: true })
    if (!response?.success) throw new Error(response?.message || 'No se pudo renovar la sesión. Recarga la página para continuar.')
    updateBrowserPath(APP_ROOT_PATH, { replace: true })
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={onLogin} onInstitutionalLogin={onInstitutionalLogin} />
  }

  if (user?.must_change_password) {
    return <Suspense fallback={<p>Cargando cambio de contraseña...</p>}><MyAccountPage onLogout={handleLogout} onPasswordEstablished={handlePasswordEstablished} requiredChange /></Suspense>
  }

  return (
    <HomeView
      user={user}
      currentPath={currentPath}
      currentHash={currentHash}
      onNavigate={handleNavigate}
      onRefreshSession={onRefreshSession}
      onLogout={handleLogout}
    />
  )
}

export default AppRoutes
