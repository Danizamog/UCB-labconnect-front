import { useEffect, useState } from 'react'
import AdminAreasPage from '../../admin/pages/AdminAreasPage'
import AdminEquiposPage from '../../admin/pages/AdminEquiposPage'
import AdminLaboratoriosPage from '../../admin/pages/AdminLaboratoriosPage'
import AdminMaterialesPage from '../../admin/pages/AdminMaterialesPage'
import AdminProfilesPage from '../../admin/pages/AdminProfilesPage'
import AdminRolesPage from '../../admin/pages/AdminRolesPage'
import AdminPenaltiesPage from '../../reservations/pages/AdminPenaltiesPage'
import AdminReservationsPage from '../../reservations/pages/AdminReservationsPage'
import UserAvailabilityCalendarPage from '../../reservations/pages/UserAvailabilityCalendarPage'
import UserReserveLabPage from '../../reservations/pages/UserReserveLabPage'
import Navbar from '../../../shared/components/navbar/navbar'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import ucbLapazLogo from '../../../assets/branding/ucb-san-pablo-lapaz.png'
import {
  APP_ROOT_PATH,
  getSectionIdFromPath,
  normalizePath,
} from '../../../shared/config/navigationLinks'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './HomeView.css'

function HomeView({ user, currentPath, onNavigate, onRefreshSession, onLogout }) {

  const isAdmin = user?.role === 'admin'
  const canManageRoles = hasAnyPermission(user, ['gestionar_roles_permisos'])
  const canManageProfiles = hasAnyPermission(user, ['gestionar_roles_permisos', 'reactivar_cuentas'])
  const canManageStructure = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])
  const canManagePenalties = hasAnyPermission(user, ['gestionar_penalizaciones'])
  const canManageEquipos = hasAnyPermission(user, ['gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageMateriales = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])
  const hasManagementModules = canManageRoles || canManageProfiles || canManageStructure || canManagePenalties || canManageEquipos || canManageMateriales
  const activeSection = getSectionIdFromPath(currentPath) || 'home'

  useEffect(() => {
    const normalizedPath = normalizePath(currentPath)
    const matchedSection = getSectionIdFromPath(normalizedPath)
    const canAccessCurrentSection =
      activeSection === 'home' ||
      (activeSection === 'admin_reservas' && canManageStructure) ||
      (activeSection === 'penalties' && canManagePenalties) ||
      (activeSection === 'profiles' && canManageProfiles) ||
      (activeSection === 'roles' && canManageRoles) ||
      (activeSection === 'areas' && canManageStructure) ||
      (activeSection === 'laboratorios' && canManageStructure) ||
      (activeSection === 'equipos' && canManageEquipos) ||
      (activeSection === 'materiales' && canManageMateriales) ||
      (activeSection === 'calendar' && !isAdmin) ||
      (activeSection === 'reserve' && !isAdmin)

    const isUnknownApplicationRoute =
      normalizedPath !== APP_ROOT_PATH &&
      normalizedPath !== '/' &&
      !matchedSection

    if (!canAccessCurrentSection || isUnknownApplicationRoute) {
      onNavigate?.(APP_ROOT_PATH, { replace: true })
    }
  }, [
    activeSection,
    canManageEquipos,
    canManageMateriales,
    canManagePenalties,
    canManageProfiles,
    canManageRoles,
    canManageStructure,
    currentPath,
    isAdmin,
    onNavigate,
  ])

  return (
    <div className="app-layout">
      <Navbar
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activeSection={activeSection}
      />
      <main className="home-main">
        <section className="content-window" aria-label="Ventana principal">
          {canManageProfiles && activeSection === 'profiles' ? <AdminProfilesPage user={user} /> : null}
          {canManageRoles && activeSection === 'roles' ? <AdminRolesPage user={user} onSessionRefresh={onRefreshSession} /> : null}
          {canManageStructure && activeSection === 'admin_reservas' ? <AdminReservationsPage user={user} /> : null}
          {canManagePenalties && activeSection === 'penalties' ? <AdminPenaltiesPage user={user} /> : null}
          {canManageStructure && activeSection === 'areas' ? <AdminAreasPage user={user} /> : null}
          {canManageStructure && activeSection === 'laboratorios' ? <AdminLaboratoriosPage user={user} /> : null}
          {canManageEquipos && activeSection === 'equipos' ? <AdminEquiposPage user={user} /> : null}
          {canManageMateriales && activeSection === 'materiales' ? <AdminMaterialesPage user={user} /> : null}
          {!isAdmin && activeSection === 'calendar' ? <UserAvailabilityCalendarPage /> : null}
          {!isAdmin && activeSection === 'reserve' ? <UserReserveLabPage user={user} /> : null}

          {activeSection === 'home' ? (
            <section className={isAdmin ? 'home-placeholder' : 'home-dashboard'} aria-label="Panel de inicio">
              {isAdmin ? (
                <>
                  <div className="home-placeholder-icon">
                    <img src={ucbEscudoLogo} alt="UCB Escudo" width="80" height="80" />
                  </div>
                  <h2>LabConnect</h2>
                  <p className="home-placeholder-subtitle">
                    Panel de administración — Universidad Católica Boliviana San Pablo
                  </p>
                  <p className="home-placeholder-hint">
                    Usa la barra lateral para navegar entre <strong>Perfiles</strong>, <strong>Roles</strong>, <strong>Áreas</strong>, <strong>Laboratorios</strong>, <strong>Equipos</strong> y <strong>Materiales</strong>.
                  </p>
                </>
              ) : (
                <>
                  <div className="home-hero">
                    <a href="https://www.ucb.edu.bo" target="_blank" rel="noopener noreferrer" className="home-hero-link">
                      <img src={ucbEscudoLogo} alt="UCB Escudo" className="home-hero-logo" />
                    </a>
                    <div className="home-hero-meta">
                      <h2>Universidad Católica Boliviana San Pablo</h2>
                      <p>Desde 1966 formando profesionales comprometidos con la excelencia académica y la responsabilidad social.</p>
                      <a href="https://www.ucb.edu.bo" target="_blank" rel="noopener noreferrer" className="home-hero-btn">
                        Visitar sitio oficial →
                      </a>
                    </div>
                  </div>

                  <div className="home-section">
                    <h3 className="home-section-title">¿Qué es LabConnect?</h3>
                    <p className="home-section-text">
                      LabConnect es la plataforma integral de gestión de laboratorios de la UCB San Pablo.
                      Conecta docentes, estudiantes y personal administrativo en un ecosistema colaborativo que facilita:
                    </p>
                    <ul className="home-features">
                      <li><strong>Reserva de laboratorios</strong> para prácticas y proyectos académicos</li>
                      <li><strong>Gestión de inventario</strong> de equipos y materiales disponibles</li>
                      <li><strong>Control de acceso</strong> seguro a espacios especializados</li>
                      <li><strong>Seguimiento de préstamos</strong> y mantenimiento preventivo</li>
                    </ul>
                  </div>

                  <div className="home-section">
                    <h3 className="home-section-title">Nuestros Laboratorios</h3>
                    <p className="home-section-text">
                      Contamos con espacios modernos y completamente equipados para diferentes disciplinas:
                    </p>
                    <div className="home-labs-grid">
                      <div className="home-lab-card">
                        <strong>Laboratorios de Ciencias</strong>
                        <p>Física, Química y Biología</p>
                      </div>
                      <div className="home-lab-card">
                        <strong>Laboratorios de Ingeniería</strong>
                        <p>Sistemas, Mecánica y Electrónica</p>
                      </div>
                      <div className="home-lab-card">
                        <strong>Laboratorios de Administración</strong>
                        <p>Sistemas de Información y Negocios</p>
                      </div>
                    </div>
                  </div>

                  <div className="home-section">
                    <h3 className="home-section-title">Acciones Rápidas</h3>
                    <div className="home-quick-actions">
                      <button 
                        className="home-action-btn home-action-reserve"
                        onClick={() => onNavigate?.('/reserve')}
                      >
                        <span className="action-icon">📅</span>
                        <div className="action-content">
                          <strong>Reservar Laboratorio</strong>
                          <p>Accede a la disponibilidad de espacios</p>
                        </div>
                      </button>
                      <button 
                        className="home-action-btn home-action-calendar"
                        onClick={() => onNavigate?.('/calendar')}
                      >
                        <span className="action-icon">📋</span>
                        <div className="action-content">
                          <strong>Mi Calendario</strong>
                          <p>Consulta tus reservas activas</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="home-section">
                    <h3 className="home-section-title">Enlaces Útiles</h3>
                    <div className="home-links-grid">
                      <a href="https://www.ucb.edu.bo" target="_blank" rel="noopener noreferrer" className="home-link-card">
                        <span className="link-icon">🏫</span>
                        <strong>Sitio Web UCB</strong>
                        <p>Página principal de la Universidad</p>
                      </a>
                      <a href="https://www.ucb.edu.bo/carreras" target="_blank" rel="noopener noreferrer" className="home-link-card">
                        <span className="link-icon">📚</span>
                        <strong>Programas Académicos</strong>
                        <p>Conoce nuestras licenciaturas</p>
                      </a>
                      <a href="https://www.ucb.edu.bo/contacto" target="_blank" rel="noopener noreferrer" className="home-link-card">
                        <span className="link-icon">📧</span>
                        <strong>Contacto</strong>
                        <p>Datos de comunicación y ubicación</p>
                      </a>
                      <a href="https://www.ucb.edu.bo" target="_blank" rel="noopener noreferrer" className="home-link-card">
                        <span className="link-icon">🌐</span>
                        <strong>Portal UCB</strong>
                        <p>Acceso a recursos universitarios</p>
                      </a>
                    </div>
                  </div>

                  {hasManagementModules ? (
                    <p className="home-role-note">
                      Tu rol actual también incluye accesos de gestión. Puedes usar las pestañas habilitadas según tus permisos.
                    </p>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default HomeView
