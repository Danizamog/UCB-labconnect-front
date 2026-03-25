import { useState } from 'react'
import { LogIn, Mail, LockKeyhole } from 'lucide-react'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import './LoginView.css'

function LoginView({ onLogin }) {
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setCredentials((previous) => ({ ...previous, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const response = await onLogin(credentials)
    if (!response?.success) {
      setError(response?.message || 'No se pudo iniciar sesión')
    }
  }

  return (
    <main className="auth-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img
            className="login-brand-logo"
            src={ucbEscudoLogo}
            alt="Escudo Universidad Católica Boliviana San Pablo"
          />
          <div>
            <span className="login-brand-kicker">Universidad Católica Boliviana San Pablo</span>
            <h1>Acceso institucional</h1>
          </div>
        </div>

        <p className="login-subtitle">Ingresa para continuar a tu espacio de trabajo.</p>

        <label htmlFor="email">Correo</label>
        <div className="field-wrap">
          <Mail size={18} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            value={credentials.email}
            onChange={handleChange}
            placeholder="correo@ejemplo.com"
            required
          />
        </div>

        <label htmlFor="password">Contraseña</label>
        <div className="field-wrap">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="password"
            name="password"
            type="password"
            value={credentials.password}
            onChange={handleChange}
            placeholder="********"
            required
          />
        </div>

        <button type="submit">
          <LogIn size={18} aria-hidden="true" />
          Entrar
        </button>
        {error ? <p className="auth-error">{error}</p> : null}
      </form>
    </main>
  )
}

export default LoginView
