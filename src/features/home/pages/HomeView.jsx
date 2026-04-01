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
import StudentTutorialSessionsPage from '../../tutorials/pages/StudentTutorialSessionsPage'
import TutorTutorialSessionsPage from '../../tutorials/pages/TutorTutorialSessionsPage'
import Navbar from '../../../shared/components/navbar/navbar'
import NotificationBell from '../../../shared/components/NotificationBell'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import ucbLapazLogo from '../../../assets/branding/ucb-san-pablo-lapaz.png'
import {
  APP_ROOT_PATH,
  getSectionIdFromPath,
  normalizePath,
} from '../../../shared/config/navigationLinks'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import {
  getOccupancyDashboard,
  listReservationNotifications,
  markAllReservationNotificationsAsRead,
  markReservationNotificationAsRead,
  subscribeReservationsRealtime,
} from '../../reservations/services/reservationsService'
import './HomeView.css'

const FOCUSED_RESERVATION_KEY = 'labconnect.focus_reservation_id'
const OPEN_RESERVATION_EVENT = 'labconnect:open-reservation-details'
const FOCUSED_TUTORIAL_KEY = 'labconnect.focus_tutorial_session_id'
const OPEN_TUTORIAL_EVENT = 'labconnect:open-tutorial-session'
const OPERATIONS_RECIPIENT_ID = '__operations__'

function HomeView({ user, currentPath, onNavigate, onRefreshSession, onLogout }) {
  const [notifications, setNotifications] = useState([])
  const [operationsSnapshot, setOperationsSnapshot] = useState({
    current_occupancy: 0,
    active_sessions: [],
    lab_breakdown: [],
  })
  const isAdmin = user?.role === 'admin'
  const canManageRoles = hasAnyPermission(user, ['gestionar_roles_permisos'])
  const canManageProfiles = hasAnyPermission(user, ['gestionar_roles_permisos', 'reactivar_cuentas'])
  const canManageStructure = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])
  const canManagePenalties = hasAnyPermission(user, ['gestionar_penalizaciones'])
  const canManageEquipos = hasAnyPermission(user, ['gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageMateriales = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])
  const canManageTutorials = hasAnyPermission(user, ['gestionar_tutorias'])
  const hasManagementModules =
    canManageRoles || canManageProfiles || canManageStructure || canManagePenalties || canManageEquipos || canManageMateriales || canManageTutorials
  const activeSection = getSectionIdFromPath(currentPath) || 'home'
  const shouldTrackOperationsSnapshot = canManageStructure && activeSection === 'home'
  const unreadNotificationsCount = notifications.filter((notification) => !notification.is_read).length

  const loadNotifications = async () => {
    try {
      const notificationsData = await listReservationNotifications()
      setNotifications(notificationsData)
    } catch {
      setNotifications([])
    }
  }

  const loadOperationsSnapshot = async () => {
    if (!shouldTrackOperationsSnapshot) {
      setOperationsSnapshot({ current_occupancy: 0, active_sessions: [], lab_breakdown: [] })
      return
    }

    try {
      const dashboard = await getOccupancyDashboard()
      setOperationsSnapshot({
        current_occupancy: Number(dashboard?.current_occupancy || 0),
        active_sessions: Array.isArray(dashboard?.active_sessions) ? dashboard.active_sessions : [],
        lab_breakdown: Array.isArray(dashboard?.lab_breakdown) ? dashboard.lab_breakdown : [],
      })
    } catch {
      setOperationsSnapshot({ current_occupancy: 0, active_sessions: [], lab_breakdown: [] })
    }
  }

  useEffect(() => {
    const normalizedPath = normalizePath(currentPath)
    const matchedSection = getSectionIdFromPath(normalizedPath)
    const canAccessCurrentSection =
      activeSection === 'home' ||
      (activeSection === 'admin_reservas' && canManageStructure) ||
      (activeSection === 'tutorials_manage' && canManageTutorials) ||
      (activeSection === 'profiles' && canManageProfiles) ||
      (activeSection === 'roles' && canManageRoles) ||
      (activeSection === 'penalties' && canManagePenalties) ||
      (activeSection === 'areas' && canManageStructure) ||
      (activeSection === 'laboratorios' && canManageStructure) ||
      (activeSection === 'equipos' && canManageEquipos) ||
      (activeSection === 'materiales' && canManageMateriales) ||
      (activeSection === 'calendar' && !isAdmin) ||
      (activeSection === 'tutorials_public' && !isAdmin) ||
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
    canManageTutorials,
    currentPath,
    isAdmin,
    onNavigate,
  ])

  useEffect(() => {
    loadNotifications()
  }, [user?.user_id])

  useEffect(() => {
    loadOperationsSnapshot()
  }, [shouldTrackOperationsSnapshot])

  useEffect(() => {
    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === (user?.user_id || '') ||
          recipients.includes(user?.user_id || '') ||
          (canManageStructure && (
            event?.record?.recipient_user_id === OPERATIONS_RECIPIENT_ID ||
            recipients.includes(OPERATIONS_RECIPIENT_ID)
          ))

        if (isCurrentUserNotification) {
          loadNotifications()
        }
      }

      if (shouldTrackOperationsSnapshot && (event?.topic === 'lab_access' || event?.topic === 'lab_reservation')) {
        loadOperationsSnapshot()
      }
    })

    return () => unsubscribe?.()
  }, [canManageStructure, shouldTrackOperationsSnapshot, user?.user_id])

  const handleMarkNotificationAsRead = async (notificationId) => {
    const updatedNotification = await markReservationNotificationAsRead(notificationId)
    setNotifications((previous) =>
      previous.map((notification) => (notification.id === notificationId ? updatedNotification : notification)),
    )
    return updatedNotification
  }

  const handleMarkAllNotificationsAsRead = async () => {
    await markAllReservationNotificationsAsRead()
    setNotifications((previous) =>
      previous.map((notification) => ({ ...notification, is_read: true })),
    )
  }

  const handleNotificationClick = async (notification) => {
    if (!notification) {
      return
    }

    if (!notification.is_read) {
      try {
        await handleMarkNotificationAsRead(notification.id)
      } catch {
        // Ignore read-state failures here so the user can still reach the reservation.
      }
    }

    if (notification.reservation_id) {
      localStorage.setItem(FOCUSED_RESERVATION_KEY, notification.reservation_id)
      window.dispatchEvent(
        new CustomEvent(OPEN_RESERVATION_EVENT, {
          detail: { reservationId: notification.reservation_id },
        }),
      )
    }

    if (notification.tutorial_session_id) {
      localStorage.setItem(FOCUSED_TUTORIAL_KEY, notification.tutorial_session_id)
      window.dispatchEvent(
        new CustomEvent(OPEN_TUTORIAL_EVENT, {
          detail: { sessionId: notification.tutorial_session_id },
        }),
      )
    }

    onNavigate?.(notification.target_path || '/app/reservas/nueva')
  }

  return (
    <div className="app-layout">
      <Navbar
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activeSection={activeSection}
      />
      <main className="home-main">
        <header className="home-toolbar" aria-label="Barra superior">
          <div className="home-toolbar-copy">
            <strong>{user?.name || user?.username || 'Usuario'}</strong>
            <span>
              {unreadNotificationsCount > 0
                ? `Tienes ${unreadNotificationsCount} notificaciones pendientes`
                : 'No tienes notificaciones pendientes'}
            </span>
          </div>
          <div className="home-toolbar-actions">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadNotificationsCount}
              onNotificationClick={handleNotificationClick}
              onMarkAsRead={handleMarkNotificationAsRead}
              onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            />
          </div>
        </header>
        <section className="content-window" aria-label="Ventana principal">
          {canManageProfiles && activeSection === 'profiles' ? <AdminProfilesPage user={user} /> : null}
          {canManageRoles && activeSection === 'roles' ? <AdminRolesPage user={user} onSessionRefresh={onRefreshSession} /> : null}
          {canManagePenalties && activeSection === 'penalties' ? <AdminPenaltiesPage user={user} /> : null}
          {canManageStructure && activeSection === 'admin_reservas' ? <AdminReservationsPage user={user} /> : null}
          {canManageTutorials && activeSection === 'tutorials_manage' ? <TutorTutorialSessionsPage /> : null}
          {canManageStructure && activeSection === 'areas' ? <AdminAreasPage user={user} /> : null}
          {canManageStructure && activeSection === 'laboratorios' ? <AdminLaboratoriosPage user={user} /> : null}
          {canManageEquipos && activeSection === 'equipos' ? <AdminEquiposPage user={user} /> : null}
          {canManageMateriales && activeSection === 'materiales' ? <AdminMaterialesPage user={user} /> : null}
          {!isAdmin && activeSection === 'calendar' ? <UserAvailabilityCalendarPage user={user} /> : null}
          {!isAdmin && activeSection === 'tutorials_public' ? <StudentTutorialSessionsPage user={user} /> : null}
          {!isAdmin && activeSection === 'reserve' ? (
            <UserReserveLabPage
              user={user}
              notifications={notifications}
              onMarkNotificationAsRead={handleMarkNotificationAsRead}
            />
          ) : null}

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
                  {canManageStructure ? (
                    <div className="home-admin-overview">
                      <div className="home-admin-card-grid">
                        <article className="home-admin-card is-primary">
                          <span>Usuarios dentro</span>
                          <strong>{operationsSnapshot.current_occupancy}</strong>
                          <p>Contador operativo en tiempo real.</p>
                        </article>
                        <article className="home-admin-card">
                          <span>Sesiones activas</span>
                          <strong>{operationsSnapshot.active_sessions.length}</strong>
                          <p>Reservas en curso o walk-ins que siguen abiertos.</p>
                        </article>
                        <article className="home-admin-card">
                          <span>Laboratorios activos</span>
                          <strong>{operationsSnapshot.lab_breakdown.length}</strong>
                          <p>Espacios que registran uso fisico en este momento.</p>
                        </article>
                      </div>
                      {operationsSnapshot.lab_breakdown.length > 0 ? (
                        <div className="home-admin-badges">
                          {operationsSnapshot.lab_breakdown.map((entry) => (
                            <span key={entry.laboratory_id} className="home-admin-badge">
                              {entry.laboratory_id}: {entry.occupancy_count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="home-role-note">
                          No hay usuarios dentro del laboratorio en este momento. El contador se actualizara al registrar nuevas entradas y salidas.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <p className="home-placeholder-hint">
                    Usa la barra lateral para navegar entre <strong>Perfiles</strong>, <strong>Roles</strong>, <strong>Áreas</strong>, <strong>Laboratorios</strong>, <strong>Equipos</strong> y <strong>Materiales</strong>.
                  </p>
                </>
              ) : (
                <>
                  <div className="home-hero">
                    <img src={ucbEscudoLogo} alt="UCB Escudo" className="home-hero-logo" />
                    <div className="home-hero-meta">
                      <h2>Universidad Católica Boliviana San Pablo</h2>
                      <p>Desde 1966 formando profesionales comprometidos con la excelencia académica y la responsabilidad social.</p>
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
