import { useState } from 'react'
import { LogIn, Mail, LockKeyhole, ShieldCheck } from 'lucide-react'
import './LoginView.css'

function LoginView({ onLogin }) {
  const [credentials, setCredentials] = useState({ email: '', password: '' })

  const handleChange = (event) => {
    const { name, value } = event.target
    setCredentials((previous) => ({ ...previous, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onLogin(credentials)
  }

  return (
    <main className="auth-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="login-brand-icon" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="login-brand-kicker">Universidad Católica Boliviana</span>
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
      </form>
    </main>
  )
}

export default LoginView
