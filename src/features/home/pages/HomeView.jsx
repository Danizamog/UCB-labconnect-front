import { useEffect, useMemo, useState } from 'react'
import AdminAssetsPage from '../../admin/pages/AdminAssetsPage'
import AdminClassTutorialsPage from '../../admin/pages/AdminClassTutorialsPage'
import AdminLoansPage from '../../admin/pages/AdminLoansPage'
import AdminProfilesPage from '../../admin/pages/AdminProfilesPage'
import AdminRolesPage from '../../admin/pages/AdminRolesPage'
import { getClassTutorials } from '../../reservations/api/reservationsApi'
import AdminReservationsPage from '../../reservations/pages/AdminReservationsPage'
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
  const canManageReservations = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reservas_materiales', 'gestionar_reglas_reserva', 'gestionar_roles_permisos'])
  const canManageRoles = hasAnyPermission(user, ['gestionar_roles_permisos'])
  const canManageProfiles = hasAnyPermission(user, ['gestionar_roles_permisos', 'reactivar_cuentas'])
  const canManageSessions = hasAnyPermission(user, ['gestionar_tutorias', 'gestionar_inscripciones_tutorias', 'gestionar_asistencia_tutorias', 'gestionar_observaciones_tutorias', 'gestionar_notificaciones'])
  const canViewLoans = hasAnyPermission(user, ['gestionar_prestamos', 'generar_reportes', 'consultar_estadisticas'])
  const canManageAssets = hasAnyPermission(
    user,
    ['gestionar_inventario', 'gestionar_stock', 'gestionar_estado_equipos', 'gestionar_mantenimiento', 'gestionar_reactivos_quimicos', 'adjuntar_evidencia_inventario'],
  )
  const hasManagementModules = canManageReservations || canManageRoles || canManageProfiles || canManageSessions || canManageAssets || canViewLoans
  const activeSection = getSectionIdFromPath(currentPath) || 'home'

  useEffect(() => {
    const normalizedPath = normalizePath(currentPath)
    const matchedSection = getSectionIdFromPath(normalizedPath)
    const canAccessCurrentSection =
      activeSection === 'home' ||
      activeSection === 'profile' ||
      (activeSection === 'reservations' && canManageReservations) ||
      (activeSection === 'profiles' && canManageProfiles) ||
      (activeSection === 'roles' && canManageRoles) ||
      (activeSection === 'sessions' && canManageSessions) ||
      (activeSection === 'assets' && canManageAssets) ||
      (activeSection === 'loans' && canViewLoans) ||
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
    canManageAssets,
    canManageProfiles,
    canManageReservations,
    canManageRoles,
    canManageSessions,
    canViewLoans,
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
        if (isMounted) {
          setNewsLoading(false)
        }
      }
    }

    loadNews()
    return () => {
      isMounted = false
    }
  }, [])

  const newsSummary = useMemo(() => {
    const counts = { class: 0, tutorial: 0, guest: 0 }
    newsItems.forEach((item) => {
      if (counts[item.session_type] !== undefined) {
        counts[item.session_type] += 1
      }
    })
    return counts
  }, [newsItems])

  const handleNavigate = (nextPath) => {
    onNavigate?.(nextPath)
  }

  return (
    <div className="app-layout">
      <Navbar
        user={user}
        onLogout={onLogout}
        onNavigate={handleNavigate}
        activeSection={activeSection}
      />
      <main className="home-main">
        <section className="content-window" aria-label="Ventana principal">
          {canManageReservations && activeSection === 'reservations' ? <AdminReservationsPage user={user} /> : null}
          {canManageProfiles && activeSection === 'profiles' ? <AdminProfilesPage user={user} /> : null}
          {canManageRoles && activeSection === 'roles' ? <AdminRolesPage user={user} onSessionRefresh={onRefreshSession} /> : null}
          {canManageSessions && activeSection === 'sessions' ? <AdminClassTutorialsPage user={user} /> : null}
          {canManageAssets && activeSection === 'assets' ? <AdminAssetsPage user={user} /> : null}
          {canViewLoans && activeSection === 'loans' ? <AdminLoansPage user={user} /> : null}
          {!isAdmin && activeSection === 'reserve' ? <UserPracticePlannerPage user={user} /> : null}
          {!isAdmin && activeSection === 'calendar' ? <UserAvailabilityCalendarPage /> : null}
          {!isAdmin && activeSection === 'requests' ? <UserReservationCenterPage /> : null}

          {activeSection === 'home' ? (
            <section className={isAdmin ? 'home-placeholder' : 'home-dashboard'} aria-label="Panel de inicio">
              {isAdmin ? (
                <>
                  <h2>Panel principal</h2>
                  <p>
                    Selecciona <strong>Reservas</strong>, <strong>Prestamos</strong>, <strong>Perfiles</strong>, <strong>Roles</strong>, <strong>Clases y tutorias</strong> o <strong>Infraestructura</strong> en la barra superior para administrar el sistema.
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

          {!isAdmin && activeSection === 'profile' ? (
            <section className="home-placeholder" aria-label="Perfil de usuario">
              <h2>Perfil</h2>
              <p>
                Usuario: <strong>{user?.name || user?.username || 'Sin nombre'}</strong>
              </p>
              <p>
                Rol actual: <strong>{user?.role || 'user'}</strong>
              </p>
            </section>
          ) : null}

          {isAdmin && activeSection === 'profile' ? (
            <section className="home-placeholder" aria-label="Perfil administrativo">
              <h2>Perfil</h2>
              <p>
                Usuario: <strong>{user?.name || user?.username || 'Sin nombre'}</strong>
              </p>
              <p>
                Rol actual: <strong>{user?.role || 'admin'}</strong>
              </p>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default HomeView
