import AppRoutes from './app/routes/AppRoutes'
import { useAuthStore } from './features/auth/store/authStore'

function App() {
  const { isAuthenticated, user, login, loginWithInstitutionalSSO, refreshSession, logout } = useAuthStore()

  return (
    <AppRoutes
      isAuthenticated={isAuthenticated}
      user={user}
      onLogin={login}
      onInstitutionalLogin={loginWithInstitutionalSSO}
      onRefreshSession={refreshSession}
      onLogout={logout}
    />
  )
}

export default App
