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
  }, [currentPath, isAuthenticated])

  const handleNavigate = (nextPath, options = {}) => {
    updateBrowserPath(nextPath, options)
  }

  const handleLogout = () => {
    onLogout?.()
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={onLogin} onInstitutionalLogin={onInstitutionalLogin} />
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
