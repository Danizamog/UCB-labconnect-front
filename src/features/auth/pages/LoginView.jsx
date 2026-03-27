import { useEffect, useRef, useState } from 'react'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import { getInstitutionalSSOConfig } from '../services/authService'
import './LoginView.css'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const GOOGLE_PROVIDERS = new Set(['google_oidc', 'google'])

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

function LoginView({ onInstitutionalLogin }) {
  const [institutionalError, setInstitutionalError] = useState('')
  const [institutionalReady, setInstitutionalReady] = useState(false)
  const [institutionalConfig, setInstitutionalConfig] = useState(null)
  const [institutionalConfigLoading, setInstitutionalConfigLoading] = useState(true)
  const googleButtonRef = useRef(null)

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
      !GOOGLE_PROVIDERS.has(institutionalConfig.provider) ||
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
      <section className="login-card">
        <div className="login-brand">
          <img
            className="login-brand-logo"
            src={ucbEscudoLogo}
            alt="Escudo Universidad Catolica Boliviana San Pablo"
          />
          <div>
            <span className="login-brand-kicker">Universidad Catolica Boliviana San Pablo</span>
            <h1>Acceso institucional</h1>
          </div>
        </div>

        <p className="login-subtitle">Ingresa con tu cuenta institucional @ucb.edu.bo para continuar.</p>

        <div className="google-login-block">
          {institutionalConfigLoading ? (
            <p className="google-helper">Cargando configuracion del acceso institucional...</p>
          ) : institutionalConfig?.enabled && !GOOGLE_PROVIDERS.has(institutionalConfig.provider) ? (
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
            <p className="google-helper">El acceso institucional no esta habilitado en este entorno.</p>
          )}
        </div>

        {institutionalError ? <p className="auth-error">{institutionalError}</p> : null}
      </section>
    </main>
  )
}

export default LoginView
