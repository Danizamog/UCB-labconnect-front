import AppRoutes from './routes/AppRoutes'
import { useAuthStore } from './store/authStore'

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
