import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Cpu,
  FlaskConical,
  GraduationCap,
  Microscope,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
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
import {
  APP_ROOT_PATH,
  getSectionIdFromPath,
  normalizePath,
} from '../../../shared/config/navigationLinks'
import { consumeStoredAuthWarning } from '../../auth/services/authService'
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

function HomeView({ user, currentPath, currentHash, onNavigate, onRefreshSession, onLogout }) {
  const [notifications, setNotifications] = useState([])
  const [authWarning, setAuthWarning] = useState(() => consumeStoredAuthWarning())
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
        {authWarning ? (
          <section className="home-auth-warning" aria-label="Penalizacion activa">
            <strong>Acceso con restricciones</strong>
            <p>{authWarning}</p>
            <button type="button" onClick={() => setAuthWarning('')}>
              Entendido
            </button>
          </section>
        ) : null}
        <section className="content-window" aria-label="Ventana principal">
          {canManageProfiles && activeSection === 'profiles' ? <AdminProfilesPage user={user} /> : null}
          {canManageRoles && activeSection === 'roles' ? <AdminRolesPage user={user} onSessionRefresh={onRefreshSession} /> : null}
          {canManagePenalties && activeSection === 'penalties' ? <AdminPenaltiesPage user={user} /> : null}
          {canManageStructure && activeSection === 'admin_reservas' ? (
            <AdminReservationsPage user={user} currentHash={currentHash} onNavigate={onNavigate} />
          ) : null}
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
                              <FlaskConical size={13} aria-hidden="true" />
                              {entry.laboratory_id}
                              <strong>{entry.occupancy_count}</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="home-role-note home-empty-note">
                          Sin usuarios activos en laboratorios ahora mismo. El contador se actualiza en tiempo real al registrar entradas y salidas.
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
                        <p className="home-modern-kicker">Gestion academica de laboratorios</p>
                        <h1>Reserva, aprende y usa laboratorios con claridad.</h1>
                        <p className="home-modern-tagline">
                          Una experiencia institucional para consultar disponibilidad, reservar espacios,
                          revisar tutorias y estar al dia con tus notificaciones academicas.
                        </p>
                        <div className="home-modern-actions">
                          <button type="button" className="home-modern-primary" onClick={() => onNavigate?.('/app/reservas/nueva')}>
                            Nueva reserva <ArrowRight size={18} />
                          </button>
                          <button type="button" className="home-modern-secondary" onClick={() => onNavigate?.('/app/reservas/calendario')}>
                            Ver calendario
                          </button>
                        </div>
                      </div>

                      <div className="home-modern-hero-panel" aria-label="Resumen de accesos principales">
                        <article>
                          <CalendarDays size={24} />
                          <span>Reservas</span>
                          <strong>Por bloques</strong>
                          <p>Elige laboratorio, fecha y horario disponible.</p>
                        </article>
                        <article>
                          <BookOpen size={24} />
                          <span>Tutorias</span>
                          <strong>Apoyo academico</strong>
                          <p>Encuentra sesiones publicadas por docentes.</p>
                        </article>
                        <article>
                          <ShieldCheck size={24} />
                          <span>Alertas</span>
                          <strong>{unreadNotificationsCount}</strong>
                          <p>Notificaciones pendientes en tu cuenta.</p>
                        </article>
                      </div>
                    </section>

                    <section className="home-modern-section">
                      <div className="home-modern-section-head">
                        <p className="home-modern-kicker">Que es LabConnect</p>
                        <h2>Todo lo que necesitas antes de entrar al laboratorio.</h2>
                      </div>
                      <div className="home-feature-grid">
                        <article className="home-feature-card">
                          <span><FlaskConical size={28} /></span>
                          <h3>Reserva de laboratorios</h3>
                          <p>Solicita espacios para practicas y proyectos con disponibilidad visible.</p>
                        </article>
                        <article className="home-feature-card">
                          <span><Cpu size={28} /></span>
                          <h3>Inventario academico</h3>
                          <p>Consulta equipos, materiales y recursos asociados a tus practicas.</p>
                        </article>
                        <article className="home-feature-card">
                          <span><ShieldCheck size={28} /></span>
                          <h3>Control seguro</h3>
                          <p>Seguimiento de accesos, estados y reglas para cuidar los espacios.</p>
                        </article>
                        <article className="home-feature-card">
                          <span><Wrench size={28} /></span>
                          <h3>Trazabilidad</h3>
                          <p>Prestamos, mantenimiento y reportes quedan registrados para auditoria.</p>
                        </article>
                      </div>
                    </section>

                    <section className="home-modern-section">
                      <div className="home-modern-section-head">
                        <p className="home-modern-kicker">Nuestros laboratorios</p>
                        <h2>Espacios modernos y organizados por area academica.</h2>
                      </div>
                      <div className="home-modern-labs">
                        <article>
                          <span><Microscope size={24} /></span>
                          <h3>Ciencias</h3>
                          <p>Fisica, Quimica y Biologia</p>
                        </article>
                        <article>
                          <span><Cpu size={24} /></span>
                          <h3>Ingenieria</h3>
                          <p>Sistemas, Mecanica y Electronica</p>
                        </article>
                        <article>
                          <span><Building2 size={24} /></span>
                          <h3>Administracion</h3>
                          <p>Sistemas de informacion, negocios y simulacion</p>
                        </article>
                      </div>
                    </section>

                    <section className="home-role-panel">
                      <div>
                        <p className="home-modern-kicker">Gestion por rol</p>
                        <h2>Tu panel esta adaptado a tu perfil.</h2>
                        <p>
                          Accede rapido a las acciones principales segun seas estudiante, docente o usuario con permisos de gestion.
                        </p>
                      </div>
                      <div className="home-role-grid">
                        <button type="button" onClick={() => onNavigate?.('/app/reservas/calendario')}>
                          <GraduationCap size={22} />
                          <strong>Estudiante</strong>
                          <span>Ver disponibilidad y tutorias.</span>
                        </button>
                        <button type="button" onClick={() => onNavigate?.('/app/reservas/nueva')}>
                          <CalendarDays size={22} />
                          <strong>Docente</strong>
                          <span>Planificar practicas y reservas.</span>
                        </button>
                        <button type="button" onClick={() => onNavigate?.('/app/tutorias')}>
                          <Settings size={22} />
                          <strong>Soporte academico</strong>
                          <span>Revisar tutorias publicadas.</span>
                        </button>
                      </div>
                    </section>

                    {hasManagementModules ? (
                      <p className="home-role-note home-role-note-modern">
                        Tu rol actual tambien incluye accesos de gestion. Usa la barra lateral para entrar a los modulos habilitados segun tus permisos.
                      </p>
                    ) : null}
                  </div>

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
