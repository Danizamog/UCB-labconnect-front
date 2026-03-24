import HomeView from '../../features/home/pages/HomeView'
import LoginView from '../../features/auth/pages/LoginView'

function AppRoutes({ isAuthenticated, onLogin, onLogout }) {
  if (!isAuthenticated) {
    return <LoginView onLogin={onLogin} />
  }

  return <HomeView onLogout={onLogout} />
}

export default AppRoutes