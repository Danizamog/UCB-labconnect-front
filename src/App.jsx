import AppRoutes from './app/routes/AppRoutes'
import { useAuthStore } from './features/auth/store/authStore'

function App() {
  const { isAuthenticated, login, logout } = useAuthStore()

  return (
    <AppRoutes
      isAuthenticated={isAuthenticated}
      onLogin={login}
      onLogout={logout}
    />
  )
}

export default App
