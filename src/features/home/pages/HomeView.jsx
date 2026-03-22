import { useState } from 'react'
import AdminRolesPage from '../../admin/pages/AdminRolesPage'
import Navbar from '../../../shared/components/navbar/navbar'
import './HomeView.css'

function HomeView({ onLogout }) {
  const [activeSection, setActiveSection] = useState('home')

  const handleNavigate = (section) => {
    setActiveSection(section)
  }

  return (
    <div className="app-layout">
      <Navbar
        onLogout={onLogout}
        onNavigate={handleNavigate}
        activeSection={activeSection}
      />
      <main className="home-main">
        <section className="content-window" aria-label="Ventana principal">
          {activeSection === 'roles' ? (
            <AdminRolesPage />
          ) : (
            <section className="home-placeholder" aria-label="Panel de inicio">
              <h2>Panel principal</h2>
              <p>
                Selecciona <strong>Roles</strong> en la barra superior para administrar permisos de usuarios.
              </p>
            </section>
          )}
        </section>
      </main>
    </div>
  )
}

export default HomeView
