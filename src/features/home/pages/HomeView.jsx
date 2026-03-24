import { useState } from 'react'
import AdminRolesPage from '../../admin/pages/AdminRolesPage'
import AdminAssetsPage from '../../admin/pages/AdminAssetsPage'
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
          {activeSection === 'roles' ? <AdminRolesPage /> : null}
          {activeSection === 'assets' ? <AdminAssetsPage /> : null}
          {activeSection === 'home' ? (
            <section className="home-placeholder" aria-label="Panel de inicio">
              <h2>Panel principal</h2>
              <p>
                Selecciona <strong>Roles</strong> o <strong>Equipos</strong> en la barra superior para administrar el sistema.
              </p>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default HomeView
