import { useEffect, useState } from 'react'
import AdminAreasPage from '../../admin/pages/AdminAreasPage'
import AdminEquiposPage from '../../admin/pages/AdminEquiposPage'
import AdminLaboratoriosPage from '../../admin/pages/AdminLaboratoriosPage'
import AdminMaterialesPage from '../../admin/pages/AdminMaterialesPage'
import AdminProfilesPage from '../../admin/pages/AdminProfilesPage'
import AdminRolesPage from '../../admin/pages/AdminRolesPage'
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
  const canManageEquipos = hasAnyPermission(user, ['gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageMateriales = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])
  const hasManagementModules = canManageRoles || canManageProfiles || canManageStructure || canManageEquipos || canManageMateriales
  const activeSection = getSectionIdFromPath(currentPath) || 'home'

  useEffect(() => {
    const normalizedPath = normalizePath(currentPath)
    const matchedSection = getSectionIdFromPath(normalizedPath)
    const canAccessCurrentSection =
      activeSection === 'home' ||
      (activeSection === 'admin_reservas' && canManageStructure) ||
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
                    <img src={ucbEscudoLogo} alt="UCB Escudo" style={{width: '80px', height: '80px'}} />
                  </div>
                  <h2>LabConnect - Panel de administración</h2>
                  <p>
                    Bienvenido a LabConnect de la Universidad Católica Boliviana San Pablo.
                  </p>
                  <p style={{fontSize: '14px', marginTop: '12px'}}>
                    Usa la barra lateral para navegar entre <strong>Perfiles</strong>, <strong>Roles</strong>, <strong>Areas</strong>, <strong>Laboratorios</strong>, <strong>Equipos</strong> y <strong>Materiales</strong>.
                  </p>
                </>
              ) : (
                <>
                  <header className="home-news-header" style={{display: 'block'}}>
                    <div style={{display: 'grid', gridTemplateColumns: '120px 1fr', gap: '24px', alignItems: 'center', marginBottom: '40px'}}>
                      <div style={{textAlign: 'center'}}>
                        <img src={ucbEscudoLogo} alt="UCB Escudo" style={{width: '100px', height: 'auto'}} />
                      </div>
                      <div>
                        <h2 style={{marginTop: 0, marginBottom: '12px'}}>Universidad Católica Boliviana San Pablo</h2>
                        <p style={{fontSize: '16px', margin: 0, color: '#666'}}>
                          Desde 1966 formando profesionales comprometidos con la excelencia académica y la responsabilidad social.
                        </p>
                      </div>
                    </div>
                  </header>

                  <section style={{marginBottom: '40px', paddingBottom: '24px', borderBottom: '1px solid #f0f0f0'}}>
                    <h3 style={{marginTop: 0, marginBottom: '16px'}}>¿Qué es LabConnect?</h3>
                    <p>
                      LabConnect es la plataforma integral de gestión de laboratorios de la Universidad Católica Boliviana San Pablo. 
                      Conecta docentes, estudiantes y personal administrativo en un ecosistema colaborativo que facilita:
                    </p>
                    <ul style={{margin: '16px 0', paddingLeft: '24px'}}>
                      <li><strong>Reserva de laboratorios</strong> para prácticas y proyectos académicos</li>
                      <li><strong>Gestión de inventario</strong> de equipos y materiales disponibles</li>
                      <li><strong>Control de acceso</strong> seguro a espacios especializados</li>
                      <li><strong>Seguimiento de préstamos</strong> y mantenimiento preventivo</li>
                    </ul>
                  </section>

                  <section style={{marginBottom: '40px', paddingBottom: '24px', borderBottom: '1px solid #f0f0f0'}}>
                    <h3 style={{marginTop: 0, marginBottom: '16px'}}>Nuestros Laboratorios</h3>
                    <p style={{marginBottom: '16px'}}>
                      Contamos con espacios modernos y completamente equipados para diferentes disciplinas:
                    </p>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}>
                      <div style={{padding: '12px', borderRadius: '8px', backgroundColor: '#f8f8f8', borderLeft: '4px solid #B3860E'}}>
                        <strong style={{fontSize: '14px', color: '#333'}}>Laboratorios de Ciencias</strong>
                        <p style={{fontSize: '13px', margin: '6px 0 0', color: '#666'}}>Física, Química y Biología</p>
                      </div>
                      <div style={{padding: '12px', borderRadius: '8px', backgroundColor: '#f8f8f8', borderLeft: '4px solid #B3860E'}}>
                        <strong style={{fontSize: '14px', color: '#333'}}>Laboratorios de Ingeniería</strong>
                        <p style={{fontSize: '13px', margin: '6px 0 0', color: '#666'}}>Sistemas, Mecánica y Electrónica</p>
                      </div>
                      <div style={{padding: '12px', borderRadius: '8px', backgroundColor: '#f8f8f8', borderLeft: '4px solid #B3860E'}}>
                        <strong style={{fontSize: '14px', color: '#333'}}>Laboratorios de Administración</strong>
                        <p style={{fontSize: '13px', margin: '6px 0 0', color: '#666'}}>Sistemas de Información y Negocios</p>
                      </div>
                    </div>
                  </section>



                  {hasManagementModules ? (
                    <p className="home-role-note" style={{marginTop: '24px'}}>
                      Tu rol actual también incluye accesos de gestión. Puedes usar las pestañas habilitadas arriba según tus permisos.
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
