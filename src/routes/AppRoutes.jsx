import HomeView from '../views/home/HomeView'
import LoginView from '../views/login/LoginView'

function AppRoutes({ isAuthenticated, onLogin, onLogout }) {
  if (!isAuthenticated) {
    return <LoginView onLogin={onLogin} />
  }

  return <HomeView onLogout={onLogout} />
}

export default AppRoutes