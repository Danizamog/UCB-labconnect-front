import { useState } from 'react'
import {
  BellRing,
  CalendarDays,
  CalendarCheck2,
  CalendarClock,
  ClipboardList,
  House,
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
import './navbar.css'

function Navbar({ onLogout, onNavigate, activeSection = 'home', user }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isAdmin = user?.role === 'admin'

  const iconMap = {
    home: House,
    reserve: CalendarClock,
    calendar: CalendarDays,
    requests: ClipboardList,
    reservations: CalendarCheck2,
    notifications: BellRing,
    profiles: UserRound,
    roles: Users,
    sessions: CalendarClock,
    assets: MonitorCog,
    loans: Package,
    profile: UserRound,
    logout: LogOut,
  }

  const visibleLinks = NAVIGATION_LINKS.filter((link) => {
    if (link.requiredAnyPermission) return hasAnyPermission(user, link.requiredAnyPermission)
    if (link.userOnly) return !isAdmin
    return true
  })

  const handleToggleMenu = () => {
    setIsMenuOpen((previous) => !previous)
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    onLogout()
  }

  const handleNavigate = (path) => {
    setIsMenuOpen(false)

    if (onNavigate) {
      onNavigate(path)
    }
  }

  return (
    <header className="navbar-shell">
      <nav className="navbar">
        <div className="brand-wrap">
          <img
            className="brand-logo"
            src={ucbLapazLogo}
            alt="Universidad Católica Boliviana San Pablo Sede La Paz"
          />
          <div className="brand">
            <span className="brand-kicker">UCB San Pablo · La Paz</span>
            <strong>LabConnect</strong>
          </div>
        </div>

        <button
          type="button"
          className="nav-toggle"
          onClick={handleToggleMenu}
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className={`nav-links ${isMenuOpen ? 'is-open' : ''}`}>
          {visibleLinks.map((link) => {
            const Icon = iconMap[link.icon]

            if (link.action === 'logout') {
              return (
                <button
                  key={link.id}
                  type="button"
                  className="nav-action"
                  onClick={handleLogout}
                >
                  {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                  {link.label}
                </button>
              )
            }

            return (
              <a
                key={link.id}
                href={link.path}
                className={`nav-link ${activeSection === link.id ? 'is-active' : ''}`}
                aria-current={activeSection === link.id ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  handleNavigate(link.path)
                }}
              >
                {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                {link.label}
              </a>
            )
          })}
        </div>
      </nav>
    </header>
  )
}

export default Navbar
