import { useMemo, useState } from 'react'
import {
  AlertOctagon,
  BookOpenCheck,
  CalendarPlus,
  FlaskConical,
  House,
  Layers,
  LogOut,
  Menu,
  MonitorCog,
  Package,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { NAVIGATION_LINKS } from '../../config/navigationLinks'
import { hasAnyPermission } from '../../lib/permissions'
import ucbShieldLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import './navbar.css'

const iconMap = {
  home: House,
  admin_reservas: Users,
  profiles: UserRound,
  roles: Users,
  penalties: AlertOctagon,
  areas: Layers,
  laboratorios: FlaskConical,
  equipos: MonitorCog,
  materiales: Package,
  calendar: Layers,
  tutorials_manage: CalendarPlus,
  tutorials_public: BookOpenCheck,
  reserve: FlaskConical,
  logout: LogOut,
}

const NAV_GROUP_ORDER = ['Inicio', 'Reservas', 'Inventario', 'Personas']

const NAV_META = {
  home: { group: 'Inicio', aliases: ['inicio', 'panel', 'principal'], hint: 'Vista general' },
  admin_reservas: { group: 'Reservas', aliases: ['reservas', 'admin', 'laboratorio'], hint: 'Aprobar, entrar y salir' },
  tutorials_manage: { group: 'Reservas', aliases: ['tutorias', 'publicar', 'sesiones'], hint: 'Crear sesiones' },
  penalties: { group: 'Personas', aliases: ['penalizaciones', 'sanciones'], hint: 'Bloqueos activos' },
  areas: { group: 'Reservas', aliases: ['areas', 'bloques'], hint: 'Organizacion academica' },
  laboratorios: { group: 'Reservas', aliases: ['laboratorios', 'espacios'], hint: 'Salas y capacidad' },
  equipos: { group: 'Inventario', aliases: ['equipos', 'inventario', 'mantenimiento'], hint: 'Prestamos y estado' },
  materiales: { group: 'Inventario', aliases: ['materiales', 'reactivos', 'stock'], hint: 'Existencias' },
  profiles: { group: 'Personas', aliases: ['perfiles', 'usuarios', 'cuentas'], hint: 'Editar y reactivar' },
  roles: { group: 'Personas', aliases: ['roles', 'permisos', 'accesos'], hint: 'Permisos del sistema' },
  calendar: { group: 'Reservas', aliases: ['calendario', 'disponibilidad', 'horarios'], hint: 'Horarios libres' },
  tutorials_public: { group: 'Reservas', aliases: ['tutorias', 'inscripcion'], hint: 'Inscripciones' },
  reserve: { group: 'Reservas', aliases: ['reservar', 'laboratorio', 'nueva reserva'], hint: 'Crear solicitud' },
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
  const isAdmin = user?.role === 'admin'
  const navPriority = {
    home: 0,
    reserve: 1,
    admin_reservas: 1,
    calendar: 2,
    tutorials_public: 3,
    tutorials_manage: 3,
    equipos: 4,
    materiales: 5,
    laboratorios: 6,
    areas: 7,
    penalties: 8,
    profiles: 9,
    roles: 10,
  }

  const visibleLinks = NAVIGATION_LINKS.filter((link) => {
    if (link.requiredAnyPermission) return hasAnyPermission(user, link.requiredAnyPermission)
    if (link.userOnly) return !isAdmin
    return true
  })

  const navLinks = visibleLinks
    .filter((link) => !link.action)
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

  const primaryAction = isAdmin
    ? navLinks.find((link) => link.id === 'admin_reservas') || navLinks.find((link) => link.id !== 'home')
    : navLinks.find((link) => link.id === 'reserve') || navLinks.find((link) => link.id === 'calendar')

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
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <img src={ucbShieldLogo} alt="Escudo UCB San Pablo La Paz" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="sidebar-kicker">UCB San Pablo - La Paz</span>
            <strong className="sidebar-title">LabConnect</strong>
            <span className="sidebar-subtitle">Laboratorios y recursos</span>
          </div>
        </div>

        {primaryAction ? (
          <button type="button" className="sidebar-primary-action" onClick={() => handleNavigate(primaryAction.path)}>
            {(() => {
              const Icon = iconMap[primaryAction.icon]
              return Icon ? <Icon size={18} aria-hidden="true" /> : null
            })()}
            <span>{isAdmin ? 'Panel operativo' : 'Reservar ahora'}</span>
          </button>
        ) : null}

        <div className="sidebar-search-wrap">
          <label className="sidebar-search" htmlFor="sidebar-search-input">
            <Search size={15} aria-hidden="true" />
            <input
              id="sidebar-search-input"
              type="search"
              placeholder="Buscar accion..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          {normalizedQuery ? (
            <p className="sidebar-search-hint">
              {filteredNavLinks.length} resultado{filteredNavLinks.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          {groupedNavLinks.map((group) => (
            <div key={group.groupName} className="sidebar-group">
              <p className="sidebar-group-title">{group.groupName}</p>
              {group.links.map((link) => {
                const Icon = iconMap[link.icon]
                const hint = NAV_META[link.id]?.hint
                return (
                  <a
                    key={link.id}
                    href={link.path}
                    className={`sidebar-link ${activeSection === link.id ? 'sidebar-link--active' : ''}`}
                    aria-current={activeSection === link.id ? 'page' : undefined}
                    onClick={(event) => {
                      event.preventDefault()
                      handleNavigate(link.path)
                    }}
                  >
                    {Icon ? <Icon size={18} aria-hidden="true" /> : null}
                    <span>
                      <strong>{link.label}</strong>
                      {hint ? <small>{hint}</small> : null}
                    </span>
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
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {(user.name || user.username || '?')[0].toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name || user.username}</span>
                <span className="sidebar-user-role">{user.role || 'Usuario'}</span>
              </div>
            </div>
          ) : null}
          {logoutLink ? (
            <button type="button" className="sidebar-logout" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" />
              <span>Salir</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  )
}

export default Navbar
