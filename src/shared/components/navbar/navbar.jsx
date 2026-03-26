import { useEffect, useRef, useState } from 'react'
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
  ChevronDown,
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
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const adminMenuRef = useRef(null)
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

  const adminLinks = visibleLinks.filter((link) => link.path?.startsWith('/app/admin/'))
  const primaryLinks = visibleLinks.filter(
    (link) => !link.action && !link.path?.startsWith('/app/admin/') && link.id !== 'profile',
  )
  const utilityLinks = visibleLinks.filter((link) => link.id === 'profile' || link.action === 'logout')
  const isAdminSectionActive = adminLinks.some((link) => link.id === activeSection)

  const handleToggleMenu = () => {
    setIsMenuOpen((previous) => !previous)
    setIsAdminMenuOpen(false)
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    setIsAdminMenuOpen(false)
    onLogout()
  }

  const handleNavigate = (path) => {
    setIsMenuOpen(false)
    setIsAdminMenuOpen(false)

    if (onNavigate) {
      onNavigate(path)
    }
  }

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setIsAdminMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsAdminMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <header className="navbar-shell">
      <button
        type="button"
        className={`nav-overlay ${isMenuOpen ? 'is-open' : ''}`}
        aria-label="Cerrar menu"
        onClick={() => setIsMenuOpen(false)}
      />
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
          <div className="nav-primary">
            <div className="nav-primary-links">
              {primaryLinks.map((link) => {
                const Icon = iconMap[link.icon]

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

            {adminLinks.length ? (
              <div className="nav-admin-menu" ref={adminMenuRef}>
                <button
                  type="button"
                  className={`nav-link nav-admin-trigger ${isAdminSectionActive ? 'is-active' : ''}`}
                  aria-expanded={isAdminMenuOpen}
                  onClick={() => setIsAdminMenuOpen((previous) => !previous)}
                >
                  <Users size={16} aria-hidden="true" />
                  Gestion
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`nav-admin-chevron ${isAdminMenuOpen ? 'is-open' : ''}`}
                  />
                </button>

                <div className={`nav-admin-dropdown ${isAdminMenuOpen ? 'is-open' : ''}`}>
                  <div className="nav-admin-dropdown-header">
                    <span className="nav-admin-eyebrow">Accesos operativos</span>
                    <strong>Panel de gestion</strong>
                  </div>
                  <div className="nav-admin-dropdown-grid">
                    {adminLinks.map((link) => {
                      const Icon = iconMap[link.icon]

                      return (
                        <a
                          key={link.id}
                          href={link.path}
                          className={`nav-admin-item ${activeSection === link.id ? 'is-active' : ''}`}
                          aria-current={activeSection === link.id ? 'page' : undefined}
                          onClick={(event) => {
                            event.preventDefault()
                            handleNavigate(link.path)
                          }}
                        >
                          <span className="nav-admin-item-icon">
                            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                          </span>
                          <span>{link.label}</span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="nav-secondary">
            {utilityLinks.map((link) => {
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
        </div>
      </nav>
    </header>
  )
}

export default Navbar
