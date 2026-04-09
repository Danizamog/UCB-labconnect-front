import { useState } from 'react'
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
  Users,
  UserRound,
  X,
} from 'lucide-react'
import { NAVIGATION_LINKS } from '../../config/navigationLinks'
import { hasAnyPermission } from '../../lib/permissions'
import ucbLapazLogo from '../../../assets/branding/ucb-san-pablo-lapaz.png'
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

function Navbar({ onLogout, onNavigate, activeSection = 'home', user }) {
  const [isOpen, setIsOpen] = useState(false)
  const isAdmin = user?.role === 'admin'
  const navPriority = {
    home: 0,
    admin_reservas: 1,
    reserve: 1,
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
      {/* Mobile top bar */}
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
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <img src={ucbShieldLogo} alt="Escudo UCB San Pablo La Paz" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="sidebar-kicker">UCB San Pablo · La Paz</span>
            <strong className="sidebar-title">LabConnect</strong>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => {
            const Icon = iconMap[link.icon]
            return (
              <a
                key={link.id}
                href={link.path}
                className={`sidebar-link ${activeSection === link.id ? 'sidebar-link--active' : ''}`}
                aria-current={activeSection === link.id ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); handleNavigate(link.path) }}
              >
                {Icon ? <Icon size={18} aria-hidden="true" /> : null}
                <span>{link.label}</span>
              </a>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {(user.name || user.username || '?')[0].toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name || user.username}</span>
                <span className="sidebar-user-role">{user.role || 'Usuario'}</span>
              </div>
            </div>
          )}
          {logoutLink && (
            <button type="button" className="sidebar-logout" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

export default Navbar
