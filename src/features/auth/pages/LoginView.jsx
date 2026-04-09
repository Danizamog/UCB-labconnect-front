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
    if (window.google?.accounts?.id) { resolve(window.google); return }
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
  const suppressGoogleButton = isLocalOrigin() && !ALLOW_GOOGLE_ON_LOCALHOST

  useEffect(() => { institutionalLoginRef.current = onInstitutionalLogin }, [onInstitutionalLogin])

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
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    let isCancelled = false
    if (activeMode !== 'google') {
      return undefined
    }
    if (
      suppressGoogleButton ||
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
      .catch(() => { if (!isCancelled) setInstitutionalError('No se pudo cargar el acceso institucional') })

    return () => {
      isCancelled = true
      if (window.google?.accounts?.id) window.google.accounts.id.cancel()
    }
  }, [activeMode, institutionalConfig, suppressGoogleButton])

  const credentialsTabEnabled = useMemo(() => typeof onLogin === 'function', [onLogin])

  /* Validation helpers */
  const usernameValid = credentials.username.trim().length >= MIN_USERNAME_LENGTH
  const passwordValid = credentials.password.length >= MIN_PASSWORD_LENGTH
  const formValid = usernameValid && passwordValid

  const getUsernameHint = () => {
    if (!touched.username || credentials.username.trim() === '') return null
    if (!usernameValid) return { text: `Mínimo ${MIN_USERNAME_LENGTH} caracteres`, type: 'error' }
    return { text: 'Correcto', type: 'ok' }
  }

  const getPasswordHint = () => {
    if (!touched.password || credentials.password === '') return null
    if (!passwordValid) return { text: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`, type: 'error' }
    return { text: 'Contraseña válida', type: 'ok' }
  }

  const handleCredentialsSubmit = async (event) => {
    event.preventDefault()
    if (!onLogin) return
    setTouched({ username: true, password: true })
    if (!formValid) {
      setCredentialsError('Completa todos los campos correctamente.')
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
      {/* Decorative blobs */}
      <div className="auth-blob auth-blob--tl" aria-hidden="true" />
      <div className="auth-blob auth-blob--br" aria-hidden="true" />
      <div className="auth-blob auth-blob--center" aria-hidden="true" />

      <section className="login-card" role="main" aria-label="Inicio de sesión">
        <div className="login-brand">
          <div className="login-brand-logo-wrap">
            <img className="login-brand-logo" src={ucbEscudoLogo} alt="Escudo UCB San Pablo" />
          </div>
          <div className="login-brand-text">
            <span className="login-brand-kicker">Universidad Católica Boliviana</span>
            <span className="login-brand-subtitle">San Pablo · La Paz</span>
            <h1>Iniciar sesión</h1>
          </div>
        </div>

        <p className="login-subtitle">
          Accede con tu cuenta institucional de Google o con tus credenciales registradas.
        </p>

        <div className="login-mode-tabs" role="tablist" aria-label="Tipos de acceso">
          <button
            type="button"
            className={`login-mode-tab ${activeMode === 'google' ? 'is-active' : ''}`}
            onClick={() => setActiveMode('google')}
            role="tab"
            aria-selected={activeMode === 'google'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            className={`login-mode-tab ${activeMode === 'credentials' ? 'is-active' : ''}`}
            onClick={() => setActiveMode('credentials')}
            role="tab"
            aria-selected={activeMode === 'credentials'}
            disabled={!credentialsTabEnabled}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Credenciales
          </button>
        </div>

        {activeMode === 'google' ? (
          <div className="google-login-block">
            {institutionalConfigLoading ? (
              <div className="google-loading">
                <div className="google-loading-dot" /><div className="google-loading-dot" /><div className="google-loading-dot" />
              </div>
            ) : institutionalConfig?.enabled && !GOOGLE_PROVIDERS.has(institutionalConfig.provider) ? (
              <p className="google-helper">
                El proveedor <strong>{institutionalConfig.provider}</strong> está configurado pero no tiene renderizador visual en esta interfaz.
              </p>
            ) : suppressGoogleButton ? (
              <div className="google-local-warning">
                <p className="google-helper">
                  <strong>Entorno local:</strong> Google se ocultó para evitar errores 403 de origen no autorizado.
                </p>
                <p className="google-helper">
                  Usa <strong>Credenciales</strong> o define <code>VITE_ENABLE_GOOGLE_ON_LOCALHOST=true</code>.
                </p>
              </div>
            ) : institutionalConfig?.enabled ? (
              <>
                <div ref={googleButtonRef} className="google-button-host" />
                {!institutionalReady && (
                  <div className="google-loading">
                    <div className="google-loading-dot" /><div className="google-loading-dot" /><div className="google-loading-dot" />
                  </div>
                )}
                <p className="google-helper">Accede con Google para continuar.</p>
              </>
            ) : (
              <p className="google-helper">El acceso institucional no está habilitado en este entorno.</p>
            )}
            {institutionalError ? (
              <p className="auth-error" role="alert">{institutionalError}</p>
            ) : null}
          </div>
        ) : (
          <form className="credentials-form" onSubmit={handleCredentialsSubmit} noValidate>
            <div className={`form-field ${touched.username ? (usernameValid ? 'field-valid' : 'field-invalid') : ''}`}>
              <label htmlFor="login-username" className="form-label">Usuario</label>
              <div className={`field-wrap ${touched.username ? (usernameValid ? 'is-valid' : 'is-invalid') : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0, color:'var(--ink-700)'}}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  id="login-username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials((p) => ({ ...p, username: e.target.value }))}
                  onBlur={() => setTouched((p) => ({ ...p, username: true }))}
                  placeholder="tu.usuario@ucb.edu.bo"
                  autoComplete="username"
                  minLength={MIN_USERNAME_LENGTH}
                  aria-invalid={touched.username && !usernameValid}
                  aria-describedby="username-hint"
                />
              </div>
              {usernameHint && (
                <p id="username-hint" className={`field-hint ${usernameHint.type === 'error' ? 'is-error' : 'is-ok'}`}>
                  {usernameHint.text}
                </p>
              )}
            </div>

            <div className={`form-field ${touched.password ? (passwordValid ? 'field-valid' : 'field-invalid') : ''}`}>
              <label htmlFor="login-password" className="form-label">Contraseña</label>
              <div className={`field-wrap ${touched.password ? (passwordValid ? 'is-valid' : 'is-invalid') : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0, color:'var(--ink-700)'}}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => setCredentials((p) => ({ ...p, password: e.target.value }))}
                  onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  autoComplete="current-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  aria-invalid={touched.password && !passwordValid}
                  aria-describedby="password-hint"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {passwordHint && (
                <p id="password-hint" className={`field-hint ${passwordHint.type === 'error' ? 'is-error' : 'is-ok'}`}>
                  {passwordHint.text}
                </p>
              )}
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

            {credentialsError ? (
              <p className="auth-error" role="alert">{credentialsError}</p>
            ) : null}
          </form>
        )}

        <p className="login-footer-note">
          Sistema de Gestión de Laboratorios · UCB San Pablo La Paz
        </p>
      </section>
    </main>
  )
}

export default LoginView
