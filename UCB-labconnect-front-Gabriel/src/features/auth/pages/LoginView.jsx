import { useEffect, useMemo, useRef, useState } from 'react'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import { getInstitutionalSSOConfig } from '../services/authService'
import './LoginView.css'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const GOOGLE_PROVIDERS = new Set(['google_oidc', 'google'])
const ALLOW_GOOGLE_ON_LOCALHOST = String(import.meta.env.VITE_ENABLE_GOOGLE_ON_LOCALHOST || '').trim().toLowerCase() === 'true'

function isLocalOrigin() {
  if (typeof window === 'undefined') {
    return false
  }

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
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  })
  const googleButtonRef = useRef(null)
  const institutionalLoginRef = useRef(onInstitutionalLogin)
  const initializedGoogleClientIdRef = useRef('')
  const suppressGoogleButton = isLocalOrigin() && !ALLOW_GOOGLE_ON_LOCALHOST

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

    if (
      suppressGoogleButton ||
      !institutionalConfig?.enabled ||
      !GOOGLE_PROVIDERS.has(institutionalConfig.provider) ||
      !institutionalConfig.client_id ||
      !googleButtonRef.current
    ) {
      return undefined
    }

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
  }, [institutionalConfig, suppressGoogleButton])

  const credentialsTabEnabled = useMemo(() => typeof onLogin === 'function', [onLogin])

  const handleCredentialsSubmit = async (event) => {
    event.preventDefault()
    if (!onLogin) return

    setCredentialsError('')

    if (!credentials.username.trim() || !credentials.password) {
      setCredentialsError('Debes ingresar tu usuario y contraseña.')
      return
    }

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

  return (
    <main className="auth-screen">
      <section className="login-card">
        <div className="login-brand">
          <img className="login-brand-logo" src={ucbEscudoLogo} alt="Escudo Universidad Catolica Boliviana San Pablo" />
          <div>
            <span className="login-brand-kicker">Universidad Catolica Boliviana San Pablo</span>
            <h1>Iniciar sesión</h1>
          </div>
        </div>

        <p className="login-subtitle">Accede con Google institucional o con las credenciales almacenadas en la base de datos.</p>

        <div className="login-mode-tabs" role="tablist" aria-label="Tipos de acceso">
          <button
            type="button"
            className={`login-mode-tab ${activeMode === 'google' ? 'is-active' : ''}`}
            onClick={() => setActiveMode('google')}
            role="tab"
            aria-selected={activeMode === 'google'}
          >
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
            Credenciales
          </button>
        </div>

        {activeMode === 'google' ? (
          <div className="google-login-block">
            {institutionalConfigLoading ? (
              <p className="google-helper">Cargando configuracion del acceso institucional...</p>
            ) : institutionalConfig?.enabled && !GOOGLE_PROVIDERS.has(institutionalConfig.provider) ? (
              <p className="google-helper">
                El proveedor institucional <strong>{institutionalConfig.provider}</strong> ya esta configurado en backend.
                Esta interfaz aun no tiene renderizador visual para ese proveedor.
              </p>
            ) : suppressGoogleButton ? (
              <div className="google-local-warning">
                <p className="google-helper">
                  El acceso con Google se oculto en este entorno local para evitar errores <strong>403</strong> de origen no autorizado.
                </p>
                <p className="google-helper">
                  Usa la pestana <strong>Credenciales</strong> o autoriza <strong>{typeof window !== 'undefined' ? window.location.origin : 'este origen'}</strong> en Google Cloud y define <code>VITE_ENABLE_GOOGLE_ON_LOCALHOST=true</code>.
                </p>
              </div>
            ) : institutionalConfig?.enabled ? (
              <>
                <div ref={googleButtonRef} className="google-button-host" />
                {!institutionalReady ? (
                  <p className="google-helper">Cargando {institutionalConfig?.button_label || 'acceso institucional'}...</p>
                ) : null}
                <p className="google-helper">Utiliza tu cuenta oficial de la universidad (@ucb.edu.bo).</p>
              </>
            ) : (
              <p className="google-helper">El acceso institucional no esta habilitado en este entorno.</p>
            )}
            {institutionalError ? <p className="auth-error">{institutionalError}</p> : null}
          </div>
        ) : (
          <form className="credentials-form" onSubmit={handleCredentialsSubmit}>
            <label>
              <span>Usuario</span>
              <div className="field-wrap">
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(event) => setCredentials((previous) => ({ ...previous, username: event.target.value }))}
                  placeholder="Ingrese su usuario"
                  autoComplete="username"
                />
              </div>
            </label>

            <label>
              <span>Contraseña</span>
              <div className="field-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(event) => setCredentials((previous) => ({ ...previous, password: event.target.value }))}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </label>

            <button type="submit" className="credentials-submit" disabled={credentialsSubmitting}>
              {credentialsSubmitting ? 'Ingresando...' : 'Enviar'}
            </button>

            {credentialsError ? <p className="auth-error">{credentialsError}</p> : null}
          </form>
        )}
      </section>
    </main>
  )
}

export default LoginView
