import { useEffect, useMemo, useState } from 'react'
import AdminAreasPage from '../../admin/pages/AdminAreasPage'
import AdminEquiposPage from '../../admin/pages/AdminEquiposPage'
import AdminLaboratoriosPage from '../../admin/pages/AdminLaboratoriosPage'
import AdminMaterialesPage from '../../admin/pages/AdminMaterialesPage'
import AdminProfilesPage from '../../admin/pages/AdminProfilesPage'
import AdminRolesPage from '../../admin/pages/AdminRolesPage'
import { getClassTutorials } from '../../reservations/api/reservationsApi'
import UserAvailabilityCalendarPage from '../../reservations/pages/UserAvailabilityCalendarPage'
import UserPracticePlannerPage from '../../reservations/pages/UserPracticePlannerPage'
import UserReservationCenterPage from '../../reservations/pages/UserReservationCenterPage'
import Navbar from '../../../shared/components/navbar/navbar'
import {
  APP_ROOT_PATH,
  getSectionIdFromPath,
  normalizePath,
} from '../../../shared/config/navigationLinks'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './HomeView.css'

const sessionTypeLabels = {
  class: 'Clase',
  tutorial: 'Tutoria',
  guest: 'Invitado',
}

function formatNewsDate(dateValue, startTime, endTime) {
  try {
    const formattedDate = new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${dateValue}T00:00:00`))
    return `${formattedDate} · ${startTime?.slice(0, 5)} - ${endTime?.slice(0, 5)}`
  } catch {
    return `${dateValue} · ${startTime?.slice(0, 5)} - ${endTime?.slice(0, 5)}`
  }
}

function HomeView({ user, currentPath, onNavigate, onRefreshSession, onLogout }) {
  const [newsItems, setNewsItems] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState('')

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
      (activeSection === 'profiles' && canManageProfiles) ||
      (activeSection === 'roles' && canManageRoles) ||
      (activeSection === 'areas' && canManageStructure) ||
      (activeSection === 'laboratorios' && canManageStructure) ||
      (activeSection === 'equipos' && canManageEquipos) ||
      (activeSection === 'materiales' && canManageMateriales) ||
      (activeSection === 'reserve' && !isAdmin) ||
      (activeSection === 'calendar' && !isAdmin) ||
      (activeSection === 'requests' && !isAdmin)

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

  useEffect(() => {
    let isMounted = true

    const loadNews = async () => {
      setNewsLoading(true)
      try {
        const items = await getClassTutorials()
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const normalized = items
          .filter((item) => item?.date)
          .map((item) => ({
            ...item,
            startsAt: new Date(`${item.date}T${item.start_time}`),
          }))
          .filter((item) => !Number.isNaN(item.startsAt.getTime()) && item.startsAt >= today)
          .sort((left, right) => left.startsAt - right.startsAt)
          .slice(0, 6)

        if (!isMounted) return
        setNewsItems(normalized)
        setNewsError('')
      } catch (error) {
        if (!isMounted) return
        setNewsError(error?.message || 'No se pudieron cargar las novedades académicas')
      } finally {
        if (isMounted) setNewsLoading(false)
      }
    }

    loadNews()
    return () => { isMounted = false }
  }, [])

  const newsSummary = useMemo(() => {
    const counts = { class: 0, tutorial: 0, guest: 0 }
    newsItems.forEach((item) => {
      if (counts[item.session_type] !== undefined) counts[item.session_type] += 1
    })
    return counts
  }, [newsItems])

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
          {canManageStructure && activeSection === 'areas' ? <AdminAreasPage user={user} /> : null}
          {canManageStructure && activeSection === 'laboratorios' ? <AdminLaboratoriosPage user={user} /> : null}
          {canManageEquipos && activeSection === 'equipos' ? <AdminEquiposPage user={user} /> : null}
          {canManageMateriales && activeSection === 'materiales' ? <AdminMaterialesPage user={user} /> : null}
          {!isAdmin && activeSection === 'reserve' ? <UserPracticePlannerPage user={user} /> : null}
          {!isAdmin && activeSection === 'calendar' ? <UserAvailabilityCalendarPage /> : null}
          {!isAdmin && activeSection === 'requests' ? <UserReservationCenterPage /> : null}

          {activeSection === 'home' ? (
            <section className={isAdmin ? 'home-placeholder' : 'home-dashboard'} aria-label="Panel de inicio">
              {isAdmin ? (
                <>
                  <div className="home-placeholder-icon">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                  </div>
                  <h2>Panel de administración</h2>
                  <p>
                    Usa la barra lateral para navegar entre <strong>Perfiles</strong>, <strong>Roles</strong>, <strong>Areas</strong>, <strong>Laboratorios</strong>, <strong>Equipos</strong> y <strong>Materiales</strong>.
                  </p>
                </>
              ) : (
                <>
                  <header className="home-news-header">
                    <div>
                      <h2>Bienvenido</h2>
                      <p>
                        Usa <strong>Calendario</strong> para ver disponibilidad, <strong>Reservar practica</strong> para crear solicitudes y <strong>Mis reservas</strong> para seguir su estado.
                      </p>
                    </div>
                    <div className="home-news-summary">
                      <div><span>Clases</span><strong>{newsSummary.class}</strong></div>
                      <div><span>Tutorias</span><strong>{newsSummary.tutorial}</strong></div>
                      <div><span>Invitados</span><strong>{newsSummary.guest}</strong></div>
                    </div>
                  </header>

                  {hasManagementModules ? (
                    <p className="home-role-note">
                      Tu rol actual también incluye accesos de gestión. Puedes usar las pestañas habilitadas arriba según tus permisos.
                    </p>
                  ) : null}

                  <section className="home-news-board" aria-label="Novedades de laboratorios">
                    <div className="home-news-title">
                      <div>
                        <p className="home-news-kicker">Novedades académicas</p>
                        <h3>Clases, tutorias e invitados proximos</h3>
                      </div>
                    </div>

                    {newsLoading ? <p className="home-news-empty">Cargando novedades...</p> : null}
                    {newsError ? <p className="home-news-error">{newsError}</p> : null}

                    {!newsLoading && !newsError ? (
                      <div className="home-news-grid">
                        {newsItems.length > 0 ? (
                          newsItems.map((item) => (
                            <article key={`${item.session_type}-${item.id}`} className={`home-news-card type-${item.session_type}`}>
                              <div className="home-news-card-head">
                                <span className={`home-news-badge type-${item.session_type}`}>
                                  {sessionTypeLabels[item.session_type] || item.session_type}
                                </span>
                                <small>{item.laboratory_name}</small>
                              </div>
                              <h4>{item.title}</h4>
                              <p className="home-news-date">{formatNewsDate(item.date, item.start_time, item.end_time)}</p>
                              <div className="home-news-meta">
                                <span>Responsable: {item.facilitator_name}</span>
                                <span>Grupo: {item.target_group || 'Abierto a la comunidad'}</span>
                              </div>
                              <p className="home-news-copy">
                                {item.notes || 'Sesion academica programada dentro del cronograma institucional de laboratorios.'}
                              </p>
                            </article>
                          ))
                        ) : (
                          <p className="home-news-empty">
                            Aun no hay clases, tutorias o invitados proximos registrados.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </section>
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
