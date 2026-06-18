import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Cpu,
  FlaskConical,
  GraduationCap,
  Microscope,
  Clock3,
  MapPin,
  Search,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import Navbar from '../../../shared/components/navbar/navbar'
import NotificationBell from '../../../shared/components/NotificationBell'
import ScrollToTopButton from '../../../shared/components/ScrollToTopButton'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import {
  APP_ROOT_PATH,
  getSectionIdFromPath,
  normalizePath,
} from '../../../shared/config/navigationLinks'
import { hasAnyPermission, isAdminUser } from '../../../shared/lib/permissions'
import {
  getOccupancyDashboard,
  getMyAgendaSummary,
  listReservationNotifications,
  listAvailableLabs,
  markAllReservationNotificationsAsRead,
  markReservationNotificationAsRead,
  subscribeReservationsRealtime,
} from '../../reservations/services/reservationsService'
import { listAdminLabs } from '../../admin/services/infrastructureService'
import './HomeView.css'
import { formatLocalDateTime, formatStatus, parseLocalDateTime } from '../../../shared/utils/formatters'

const AdminLabAnalyticsPage = lazy(() => import('../../analytics/pages/AdminLabAnalyticsPage'))
const AdminPredictionsPage = lazy(() => import('../../analytics/pages/AdminPredictionsPage'))
const AdminAreasPage = lazy(() => import('../../admin/pages/AdminAreasPage'))
const AdminEquiposPage = lazy(() => import('../../admin/pages/AdminEquiposPage'))
const AdminLaboratoriosPage = lazy(() => import('../../admin/pages/AdminLaboratoriosPage'))
const AdminLabSchedulesPage = lazy(() => import('../../admin/pages/AdminLabSchedulesPage'))
const AdminMaterialesPage = lazy(() => import('../../admin/pages/AdminMaterialesPage'))
const AdminProfilesPage = lazy(() => import('../../admin/pages/AdminProfilesPage'))
const AdminRolesPage = lazy(() => import('../../admin/pages/AdminRolesPage'))
const AdminPenaltiesPage = lazy(() => import('../../reservations/pages/AdminPenaltiesPage'))
const AdminReservationsPage = lazy(() => import('../../reservations/pages/AdminReservationsPage'))
const UserAvailabilityCalendarPage = lazy(() => import('../../reservations/pages/UserAvailabilityCalendarPage'))
const UserReserveLabPage = lazy(() => import('../../reservations/pages/UserReserveLabPage'))
const StudentTutorialSessionsPage = lazy(() => import('../../tutorials/pages/StudentTutorialSessionsPage'))
const TutorTutorialSessionsPage = lazy(() => import('../../tutorials/pages/TutorTutorialSessionsPage'))
const UserHistoryPage = lazy(() => import('../../reservations/pages/UserHistoryPage'))
const UserTutorialAttendanceHistoryPage = lazy(() => import('../../tutorials/pages/UserTutorialAttendanceHistoryPage'))

const FOCUSED_RESERVATION_KEY = 'labconnect.focus_reservation_id'
const OPEN_RESERVATION_EVENT = 'labconnect:open-reservation-details'
const FOCUSED_TUTORIAL_KEY = 'labconnect.focus_tutorial_session_id'
const OPEN_TUTORIAL_EVENT = 'labconnect:open-tutorial-session'
const OPERATIONS_RECIPIENT_ID = '__operations__'
const HOME_LAB_DEFAULT_LIMIT = 6
const HOME_LAB_SEARCH_LIMIT = 24
const HOME_LAB_SEARCH_DEBOUNCE_MS = 200
const SCROLL_TO_TOP_SECTIONS = new Set(['admin_reservas', 'analytics', 'tutorials_manage', 'equipos', 'materiales', 'penalties'])
const EMPTY_AGENDA_SUMMARY = {
  generated_at: '',
  reservation_count: 0,
  tutorial_count: 0,
  total_count: 0,
  upcoming_reservations: [],
  upcoming_tutorials: [],
}

function normalizeLabSearchValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
}

function formatAgendaTimeRange(startAt, endAt) {
  if (!startAt || !endAt) {
    return 'Horario por confirmar'
  }

  try {
    const timeFormatter = new Intl.DateTimeFormat('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const start = parseLocalDateTime(startAt)
    const end = parseLocalDateTime(endAt)
    if (!start || !end) {
      return `${startAt} - ${endAt}`
    }
    return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`
  } catch {
    return `${startAt} - ${endAt}`
  }
}

function buildAgendaItems(summary) {
  const reservationItems = Array.isArray(summary?.upcoming_reservations)
    ? summary.upcoming_reservations.map((reservation) => ({
      kind: 'reservation',
      id: reservation.id,
      title: reservation.purpose || 'Reserva de laboratorio',
      subtitle: reservation.laboratory_name || reservation.laboratory_id || 'Laboratorio',
      location: reservation.laboratory_name || reservation.laboratory_id || 'Sin laboratorio',
      start_at: reservation.start_at,
      end_at: reservation.end_at,
      status: formatStatus(reservation.status),
      details: reservation.requested_by_name || 'Reserva propia',
    }))
    : []

  const tutorialItems = Array.isArray(summary?.upcoming_tutorials)
    ? summary.upcoming_tutorials.map((tutorial) => ({
      kind: 'tutorial',
      id: tutorial.id,
      title: tutorial.topic || 'Tutoria',
      subtitle: tutorial.tutor_name || 'Tutor',
      location: tutorial.location || tutorial.laboratory_id || 'Sin ubicacion',
      start_at: tutorial.start_at,
      end_at: tutorial.end_at,
      status: tutorial.is_published ? 'Publicada' : 'Borrador',
      details: tutorial.enrolled_count > 0
        ? `${tutorial.enrolled_count} inscrito${tutorial.enrolled_count === 1 ? '' : 's'}`
        : 'Sin inscritos',
    }))
    : []

  return [...reservationItems, ...tutorialItems]
    .sort((left, right) => {
      const leftTime = Date.parse(left.start_at || '') || 0
      const rightTime = Date.parse(right.start_at || '') || 0
      if (leftTime === rightTime) {
        return String(left.id || '').localeCompare(String(right.id || ''))
      }
      return leftTime - rightTime
    })
}

function HomeView({ user, currentPath, currentHash, onNavigate, onRefreshSession, onLogout }) {
  const contentWindowRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [agendaSummary, setAgendaSummary] = useState(EMPTY_AGENDA_SUMMARY)
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [homeLabs, setHomeLabs] = useState([])
  const [homeLabsLoading, setHomeLabsLoading] = useState(false)
  const [homeLabsError, setHomeLabsError] = useState('')
  const [homeLabSearch, setHomeLabSearch] = useState('')
  const [debouncedHomeLabSearch, setDebouncedHomeLabSearch] = useState('')
  const [operationsSnapshot, setOperationsSnapshot] = useState({
    current_occupancy: 0,
    active_sessions: [],
    lab_breakdown: [],
  })
  const isAdmin = isAdminUser(user)
  const canManageRoles = hasAnyPermission(user, ['gestionar_roles_permisos'])
  const canManageProfiles = hasAnyPermission(user, ['gestionar_roles_permisos', 'reactivar_cuentas'])
  const canManageStructure = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])
  const canViewAnalytics = hasAnyPermission(user, ['consultar_estadisticas'])
  const canManageSpaces = hasAnyPermission(user, ['gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])
  const canManagePenalties = hasAnyPermission(user, ['gestionar_penalizaciones'])
  const canViewPenalties = canManagePenalties
  const canManageEquipos = hasAnyPermission(user, ['gestionar_inventario', 'gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageMateriales = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos', 'gestionar_reservas_materiales'])
  const canManageTutorials = hasAnyPermission(user, ['gestionar_tutorias'])
  const hasManagementModules =
    canManageRoles || canManageProfiles || canManageStructure || canManagePenalties || canManageEquipos || canManageMateriales || canManageTutorials
  const activeSection = getSectionIdFromPath(currentPath) || 'home'
  const showScrollToTopButton = SCROLL_TO_TOP_SECTIONS.has(activeSection)
  const shouldTrackAgenda = !isAdmin && activeSection === 'home'
  const shouldTrackOperationsSnapshot = canManageStructure && activeSection === 'home'
  const unreadNotificationsCount = notifications.filter((notification) => !notification.is_read).length
  const agendaItems = buildAgendaItems(agendaSummary).slice(0, 6)
  const normalizedHomeLabSearch = useMemo(() => normalizeLabSearchValue(debouncedHomeLabSearch), [debouncedHomeLabSearch])
  const sortedHomeLabs = useMemo(() => {
    return [...homeLabs].sort((left, right) =>
      String(left?.name || '').localeCompare(String(right?.name || ''), 'es', { sensitivity: 'base' }),
    )
  }, [homeLabs])
  const filteredHomeLabs = useMemo(() => {
    if (!normalizedHomeLabSearch) {
      return sortedHomeLabs
    }
    return sortedHomeLabs.filter((lab) =>
      normalizeLabSearchValue(lab?.name).includes(normalizedHomeLabSearch),
    )
  }, [sortedHomeLabs, normalizedHomeLabSearch])
  const visibleHomeLabs = normalizedHomeLabSearch
    ? filteredHomeLabs.slice(0, HOME_LAB_SEARCH_LIMIT)
    : filteredHomeLabs.slice(0, HOME_LAB_DEFAULT_LIMIT)
  const hasMoreHomeLabs = filteredHomeLabs.length > visibleHomeLabs.length

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

  const loadHomeLabs = useCallback(async () => {
    if (activeSection !== 'home') {
      setHomeLabs([])
      setHomeLabsError('')
      setHomeLabsLoading(false)
      return
    }

    setHomeLabsLoading(true)
    try {
      const labsData = canManageSpaces ? await listAdminLabs() : await listAvailableLabs(user)
      setHomeLabs(Array.isArray(labsData) ? labsData : [])
      setHomeLabsError('')
    } catch (err) {
      setHomeLabs([])
      setHomeLabsError(err.message || 'No se pudieron cargar los laboratorios.')
    } finally {
      setHomeLabsLoading(false)
    }
  }, [activeSection, canManageSpaces, user])

  const loadAgendaSummary = useCallback(async (options = {}) => {
    if (!shouldTrackAgenda) {
      setAgendaSummary(EMPTY_AGENDA_SUMMARY)
      setAgendaLoading(false)
      return
    }

    setAgendaLoading(true)
    try {
      const summary = await getMyAgendaSummary({ limit: 6, skipCache: options.skipCache })
      setAgendaSummary({
        ...EMPTY_AGENDA_SUMMARY,
        ...summary,
      })
    } catch {
      setAgendaSummary(EMPTY_AGENDA_SUMMARY)
    } finally {
      setAgendaLoading(false)
    }
  }, [shouldTrackAgenda])

  useEffect(() => {
    const normalizedPath = normalizePath(currentPath)
    const matchedSection = getSectionIdFromPath(normalizedPath)
    const canAccessCurrentSection =
      activeSection === 'home' ||
      (activeSection === 'admin_reservas' && canManageStructure) ||
      (activeSection === 'analytics' && canViewAnalytics) ||
      (activeSection === 'ia_predicciones' && canViewAnalytics) ||
      (activeSection === 'tutorials_manage' && canManageTutorials) ||
      (activeSection === 'profiles' && canManageProfiles) ||
      (activeSection === 'roles' && canManageRoles) ||
      (activeSection === 'penalties' && canViewPenalties) ||
      (activeSection === 'areas' && canManageSpaces) ||
      (activeSection === 'laboratorios' && canManageSpaces) ||
      (activeSection === 'horarios_laboratorios' && canManageSpaces) ||
      (activeSection === 'equipos' && canManageEquipos) ||
      (activeSection === 'materiales' && canManageMateriales) ||
      (!isAdmin && activeSection === 'calendar') ||
      (!isAdmin && activeSection === 'tutorials_public') ||
      (!isAdmin && activeSection === 'tutorials_history') ||
      (!isAdmin && activeSection === 'history') ||
      (!isAdmin && activeSection === 'reserve')

    const isUnknownApplicationRoute =
      normalizedPath !== APP_ROOT_PATH &&
      normalizedPath !== '/' &&
      !matchedSection

    if (!canAccessCurrentSection || isUnknownApplicationRoute) {
      onNavigate?.(APP_ROOT_PATH, { replace: true })
    }
  }, [
    activeSection,
    isAdmin,
    canManageEquipos,
    canManageMateriales,
    canManagePenalties,
    canViewPenalties,
    canManageProfiles,
    canManageRoles,
    canManageSpaces,
    canManageStructure,
    canManageTutorials,
    canViewAnalytics,
    currentPath,
    isAdmin,
    onNavigate,
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedHomeLabSearch(homeLabSearch)
    }, HOME_LAB_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [homeLabSearch])

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
    const timer = window.setTimeout(() => {
      loadHomeLabs()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadHomeLabs, user?.user_id])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAgendaSummary()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAgendaSummary, user?.user_id])

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

      if (shouldTrackAgenda && (event?.topic === 'lab_reservation' || event?.topic === 'tutorial_session')) {
        loadAgendaSummary({ skipCache: true })
      }

      if (shouldTrackOperationsSnapshot && (event?.topic === 'lab_access' || event?.topic === 'lab_reservation')) {
        loadOperationsSnapshot()
      }
    })

    return () => unsubscribe?.()
  }, [canManageStructure, loadAgendaSummary, loadNotifications, loadOperationsSnapshot, shouldTrackAgenda, shouldTrackOperationsSnapshot, user?.user_id])

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
      text: 'Elige fecha, laboratorio y horario disponible. Tambien puedes pedir reactivos en el mismo flujo.',
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
        <section ref={contentWindowRef} className="content-window" aria-label="Ventana principal">
          <Suspense fallback={<div className="module-loading">Cargando modulo...</div>}>
          {canManageProfiles && activeSection === 'profiles' ? <AdminProfilesPage user={user} /> : null}
          {canManageRoles && activeSection === 'roles' ? <AdminRolesPage user={user} onSessionRefresh={onRefreshSession} /> : null}
          {canViewPenalties && activeSection === 'penalties' ? <AdminPenaltiesPage user={user} /> : null}
          {canManageStructure && activeSection === 'admin_reservas' ? (
            <AdminReservationsPage user={user} currentHash={currentHash} onNavigate={onNavigate} />
          ) : null}
          {canViewAnalytics && activeSection === 'analytics' ? <AdminLabAnalyticsPage user={user} /> : null}
          {canViewAnalytics && activeSection === 'ia_predicciones' ? <AdminPredictionsPage user={user} /> : null}
          {canManageTutorials && activeSection === 'tutorials_manage' ? <TutorTutorialSessionsPage /> : null}
          {canManageSpaces && activeSection === 'areas' ? <AdminAreasPage user={user} /> : null}
          {canManageSpaces && activeSection === 'laboratorios' ? <AdminLaboratoriosPage user={user} /> : null}
          {canManageSpaces && activeSection === 'horarios_laboratorios' ? <AdminLabSchedulesPage user={user} /> : null}
          {canManageEquipos && activeSection === 'equipos' ? <AdminEquiposPage user={user} /> : null}
          {canManageMateriales && activeSection === 'materiales' ? <AdminMaterialesPage user={user} /> : null}
          {!isAdmin && activeSection === 'calendar' ? <UserAvailabilityCalendarPage user={user} /> : null}
          {!isAdmin && activeSection === 'tutorials_public' ? <StudentTutorialSessionsPage user={user} /> : null}
          {!isAdmin && activeSection === 'tutorials_history' ? <UserTutorialAttendanceHistoryPage user={user} /> : null}
          {!isAdmin && activeSection === 'history' ? <UserHistoryPage user={user} /> : null}
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
                {!isAdmin ? (
                  <section className="home-agenda-panel" aria-label="Resumen de agenda">
                    <div className="home-agenda-head">
                      <div className="home-agenda-copy">
                        <p className="home-modern-kicker">Mi agenda</p>
                        <h2>Tus próximas reservas y tutorías</h2>
                        <p>
                          Organiza tu tiempo con un resumen directo de lo que viene en los próximos días.
                        </p>
                      </div>
                      <div className="home-agenda-stats" aria-label="Indicadores de agenda">
                        <article>
                          <span>Reservas</span>
                          <strong>{agendaSummary.reservation_count}</strong>
                          <p>Compromisos por iniciar o en curso.</p>
                        </article>
                        <article>
                          <span>Tutorías</span>
                          <strong>{agendaSummary.tutorial_count}</strong>
                          <p>Sesiones que siguen vigentes para ti.</p>
                        </article>
                        <article>
                          <span>Total</span>
                          <strong>{agendaSummary.total_count}</strong>
                          <p>Resumen de tus próximos movimientos.</p>
                        </article>
                      </div>
                    </div>

                    {agendaLoading ? (
                      <p className="home-role-note home-empty-note home-agenda-empty-note">
                        Cargando tu agenda...
                      </p>
                    ) : agendaItems.length > 0 ? (
                      <div className="home-agenda-list">
                        {agendaItems.map((item) => (
                          <article key={`${item.kind}-${item.id}`} className={`home-agenda-item is-${item.kind}`}>
                            <div className="home-agenda-item-top">
                              <span className="home-agenda-pill">{item.kind === 'reservation' ? 'Reserva' : 'Tutoria'}</span>
                              <span className="home-agenda-status">{item.status}</span>
                            </div>
                            <strong>{item.title}</strong>
                            <p>{item.subtitle}</p>
                            <div className="home-agenda-meta">
                              <span>
                                <Clock3 size={14} aria-hidden="true" />
                                {formatLocalDateTime(item.start_at)}
                              </span>
                              <span>
                                <MapPin size={14} aria-hidden="true" />
                                {item.location}
                              </span>
                            </div>
                            <div className="home-agenda-foot">
                              <span>{formatAgendaTimeRange(item.start_at, item.end_at)}</span>
                              <span>{item.details}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="home-role-note home-empty-note home-agenda-empty-note">
                        No tienes reservas ni tutorías próximas por ahora.
                      </p>
                    )}

                    <div className="home-agenda-actions">
                      <button type="button" className="home-modern-primary" onClick={() => onNavigate?.('/app/reservas/calendario')}>
                        Ver calendario <ArrowRight size={18} />
                      </button>
                      <button type="button" className="home-modern-secondary" onClick={() => onNavigate?.('/app/tutorias')}>
                        Ir a tutorías
                      </button>
                    </div>
                  </section>
                ) : null}

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
                      <span>{isAdmin ? 'Usuarios dentro' : 'Reservas próximas'}</span>
                      <strong>{isAdmin ? operationsSnapshot.current_occupancy : agendaSummary.reservation_count}</strong>
                      <p>{isAdmin ? 'Ocupacion actual de laboratorios.' : 'Reservas activas en tu agenda.'}</p>
                    </article>
                    <article>
                      <ShieldCheck size={24} />
                      <span>Alertas</span>
                      <strong>{unreadNotificationsCount}</strong>
                      <p>Notificaciones pendientes en tu cuenta.</p>
                    </article>
                    <article>
                      <BookOpen size={24} />
                      <span>{isAdmin ? 'Sesiones' : 'Tutorías próximas'}</span>
                      <strong>{isAdmin ? operationsSnapshot.active_sessions.length : agendaSummary.tutorial_count}</strong>
                      <p>{isAdmin ? 'Actividades en curso.' : 'Sesiones vigentes para ti.'}</p>
                    </article>
                  </div>
                </section>

                <section className="home-modern-section home-lab-search-section" aria-label="Buscar laboratorios">
                  <div className="home-modern-section-head home-lab-search-head">
                    <div>
                      <p className="home-modern-kicker">Laboratorios</p>
                      <h2>Encuentra rapido el laboratorio que necesitas.</h2>
                    </div>
                    <label className="home-lab-search-field">
                      <Search size={18} aria-hidden="true" />
                      <input
                        type="search"
                        placeholder="Buscar laboratorio por nombre"
                        aria-label="Buscar laboratorio por nombre"
                        value={homeLabSearch}
                        onChange={(event) => setHomeLabSearch(event.target.value)}
                      />
                    </label>
                  </div>

                  {homeLabsLoading ? (
                    <p className="home-lab-empty">Cargando laboratorios...</p>
                  ) : homeLabsError ? (
                    <p className="home-lab-empty">{homeLabsError}</p>
                  ) : visibleHomeLabs.length === 0 ? (
                    <p className="home-lab-empty">No se encontraron laboratorios</p>
                  ) : (
                    <>
                      <div className="home-lab-result-grid" aria-live="polite">
                        {visibleHomeLabs.map((lab) => (
                          <button
                            key={lab.id}
                            type="button"
                            className="home-lab-result-card"
                            onClick={() => onNavigate?.(isAdmin ? '/app/admin/laboratorios' : '/app/reservas/nueva')}
                          >
                            <span className="home-lab-result-icon">
                              <FlaskConical size={20} aria-hidden="true" />
                            </span>
                            <span className="home-lab-result-copy">
                              <strong>{lab.name || 'Laboratorio sin nombre'}</strong>
                              <small>
                                {lab.location || lab.area_name || lab.area || 'Ubicacion por definir'}
                                {lab.capacity ? ` · ${lab.capacity} personas` : ''}
                              </small>
                            </span>
                            <ArrowRight size={16} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                      {hasMoreHomeLabs ? (
                        <p className="home-lab-empty">
                          {normalizedHomeLabSearch
                            ? 'Mostrando los primeros resultados. Refina tu búsqueda para encontrar otro laboratorio.'
                            : 'Mostrando los más relevantes. Usa el buscador para encontrar otros laboratorios.'}
                        </p>
                      ) : null}
                    </>
                  )}
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
        <ScrollToTopButton scrollContainerRef={contentWindowRef} enabled={showScrollToTopButton} />
      </main>
    </div>
  )
}

export default HomeView
