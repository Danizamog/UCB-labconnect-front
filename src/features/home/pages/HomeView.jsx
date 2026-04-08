import { useCallback, useEffect, useState } from 'react'
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
import UserReserveSuppliesPage from '../../reservations/pages/UserReserveSuppliesPage'
import StudentTutorialSessionsPage from '../../tutorials/pages/StudentTutorialSessionsPage'
import TutorTutorialSessionsPage from '../../tutorials/pages/TutorTutorialSessionsPage'
import Navbar from '../../../shared/components/navbar/navbar'
import NotificationBell from '../../../shared/components/NotificationBell'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
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

  const loadNotifications = useCallback(async () => {
    try {
      const notificationsData = await listReservationNotifications()
      setNotifications(notificationsData)
    } catch {
      setNotifications([])
    }
  }, [])

  const loadOperationsSnapshot = useCallback(async () => {
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
  }, [shouldTrackOperationsSnapshot])

  const institutionalLinks = [
    {
      title: 'Portal UCB',
      description: 'Sitio institucional con información oficial de la universidad.',
      href: 'https://www.ucb.edu.bo',
      label: 'ucb.edu.bo',
    },
    {
      title: 'SIAAN',
      description: 'Acceso al sistema académico nacional para gestiones estudiantiles.',
      href: 'https://academico.ucb.edu.bo/AcademicoNacional/inicio',
      label: 'academico.ucb.edu.bo',
    },
    {
      title: 'LMS UCB',
      description: 'Ingreso al campus virtual para clases, recursos y seguimiento académico.',
      href: 'https://lms.ucb.edu.bo/my/',
      label: 'lms.ucb.edu.bo',
    },
    {
      title: 'Contacto UCB',
      description: 'Canales de comunicación y referencia institucional.',
      href: 'https://www.ucb.edu.bo/contacto',
      label: 'ucb.edu.bo/contacto',
    },
  ]

  const quickAccessCards = isAdmin
    ? [
        {
          title: 'Gestionar roles',
          description: 'Configura permisos y accesos del sistema.',
          action: () => onNavigate?.('/roles'),
        },
        {
          title: 'Gestionar estructura',
          description: 'Administra reservas, áreas y laboratorios.',
          action: () => onNavigate?.('/admin_reservas'),
        },
        {
          title: 'Gestionar inventario',
          description: 'Revisa equipos, materiales y mantenimiento.',
          action: () => onNavigate?.('/equipos'),
        },
      ]
    : [
        {
          title: 'Reservar laboratorio',
          description: 'Consulta espacios disponibles y solicita una reserva.',
          action: () => onNavigate?.('/reserve'),
        },
        {
          title: 'Mi calendario',
          description: 'Revisa tus reservas activas y próximas actividades.',
          action: () => onNavigate?.('/calendar'),
        },
        {
          title: 'LMS y SIAAN',
          description: 'Accede a las plataformas académicas de la UCB.',
          action: () => window.open('https://lms.ucb.edu.bo/my/', '_blank', 'noopener,noreferrer'),
        },
      ]

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
      (activeSection === 'reserve_reactivos' && !isAdmin) ||
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
    const loadInitialNotifications = async () => {
      await loadNotifications()
    }

    loadInitialNotifications()
  }, [loadNotifications, user?.user_id])

  useEffect(() => {
    const loadInitialOperationsSnapshot = async () => {
      await loadOperationsSnapshot()
    }

    loadInitialOperationsSnapshot()
  }, [loadOperationsSnapshot])

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
  }, [canManageStructure, loadNotifications, loadOperationsSnapshot, shouldTrackOperationsSnapshot, user?.user_id])

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
          {!isAdmin && activeSection === 'reserve_reactivos' ? <UserReserveSuppliesPage user={user} /> : null}
          {!isAdmin && activeSection === 'tutorials_public' ? <StudentTutorialSessionsPage user={user} /> : null}
          {!isAdmin && activeSection === 'reserve' ? (
            <UserReserveLabPage
              user={user}
              notifications={notifications}
              onMarkNotificationAsRead={handleMarkNotificationAsRead}
            />
          ) : null}

          {activeSection === 'home' ? (
            <section className="home-dashboard" aria-label="Panel de inicio">
              {isAdmin ? (
                <div className="home-admin-hero">
                  <div className="home-brand-logos" aria-hidden="true">
                    <img src={ucbEscudoLogo} alt="" className="home-brand-logo home-brand-logo-primary" />
                    <img src={ucbLapazLogo} alt="" className="home-brand-logo home-brand-logo-secondary" />
                  </div>
                  <div className="home-hero-copy">
                    <p className="home-eyebrow">Universidad Católica Boliviana San Pablo</p>
                    <h2>LabConnect</h2>
                    <p className="home-hero-text">
                      Centro de control para la gestión institucional de laboratorios, reservas, inventario y perfiles de acceso.
                    </p>
                    <div className="home-meta-row">
                      <span>Administración centralizada</span>
                      <span>Acceso por permisos</span>
                      <span>Experiencia UCB</span>
                    </div>
                  </div>
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
                </div>
              ) : (
                <div className="home-hero">
                  <div className="home-brand-column">
                    <a href="https://www.ucb.edu.bo" target="_blank" rel="noopener noreferrer" className="home-brand-lockup">
                      <img src={ucbEscudoLogo} alt="Escudo de la Universidad Católica Boliviana San Pablo" className="home-hero-logo" />
                      <img src={ucbLapazLogo} alt="Sede La Paz de la Universidad Católica Boliviana San Pablo" className="home-hero-logo home-hero-logo-alt" />
                    </a>
                    <div className="home-brand-badges">
                      <span>UCB San Pablo</span>
                      <span>Servicios académicos e institucionales</span>
                    </div>
                  </div>
                  <div className="home-hero-meta">
                    <p className="home-eyebrow">Portal académico y de servicios</p>
                    <h2>Un acceso único a la vida universitaria de la UCB</h2>
                    <p>
                      Consulta recursos institucionales, plataformas académicas y servicios de laboratorio desde una portada coherente con la identidad de la UCB.
                    </p>
                    <a href="https://www.ucb.edu.bo" target="_blank" rel="noopener noreferrer" className="home-hero-btn">
                      Visitar sitio oficial
                    </a>
                  </div>
                </div>
              )}

              <div className="home-section">
                <h3 className="home-section-title">Accesos institucionales</h3>
                <p className="home-section-text">
                  Todo lo necesario para la actividad académica y administrativa de la UCB en un solo lugar.
                </p>
                <div className="home-links-grid">
                  {institutionalLinks.map((link) => (
                    <a key={link.title} href={link.href} target="_blank" rel="noopener noreferrer" className="home-link-card">
                      <span className="home-link-label">{link.label}</span>
                      <strong>{link.title}</strong>
                      <p>{link.description}</p>
                    </a>
                  ))}
                </div>
              </div>

              <div className="home-section">
                <h3 className="home-section-title">Qué resuelve LabConnect</h3>
                <div className="home-labs-grid">
                  <div className="home-lab-card">
                    <strong>Reservas académicas</strong>
                    <p>Gestión de laboratorios para prácticas, clases y proyectos.</p>
                  </div>
                  <div className="home-lab-card">
                    <strong>Inventario y materiales</strong>
                    <p>Control de equipos, stock y recursos disponibles.</p>
                  </div>
                  <div className="home-lab-card">
                    <strong>Accesos y perfiles</strong>
                    <p>Permisos organizados por rol para mantener orden y seguridad.</p>
                  </div>
                </div>
              </div>

              <div className="home-section">
                <h3 className="home-section-title">Acceso rápido</h3>
                <div className="home-quick-actions">
                  {quickAccessCards.map((card) => (
                    <button key={card.title} type="button" className="home-action-btn" onClick={card.action}>
                      <div className="action-content">
                        <strong>{card.title}</strong>
                        <p>{card.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="home-section">
                <h3 className="home-section-title">UCB en un vistazo</h3>
                <div className="home-spotlight-grid">
                  <div className="home-spotlight-card">
                    <span className="home-spotlight-label">Sede</span>
                    <strong>La Paz</strong>
                    <p>Identidad visual y acceso institucional de la Universidad Católica Boliviana San Pablo.</p>
                  </div>
                  <div className="home-spotlight-card">
                    <span className="home-spotlight-label">Plataforma</span>
                    <strong>SIAAN</strong>
                    <p>Ingreso directo a los trámites y consultas académicas del sistema nacional.</p>
                  </div>
                  <div className="home-spotlight-card">
                    <span className="home-spotlight-label">Campus virtual</span>
                    <strong>LMS UCB</strong>
                    <p>Acceso al entorno de aprendizaje y seguimiento de asignaturas.</p>
                  </div>
                </div>
              </div>

              {hasManagementModules ? (
                <div className="home-section home-role-section">
                  <h3 className="home-section-title">Accesos de gestión</h3>
                  <p className="home-role-note">
                    Tu rol actual también incluye funciones de administración. Las opciones habilitadas en la barra lateral están disponibles según tus permisos.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default HomeView