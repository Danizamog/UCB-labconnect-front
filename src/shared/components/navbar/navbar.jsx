import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertOctagon,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  House,
  History,
  Layers,
  LogOut,
  Menu,
  MonitorCog,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { NAVIGATION_LINKS } from '../../config/navigationLinks'
import { hasAnyPermission, hasRole } from '../../lib/permissions'
import ucbShieldLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import './navbar.css'

const iconMap = {
  home: House,
  admin_reservas: ClipboardCheck,
  analytics: BarChart3,
  ia_predicciones: Sparkles,
  profiles: Users,
  roles: ShieldCheck,
  penalties: AlertOctagon,
  areas: Layers,
  laboratorios: FlaskConical,
  horarios_laboratorios: CalendarClock,
  equipos: MonitorCog,
  materiales: Package,
  calendar: CalendarDays,
  tutorials_manage: CalendarPlus,
  mis_clases: BookOpenCheck,
  tutorials_public: BookOpenCheck,
  history: History,
  reserve: FlaskConical,
  account: UserRound,
  security: ShieldCheck,
  logout: LogOut,
}

const NAV_GROUP_ORDER = ['Inicio', 'Académico', 'Laboratorios', 'Inventario', 'Administración']

const NAV_META = {
  home: { group: 'Inicio', aliases: ['inicio', 'panel', 'principal'], hint: 'Vista general' },
  admin_reservas: { group: 'Laboratorios', aliases: ['reservas', 'admin', 'laboratorio'], hint: 'Solicitudes, aprobaciones y accesos' },
  analytics: { group: 'Laboratorios', aliases: ['analisis', 'estadisticas', 'ocupacion', 'uso laboratorios'], hint: 'Uso y demanda' },
  ia_predicciones: { group: 'Laboratorios', aliases: ['prediccion', 'predicciones', 'ia', 'pronostico', 'desabastecimiento', 'demanda futura'], hint: 'Pronósticos y tendencias' },
  tutorials_manage: { group: 'Académico', aliases: ['tutorias', 'publicar', 'sesiones'], hint: 'Publicar y gestionar tutorías' },
  mis_clases: { group: 'Académico', aliases: ['clases', 'docente', 'materiales clase', 'equipos clase', 'recursos'], hint: 'Clases, horarios y recursos' },
  penalties: { group: 'Administración', aliases: ['penalizaciones', 'sanciones'], hint: 'Bloqueos activos' },
  areas: { group: 'Laboratorios', aliases: ['areas', 'bloques'], hint: 'Organización académica' },
  laboratorios: { group: 'Laboratorios', aliases: ['laboratorios', 'espacios'], hint: 'Salas y capacidad' },
  horarios_laboratorios: { group: 'Laboratorios', aliases: ['horarios', 'clases', 'asignaturas'], hint: 'Clases recurrentes' },
  equipos: { group: 'Inventario', aliases: ['equipos', 'inventario', 'mantenimiento'], hint: 'Prestamos y estado' },
  materiales: { group: 'Inventario', aliases: ['materiales', 'reactivos', 'stock'], hint: 'Existencias' },
  profiles: { group: 'Administración', aliases: ['perfiles', 'usuarios', 'cuentas'], hint: 'Usuarios y expedientes' },
  roles: { group: 'Administración', aliases: ['roles', 'permisos', 'accesos'], hint: 'Roles y matriz de accesos' },
  calendar: { group: 'Laboratorios', aliases: ['calendario', 'disponibilidad', 'horarios'], hint: 'Horarios libres' },
  tutorials_public: { group: 'Académico', aliases: ['tutorias', 'inscripcion'], hint: 'Inscripciones' },
  tutorials_history: { group: 'Académico', aliases: ['historial tutorias', 'tutorias atendidas', 'sesiones atendidas'], hint: 'Sesiones finalizadas' },
  history: { group: 'Laboratorios', aliases: ['historial', 'pasadas', 'actividad'], hint: 'Reservas pasadas' },
  reserve: { group: 'Laboratorios', aliases: ['reservar', 'laboratorio', 'nueva reserva'], hint: 'Crear solicitud' },
  account: { group: 'Administración', aliases: ['cuenta', 'perfil', 'contrasena'], hint: 'Datos y seguridad' },
  security: { group: 'Administración', aliases: ['seguridad', 'auditoria', 'rbac'], hint: 'Auditoría y revisión de accesos' },
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function Navbar({ onLogout, onNavigate, activeSection = 'home', user }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const toggleRef = useRef(null)
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    if (window.matchMedia('(max-width: 860px)').matches) document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => { if (event.key === 'Escape') { setIsOpen(false); toggleRef.current?.focus() } }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])
  const navPriority = {
    home: 0,
    reserve: 1,
    admin_reservas: 1,
    analytics: 2,
    ia_predicciones: 2.5,
    calendar: 2,
    tutorials_public: 3,
    tutorials_history: 4,
    history: 5,
    tutorials_manage: 3,
    mis_clases: 1.5,
    equipos: 6,
    materiales: 7,
    laboratorios: 8,
    horarios_laboratorios: 8.5,
    areas: 9,
    penalties: 10,
    profiles: 11,
    roles: 12,
    account: 13,
    security: 14,
  }

  const visibleLinks = NAVIGATION_LINKS.filter((link) => {
    if (link.requiredAnyPermission) return hasAnyPermission(user, link.requiredAnyPermission)
    if (link.allowedRoles) return hasRole(user, link.allowedRoles)
    return true
  })

  const navLinks = visibleLinks
    .filter((link) => !link.action && link.id !== 'account')
    .sort((a, b) => (navPriority[a.id] ?? 99) - (navPriority[b.id] ?? 99) || a.label.localeCompare(b.label))
  const logoutLink = visibleLinks.find((link) => link.action === 'logout') || null
  const normalizedQuery = normalizeSearchText(searchQuery)

  const filteredNavLinks = useMemo(() => {
    if (!normalizedQuery) return navLinks

    return navLinks.filter((link) => {
      const aliases = NAV_META[link.id]?.aliases || []
      const searchableText = [link.label, link.id, link.path, ...aliases]
        .map((value) => normalizeSearchText(value))
        .join(' ')
      return searchableText.includes(normalizedQuery)
    })
  }, [navLinks, normalizedQuery])

  const groupedNavLinks = useMemo(() => {
    const groups = NAV_GROUP_ORDER.map((groupName) => ({ groupName, links: [] }))
    const fallbackGroup = { groupName: 'Otros', links: [] }

    filteredNavLinks.forEach((link) => {
      const currentGroup = NAV_META[link.id]?.group || 'Otros'
      const targetGroup = groups.find((group) => group.groupName === currentGroup) || fallbackGroup
      targetGroup.links.push(link)
    })

    if (fallbackGroup.links.length > 0) groups.push(fallbackGroup)
    return groups.filter((group) => group.links.length > 0)
  }, [filteredNavLinks])

  const primarySection = hasAnyPermission(user, ['modificar_usuarios', 'reiniciar_credenciales']) ? 'profiles'
    : hasAnyPermission(user, ['gestionar_clases_propias']) ? 'mis_clases'
      : hasAnyPermission(user, ['gestionar_reservas']) ? 'admin_reservas'
        : hasAnyPermission(user, ['consultar_auditoria_seguridad']) ? 'security' : 'reserve'
  const primaryAction = navLinks.find((link) => link.id === primarySection)

  const handleNavigate = (path) => {
    setIsOpen(false)
    onNavigate?.(path)
  }

  const handleLogout = () => {
    setIsOpen(false)
    onLogout()
  }

  return (
    <>
      <div className="sidebar-topbar">
        <div className="sidebar-brand-mobile">
          <img src={ucbShieldLogo} alt="Escudo UCB San Pablo La Paz" className="sidebar-logo" />
          <div className="sidebar-brand-mobile-text">
            <span className="sidebar-brand-mobile-kicker">UCB San Pablo</span>
            <strong className="sidebar-brand-mobile-title">LabConnect</strong>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          ref={toggleRef}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={isOpen}
          aria-controls="main-sidebar"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      <aside id="main-sidebar" className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <img src={ucbShieldLogo} alt="Escudo UCB San Pablo La Paz" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="sidebar-kicker">UCB San Pablo - La Paz</span>
            <strong className="sidebar-title">LabConnect</strong>
            <span className="sidebar-subtitle">Laboratorios y recursos</span>
          </div>
        </div>

        <div className="sidebar-workspace"><span className="sidebar-workspace-dot" /><span>{user?.role || 'Espacio personal'}</span></div>

        {primaryAction ? (
          <button type="button" className="sidebar-primary-action" onClick={() => handleNavigate(primaryAction.path)}>
            {(() => {
              const Icon = iconMap[primaryAction.icon]
              return Icon ? <Icon size={18} aria-hidden="true" /> : null
            })()}
            <span>{primaryAction.label}</span><ChevronRight size={15} className="sidebar-action-arrow" />
          </button>
        ) : null}

        <div className="sidebar-search-wrap">
          <label className="sidebar-search" htmlFor="sidebar-search-input">
            <Search size={15} aria-hidden="true" />
            <input
              id="sidebar-search-input"
              type="search"
              placeholder="Buscar en el menú…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery ? <button type="button" className="sidebar-search-clear" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda"><X size={14} /></button> : null}
          </label>
          {normalizedQuery ? (
            <p className="sidebar-search-hint">
              {filteredNavLinks.length} resultado{filteredNavLinks.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {groupedNavLinks.map((group) => (
            <div key={group.groupName} className="sidebar-group">
              <p className="sidebar-group-title">{group.groupName}<span aria-hidden="true">{group.links.length}</span></p>
              {group.links.map((link) => {
                const Icon = iconMap[link.icon]
                const hint = NAV_META[link.id]?.hint
                return (
                  <a
                    key={link.id}
                    href={link.path}
                    className={`sidebar-link ${activeSection === link.id ? 'sidebar-link--active' : ''}`}
                    aria-current={activeSection === link.id ? 'page' : undefined}
                    title={hint}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      handleNavigate(link.path)
                    }}
                  >
                    {Icon ? <Icon size={18} aria-hidden="true" /> : null}
                    <span>
                      <strong>{link.label}</strong>
                      {hint ? <small>{hint}</small> : null}
                    </span>
                    {activeSection === link.id ? <ChevronRight className="sidebar-link-arrow" size={15} aria-hidden="true" /> : null}
                  </a>
                )
              })}
            </div>
          ))}
          {groupedNavLinks.length === 0 ? (
            <p className="sidebar-empty-results">No se encontraron coincidencias para "{searchQuery}".</p>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <button type="button" className="sidebar-user" onClick={() => handleNavigate('/app/mi-cuenta')}>
              <div className="sidebar-user-avatar">
                {(user.name || user.username || '?')[0].toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name || user.username}</span>
                <span className="sidebar-user-role">Mi cuenta y contraseña</span>
              </div>
              <ChevronRight size={16} className="sidebar-user-arrow" />
            </button>
          ) : null}
          {logoutLink ? (
            <button type="button" className="sidebar-logout" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  )
}

export default Navbar
