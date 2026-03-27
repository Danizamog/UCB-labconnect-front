import { useEffect, useRef, useState } from 'react'
import { Chrome, KeyRound, LockKeyhole, LogIn, Mail, Eye, EyeOff } from 'lucide-react'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import { getInstitutionalSSOConfig } from '../services/authService'
import './LoginView.css'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google)
      return
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Google')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('No se pudo cargar Google'))
    document.head.appendChild(script)
  })
}

function LoginView({ onLogin, onInstitutionalLogin }) {
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [loginMode, setLoginMode] = useState('institutional')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [institutionalError, setInstitutionalError] = useState('')
  const [institutionalReady, setInstitutionalReady] = useState(false)
  const [institutionalConfig, setInstitutionalConfig] = useState(null)
  const [institutionalConfigLoading, setInstitutionalConfigLoading] = useState(true)
  const googleButtonRef = useRef(null)

  const handleChange = (event) => {
    const { name, value } = event.target
    setCredentials((previous) => ({ ...previous, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const response = await onLogin(credentials)
    if (!response?.success) {
      setError(response?.message || 'No se pudo iniciar sesion')
    }
  }

  useEffect(() => {
    let isMounted = true

    getInstitutionalSSOConfig().then((response) => {
      if (!isMounted) {
        return
      }

      if (!response?.success) {
        setInstitutionalConfig({ enabled: false })
        setInstitutionalError(response?.message || 'No se pudo cargar el acceso institucional')
        setInstitutionalConfigLoading(false)
        return
      }

      setInstitutionalConfig(response.config || { enabled: false })
      setInstitutionalError('')
      setInstitutionalConfigLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    if (
      !institutionalConfig?.enabled ||
      institutionalConfig.provider !== 'google_oidc' ||
      !institutionalConfig.client_id ||
      !onInstitutionalLogin ||
      !googleButtonRef.current
    ) {
      return undefined
    }

    loadGoogleScript()
      .then(() => {
        if (isCancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
          return
        }

        window.google.accounts.id.initialize({
          client_id: institutionalConfig.client_id,
          callback: async (response) => {
            if (!response?.credential) {
              setInstitutionalError('El proveedor institucional no devolvio una credencial valida')
              return
            }

            setError('')
            setInstitutionalError('')

            const loginResponse = await onInstitutionalLogin(response.credential)
            if (!loginResponse?.success) {
              setInstitutionalError(loginResponse?.message || 'No se pudo iniciar sesion con la cuenta institucional')
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        googleButtonRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'signin_with',
          width: googleButtonRef.current.offsetWidth || 380,
        })

        setInstitutionalReady(true)
      })
      .catch(() => {
        if (!isCancelled) {
          setInstitutionalError('No se pudo cargar el acceso institucional')
        }
      })

    return () => {
      isCancelled = true
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
    }
  }, [institutionalConfig, onInstitutionalLogin])

  return (
    <main className="auth-screen">
      <section className="auth-hero" aria-label="Acceso al sistema">
        <div className="auth-hero-copy">
          <div className="auth-badge">UCB LabConnect</div>
          <h1>Laboratorios conectados, acceso simple y seguro.</h1>
          <p>
            Ingresa con tu cuenta institucional o usa tus credenciales para administrar reservas,
            inventario y operaciones de laboratorio desde cualquier dispositivo.
          </p>
        </div>

        <div className="login-card-shell">
          <div className="login-card">
            <div className="login-brand">
              <img
                className="login-brand-logo"
                src={ucbEscudoLogo}
                alt="Escudo Universidad Catolica Boliviana San Pablo"
              />
              <div>
                <span className="login-brand-kicker">Universidad Catolica Boliviana San Pablo</span>
                <h2>Iniciar sesion</h2>
              </div>
            </div>

            <div className="login-mode-tabs" role="tablist" aria-label="Tipo de acceso">
              <button
                type="button"
                className={`login-mode-tab ${loginMode === 'institutional' ? 'is-active' : ''}`}
                onClick={() => setLoginMode('institutional')}
                aria-pressed={loginMode === 'institutional'}
              >
                <Chrome size={18} aria-hidden="true" />
                Google
              </button>
              <button
                type="button"
                className={`login-mode-tab ${loginMode === 'credentials' ? 'is-active' : ''}`}
                onClick={() => setLoginMode('credentials')}
                aria-pressed={loginMode === 'credentials'}
              >
                <KeyRound size={18} aria-hidden="true" />
                Credenciales
              </button>
            </div>

            {loginMode === 'institutional' ? (
              <div className="login-panel">
                <div className="login-panel-copy">
                  <div className="login-panel-icon">
                    <Chrome size={34} aria-hidden="true" />
                  </div>
                  <h3>Acceso institucional</h3>
                  <p>
                    Utiliza tu cuenta oficial <strong>@ucb.edu.bo</strong> para ingresar de forma
                    segura a los servicios academicos.
                  </p>
                </div>

                <div className="google-login-block">
                  {institutionalConfigLoading ? (
                    <p className="google-helper">Cargando configuracion del acceso institucional...</p>
                  ) : institutionalConfig?.enabled && institutionalConfig.provider !== 'google_oidc' ? (
                    <p className="google-helper">
                      El proveedor institucional <strong>{institutionalConfig.provider}</strong> ya esta configurado en backend.
                      Esta interfaz aun no tiene renderizador visual para ese proveedor.
                    </p>
                  ) : institutionalConfig?.enabled ? (
                    <>
                      <div ref={googleButtonRef} className="google-button-host" />
                      {!institutionalReady ? (
                        <p className="google-helper">
                          Cargando {institutionalConfig?.button_label || 'acceso institucional'}...
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="google-helper">
                      El acceso por SSO institucional se configura desde backend.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <form className="login-panel login-form-panel" onSubmit={handleSubmit}>
                <p className="login-subtitle">
                  Ingresa con tu correo institucional y tu contrasena temporal o asignada.
                </p>

                <label htmlFor="email">Correo institucional</label>
                <div className="field-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={credentials.email}
                    onChange={handleChange}
                    placeholder="nombre@ucb.edu.bo"
                    required
                  />
                </div>

                <label htmlFor="password">Contrasena</label>
                <div className="field-wrap">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={handleChange}
                    placeholder="Ingresa tu contrasena"
                    required
                  />
                  <button
                    type="button"
                    className="field-toggle"
                    onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>

                <button type="submit" className="login-submit">
                  <LogIn size={18} aria-hidden="true" />
                  Entrar con credenciales
                </button>
              </form>
            )}

            {error ? <p className="auth-error">{error}</p> : null}
            {institutionalError ? <p className="auth-error">{institutionalError}</p> : null}
          </div>
        </div>
      </section>
    </main>
  )
}

export default LoginView
