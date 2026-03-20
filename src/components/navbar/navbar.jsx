import { useState } from 'react'
import {
  House,
  LogOut,
  Menu,
  Shield,
  UserRound,
  X,
} from 'lucide-react'
import { NAVIGATION_LINKS } from '../../utils/navigationLinks'
import './navbar.css'

function Navbar({ onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const iconMap = {
    home: House,
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

  const handleNavigate = () => {
    setIsMenuOpen(false)
  }

  return (
    <header className="navbar-shell">
      <nav className="navbar">
        <div className="brand-wrap">
          <div className="brand-icon" aria-hidden="true">
            <Shield size={18} />
          </div>
          <div className="brand">
            <span className="brand-kicker">UCB</span>
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
              <a key={link.id} href={link.href} onClick={handleNavigate}>
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
