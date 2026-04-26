import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Cpu,
  FlaskConical,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
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

const AdminLabAnalyticsPage = lazy(() => import('../../analytics/pages/AdminLabAnalyticsPage'))
const AdminAreasPage = lazy(() => import('../../admin/pages/AdminAreasPage'))
const AdminEquiposPage = lazy(() => import('../../admin/pages/AdminEquiposPage'))
const AdminLaboratoriosPage = lazy(() => import('../../admin/pages/AdminLaboratoriosPage'))
const AdminMaterialesPage = lazy(() => import('../../admin/pages/AdminMaterialesPage'))
const AdminProfilesPage = lazy(() => import('../../admin/pages/AdminProfilesPage'))
const AdminRolesPage = lazy(() => import('../../admin/pages/AdminRolesPage'))
const AdminPenaltiesPage = lazy(() => import('../../reservations/pages/AdminPenaltiesPage'))
const AdminReservationsPage = lazy(() => import('../../reservations/pages/AdminReservationsPage'))
const UserAvailabilityCalendarPage = lazy(() => import('../../reservations/pages/UserAvailabilityCalendarPage'))
const UserReserveLabPage = lazy(() => import('../../reservations/pages/UserReserveLabPage'))
const StudentTutorialSessionsPage = lazy(() => import('../../tutorials/pages/StudentTutorialSessionsPage'))
const TutorTutorialSessionsPage = lazy(() => import('../../tutorials/pages/TutorTutorialSessionsPage'))

const FOCUSED_RESERVATION_KEY = 'labconnect.focus_reservation_id'
const OPEN_RESERVATION_EVENT = 'labconnect:open-reservation-details'
const FOCUSED_TUTORIAL_KEY = 'labconnect.focus_tutorial_session_id'
const OPEN_TUTORIAL_EVENT = 'labconnect:open-tutorial-session'
const OPERATIONS_RECIPIENT_ID = '__operations__'

function HomeView({ user, currentPath, currentHash, onNavigate, onRefreshSession, onLogout }) {
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
  const canViewPenalties = Boolean(user?.user_id)
  const canManageEquipos = hasAnyPermission(user, ['gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageMateriales = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])
  const canManageTutorials = hasAnyPermission(user, ['gestionar_tutorias'])
  const hasManagementModules =
    canManageRoles || canManageProfiles || canManageStructure || canManagePenalties || canManageEquipos || canManageMateriales || canManageTutorials
  const activeSection = getSectionIdFromPath(currentPath) || 'home'
  const shouldTrackOperationsSnapshot = canManageStructure && activeSection === 'home'
  const unreadNotificationsCount = notifications.filter((notification) => !notification.is_read).length

  const loadNotifications = useCallback(async (options = {}) => {
    try {
      const notificationsData = await listReservationNotifications(options)
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

  useEffect(() => {
    const normalizedPath = normalizePath(currentPath)
    const matchedSection = getSectionIdFromPath(normalizedPath)
    const canAccessCurrentSection =
      activeSection === 'home' ||
      (activeSection === 'admin_reservas' && canManageStructure) ||
      (activeSection === 'analytics' && canManageStructure) ||
      (activeSection === 'tutorials_manage' && canManageTutorials) ||
      (activeSection === 'profiles' && canManageProfiles) ||
      (activeSection === 'roles' && canManageRoles) ||
      (activeSection === 'penalties' && canViewPenalties) ||
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
    canViewPenalties,
    canManageProfiles,
    canManageRoles,
    canManageStructure,
    canManageTutorials,
    currentPath,
    isAdmin,
    onNavigate,
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadNotifications()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadNotifications, user?.user_id])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOperationsSnapshot()
    }, 0)
    return () => window.clearTimeout(timer)
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
          loadNotifications({ skipCache: true })
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

  const adminActionCards = [
    canManageStructure ? {
      title: 'Gestionar reservas',
      text: 'Aprobar solicitudes, registrar ingresos y revisar ocupacion.',
      icon: CalendarDays,
      path: '/app/admin/reservas',
    } : null,
    canManageEquipos ? {
      title: 'Revisar equipos',
      text: 'Ver inventario, prestamos y mantenimiento pendiente.',
      icon: Cpu,
      path: '/app/admin/equipos',
    } : null,
    canManageMateriales ? {
      title: 'Controlar materiales',
      text: 'Actualizar stock y movimientos de laboratorio.',
      icon: FlaskConical,
      path: '/app/admin/materiales',
    } : null,
    canManageProfiles ? {
      title: 'Administrar usuarios',
      text: 'Editar perfiles, activar cuentas y verificar bloqueos.',
      icon: ShieldCheck,
      path: '/app/admin/perfiles',
    } : null,
  ].filter(Boolean)

  const studentActionCards = [
    {
      title: 'Reservar laboratorio',
      text: 'Elige fecha, laboratorio y horario disponible.',
      icon: FlaskConical,
      path: '/app/reservas/nueva',
      primary: true,
    },
    {
      title: 'Ver disponibilidad',
      text: 'Consulta el calendario antes de pedir un espacio.',
      icon: CalendarDays,
      path: '/app/reservas/calendario',
    },
    {
      title: 'Buscar tutorias',
      text: 'Encuentra sesiones publicadas por docentes.',
      icon: BookOpen,
      path: '/app/tutorias',
    },
  ]

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
          <Suspense fallback={<div className="module-loading">Cargando modulo...</div>}>
          {canManageProfiles && activeSection === 'profiles' ? <AdminProfilesPage user={user} /> : null}
          {canManageRoles && activeSection === 'roles' ? <AdminRolesPage user={user} onSessionRefresh={onRefreshSession} /> : null}
          {canViewPenalties && activeSection === 'penalties' ? <AdminPenaltiesPage user={user} /> : null}
          {canManageStructure && activeSection === 'admin_reservas' ? (
            <AdminReservationsPage user={user} currentHash={currentHash} onNavigate={onNavigate} />
          ) : null}
          {canManageStructure && activeSection === 'analytics' ? <AdminLabAnalyticsPage user={user} /> : null}
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
            <section className="home-dashboard" aria-label="Panel de inicio">
              <div className="home-showcase">
                <section className="home-modern-hero">
                  <div className="home-modern-hero-copy">
                    <div className="home-modern-brand">
                      <img src={ucbEscudoLogo} alt="UCB Escudo" />
                      <div>
                        <span>UCB San Pablo - La Paz</span>
                        <strong>LabConnect</strong>
                      </div>
                    </div>
                    <p className="home-modern-kicker">{isAdmin ? 'Panel operativo' : 'Portal academico'}</p>
                    <h1>{isAdmin ? 'Opera laboratorios con una ruta clara.' : 'Reserva tu laboratorio en pocos pasos.'}</h1>
                    <p className="home-modern-tagline">
                      {isAdmin
                        ? 'Tus tareas principales aparecen primero: ocupacion, solicitudes, inventario y usuarios.'
                        : 'Consulta disponibilidad, crea una reserva y revisa alertas desde una pantalla clara.'}
                    </p>
                    <div className="home-modern-actions">
                      <button
                        type="button"
                        className="home-modern-primary"
                        onClick={() => onNavigate?.(isAdmin ? '/app/admin/reservas' : '/app/reservas/nueva')}
                      >
                        {isAdmin ? 'Abrir reservas' : 'Nueva reserva'} <ArrowRight size={18} />
                      </button>
                      <button
                        type="button"
                        className="home-modern-secondary"
                        onClick={() => onNavigate?.(isAdmin ? '/app/admin/equipos' : '/app/reservas/calendario')}
                      >
                        {isAdmin ? 'Ver inventario' : 'Ver calendario'}
                      </button>
                    </div>
                  </div>

                  <div className="home-modern-hero-panel" aria-label="Resumen rapido">
                    <article>
                      <CalendarDays size={24} />
                      <span>{isAdmin ? 'Usuarios dentro' : 'Reservas'}</span>
                      <strong>{isAdmin ? operationsSnapshot.current_occupancy : 'Por bloques'}</strong>
                      <p>{isAdmin ? 'Ocupacion actual de laboratorios.' : 'Elige laboratorio, fecha y hora.'}</p>
                    </article>
                    <article>
                      <ShieldCheck size={24} />
                      <span>Alertas</span>
                      <strong>{unreadNotificationsCount}</strong>
                      <p>Notificaciones pendientes en tu cuenta.</p>
                    </article>
                    <article>
                      <BookOpen size={24} />
                      <span>{isAdmin ? 'Sesiones' : 'Tutorias'}</span>
                      <strong>{isAdmin ? operationsSnapshot.active_sessions.length : 'Disponibles'}</strong>
                      <p>{isAdmin ? 'Actividades en curso.' : 'Apoyo academico publicado.'}</p>
                    </article>
                  </div>
                </section>

                <section className="home-modern-section">
                  <div className="home-modern-section-head">
                    <p className="home-modern-kicker">Empieza aqui</p>
                    <h2>{isAdmin ? 'Acciones frecuentes para operar el laboratorio.' : 'Tres opciones claras para avanzar.'}</h2>
                  </div>
                  <div className="home-action-grid">
                    {(isAdmin ? adminActionCards : studentActionCards).map((action) => {
                      const Icon = action.icon
                      return (
                        <button
                          key={action.title}
                          type="button"
                          className={`home-action-card ${action.primary ? 'is-primary' : ''}`}
                          onClick={() => onNavigate?.(action.path)}
                        >
                          <span><Icon size={24} /></span>
                          <strong>{action.title}</strong>
                          <small>{action.text}</small>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="home-status-strip">
                  <article>
                    <Wrench size={20} />
                    <div>
                      <strong>Sistema conectado por roles</strong>
                      <span>Solo ves las opciones permitidas para tu cuenta.</span>
                    </div>
                  </article>
                  {hasManagementModules ? (
                    <article>
                      <Settings size={20} />
                      <div>
                        <strong>Permisos de gestion activos</strong>
                        <span>La barra lateral muestra tus modulos administrativos disponibles.</span>
                      </div>
                    </article>
                  ) : null}
                </section>
              </div>
            </section>
          ) : null}
          </Suspense>
        </section>
      </main>
    </div>
  )
}

export default HomeView
