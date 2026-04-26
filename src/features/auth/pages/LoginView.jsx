import { useEffect, useMemo, useRef, useState } from 'react'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import { getInstitutionalSSOConfig } from '../services/authService'
import './LoginView.css'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const GOOGLE_PROVIDERS = new Set(['google_oidc', 'google'])
const ALLOW_GOOGLE_ON_LOCALHOST = String(import.meta.env.VITE_ENABLE_GOOGLE_ON_LOCALHOST || '').trim().toLowerCase() === 'true'

const MIN_USERNAME_LENGTH = 3
const MIN_PASSWORD_LENGTH = 6

function isLocalOrigin() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

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
  const [activeMode, setActiveMode] = useState('google')
  const [institutionalError, setInstitutionalError] = useState('')
  const [credentialsError, setCredentialsError] = useState('')
  const [credentialsSubmitting, setCredentialsSubmitting] = useState(false)
  const [institutionalReady, setInstitutionalReady] = useState(false)
  const [institutionalConfig, setInstitutionalConfig] = useState(null)
  const [institutionalConfigLoading, setInstitutionalConfigLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState({ username: false, password: false })
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const googleButtonRef = useRef(null)
  const institutionalLoginRef = useRef(onInstitutionalLogin)
  const initializedGoogleClientIdRef = useRef('')
  const showLocalGoogleHint = isLocalOrigin() && !ALLOW_GOOGLE_ON_LOCALHOST

  useEffect(() => {
    institutionalLoginRef.current = onInstitutionalLogin
  }, [onInstitutionalLogin])

  useEffect(() => {
    let isMounted = true

    getInstitutionalSSOConfig().then((response) => {
      if (!isMounted) return

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

    if (activeMode !== 'google') return undefined
    if (
      !institutionalConfig?.enabled ||
      !GOOGLE_PROVIDERS.has(institutionalConfig.provider) ||
      !institutionalConfig.client_id ||
      !googleButtonRef.current
    ) return undefined

    loadGoogleScript()
      .then(() => {
        if (isCancelled || !window.google?.accounts?.id || !googleButtonRef.current) return

        if (initializedGoogleClientIdRef.current !== institutionalConfig.client_id) {
          window.google.accounts.id.initialize({
            client_id: institutionalConfig.client_id,
            callback: async (response) => {
              if (!response?.credential) {
                setInstitutionalError('El proveedor institucional no devolvio una credencial valida')
                return
              }

              setInstitutionalError('')
              const loginResponse = await institutionalLoginRef.current?.(response.credential)
              if (!loginResponse?.success) {
                setInstitutionalError(loginResponse?.message || 'No se pudo iniciar sesion con la cuenta institucional')
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          })
          initializedGoogleClientIdRef.current = institutionalConfig.client_id
        }

        googleButtonRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'signin_with',
          width: googleButtonRef.current.offsetWidth || 360,
        })
        setInstitutionalReady(true)
      })
      .catch(() => {
        if (!isCancelled) setInstitutionalError('No se pudo cargar el acceso institucional')
      })

    return () => {
      isCancelled = true
      if (window.google?.accounts?.id) window.google.accounts.id.cancel()
    }
  }, [activeMode, institutionalConfig])

  const credentialsTabEnabled = useMemo(() => typeof onLogin === 'function', [onLogin])
  const usernameValid = credentials.username.trim().length >= MIN_USERNAME_LENGTH
  const passwordValid = credentials.password.length >= MIN_PASSWORD_LENGTH
  const formValid = usernameValid && passwordValid

  const getUsernameHint = () => {
    if (!touched.username || credentials.username.trim() === '') return null
    if (!usernameValid) return { text: `Minimo ${MIN_USERNAME_LENGTH} caracteres`, type: 'error' }
    return { text: 'Correcto', type: 'ok' }
  }

  const getPasswordHint = () => {
    if (!touched.password || credentials.password === '') return null
    if (!passwordValid) return { text: `Minimo ${MIN_PASSWORD_LENGTH} caracteres`, type: 'error' }
    return { text: 'Contrasena valida', type: 'ok' }
  }

  const handleCredentialsSubmit = async (event) => {
    event.preventDefault()
    if (!onLogin) return

    setTouched({ username: true, password: true })
    if (!formValid) {
      setCredentialsError('Completa usuario y contrasena correctamente.')
      return
    }

    setCredentialsError('')
    setCredentialsSubmitting(true)
    try {
      const response = await onLogin({
        email: credentials.username.trim(),
        password: credentials.password,
      })
      if (!response?.success) {
        setCredentialsError(response?.message || 'No se pudo iniciar sesion con credenciales')
      }
    } finally {
      setCredentialsSubmitting(false)
    }
  }

  const usernameHint = getUsernameHint()
  const passwordHint = getPasswordHint()

  return (
    <main className="auth-screen">
      <section className="login-shell" role="main" aria-label="Inicio de sesion">
        <aside className="login-intro" aria-label="Resumen de LabConnect">
          <div className="login-intro-brand">
            <img src={ucbEscudoLogo} alt="Escudo UCB San Pablo" />
            <div>
              <span>UCB San Pablo - La Paz</span>
              <strong>LabConnect</strong>
            </div>
          </div>
          <h1>Laboratorios claros, reservas simples.</h1>
          <p>Entra, elige una accion y continua. La interfaz muestra solo lo necesario para tu rol.</p>
          <div className="login-intro-steps">
            <span>1. Ingresa</span>
            <span>2. Reserva o gestiona</span>
            <span>3. Revisa alertas</span>
          </div>
        </aside>

        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-logo-wrap">
              <img className="login-brand-logo" src={ucbEscudoLogo} alt="Escudo UCB San Pablo" />
            </div>
            <div className="login-brand-text">
              <span className="login-brand-kicker">Acceso institucional</span>
              <h2>Iniciar sesion</h2>
            </div>
          </div>

          <p className="login-subtitle">
            Usa tu cuenta institucional de Google o tus credenciales registradas.
          </p>

          <div className="login-mode-tabs" role="tablist" aria-label="Tipos de acceso">
            <button
              type="button"
              className={`login-mode-tab ${activeMode === 'google' ? 'is-active' : ''}`}
              onClick={() => setActiveMode('google')}
              role="tab"
              aria-selected={activeMode === 'google'}
            >
              Google institucional
            </button>
            <button
              type="button"
              className={`login-mode-tab ${activeMode === 'credentials' ? 'is-active' : ''}`}
              onClick={() => setActiveMode('credentials')}
              role="tab"
              aria-selected={activeMode === 'credentials'}
              disabled={!credentialsTabEnabled}
            >
              Credenciales
            </button>
          </div>

          {activeMode === 'google' ? (
            <div className="google-login-block">
              {institutionalConfigLoading ? (
                <div className="google-loading">
                  <div className="google-loading-dot" />
                  <div className="google-loading-dot" />
                  <div className="google-loading-dot" />
                </div>
              ) : institutionalConfig?.enabled && !GOOGLE_PROVIDERS.has(institutionalConfig.provider) ? (
                <p className="google-helper">
                  El proveedor <strong>{institutionalConfig.provider}</strong> esta configurado, pero no tiene boton visual en esta interfaz.
                </p>
              ) : institutionalConfig?.enabled ? (
                <>
                  <div ref={googleButtonRef} className="google-button-host" />
                  {!institutionalReady ? (
                    <div className="google-loading">
                      <div className="google-loading-dot" />
                      <div className="google-loading-dot" />
                      <div className="google-loading-dot" />
                    </div>
                  ) : null}
                  <p className="google-helper">Accede con tu correo institucional autorizado por la universidad.</p>
                  {showLocalGoogleHint ? (
                    <p className="google-helper is-warning">
                      En local, Google puede rechazar el origen si no esta autorizado en Google Cloud.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="google-helper">El acceso institucional no esta habilitado en este entorno.</p>
              )}
              {institutionalError ? <p className="auth-error" role="alert">{institutionalError}</p> : null}
            </div>
          ) : (
            <form className="credentials-form" onSubmit={handleCredentialsSubmit} noValidate>
              <div className={`form-field ${touched.username ? (usernameValid ? 'field-valid' : 'field-invalid') : ''}`}>
                <label htmlFor="login-username" className="form-label">Usuario</label>
                <div className={`field-wrap ${touched.username ? (usernameValid ? 'is-valid' : 'is-invalid') : ''}`}>
                  <input
                    id="login-username"
                    type="text"
                    value={credentials.username}
                    onChange={(event) => setCredentials((previous) => ({ ...previous, username: event.target.value }))}
                    onBlur={() => setTouched((previous) => ({ ...previous, username: true }))}
                    placeholder="tu.usuario@ucb.edu.bo"
                    autoComplete="username"
                    minLength={MIN_USERNAME_LENGTH}
                    aria-invalid={touched.username && !usernameValid}
                    aria-describedby="username-hint"
                  />
                </div>
                {usernameHint ? (
                  <p id="username-hint" className={`field-hint ${usernameHint.type === 'error' ? 'is-error' : 'is-ok'}`}>
                    {usernameHint.text}
                  </p>
                ) : null}
              </div>

              <div className={`form-field ${touched.password ? (passwordValid ? 'field-valid' : 'field-invalid') : ''}`}>
                <label htmlFor="login-password" className="form-label">Contrasena</label>
                <div className={`field-wrap ${touched.password ? (passwordValid ? 'is-valid' : 'is-invalid') : ''}`}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={(event) => setCredentials((previous) => ({ ...previous, password: event.target.value }))}
                    onBlur={() => setTouched((previous) => ({ ...previous, password: true }))}
                    placeholder={`Minimo ${MIN_PASSWORD_LENGTH} caracteres`}
                    autoComplete="current-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    aria-invalid={touched.password && !passwordValid}
                    aria-describedby="password-hint"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                {passwordHint ? (
                  <p id="password-hint" className={`field-hint ${passwordHint.type === 'error' ? 'is-error' : 'is-ok'}`}>
                    {passwordHint.text}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="credentials-submit"
                disabled={credentialsSubmitting || (touched.username && touched.password && !formValid)}
                aria-busy={credentialsSubmitting}
              >
                {credentialsSubmitting ? (
                  <>
                    <span className="submit-spinner" aria-hidden="true" />
                    Ingresando...
                  </>
                ) : 'Ingresar'}
              </button>

              {credentialsError ? <p className="auth-error" role="alert">{credentialsError}</p> : null}
            </form>
          )}

          <p className="login-footer-note">
            Sistema de Gestion de Laboratorios - UCB San Pablo La Paz
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginView
