import { useState } from 'react'
import {
  House,
  LogOut,
  Menu,
  MonitorCog,
  Users,
  UserRound,
  X,
} from 'lucide-react'
import { NAVIGATION_LINKS } from '../../config/navigationLinks'
import ucbLapazLogo from '../../../assets/branding/ucb-san-pablo-lapaz.png'
import './navbar.css'

function Navbar({ onLogout, onNavigate, activeSection = 'home' }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const iconMap = {
    home: House,
    roles: Users,
    assets: MonitorCog,
    profile: UserRound,
    logout: LogOut,
  }

  const handleToggleMenu = () => {
    setIsMenuOpen((previous) => !previous)
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    onLogout()
  }

  const handleNavigate = (section) => {
    setIsMenuOpen(false)

    if (onNavigate) {
      onNavigate(section)
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
          {NAVIGATION_LINKS.map((link) => {
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
              <button
                key={link.id}
                type="button"
                className={`nav-link ${activeSection === link.id ? 'is-active' : ''}`}
                onClick={() => handleNavigate(link.id)}
              >
                {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                {link.label}
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}

export default Navbar
