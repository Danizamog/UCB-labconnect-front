import { useEffect, useRef, useState } from 'react'

const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=es&onload=labconnectRecaptchaLoaded'
let scriptPromise = null

function loadRecaptcha() {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    window.labconnectRecaptchaLoaded = () => {
      delete window.labconnectRecaptchaLoaded
      resolve(window.grecaptcha)
    }
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      delete window.labconnectRecaptchaLoaded
      reject(new Error('No se pudo cargar reCAPTCHA. Revisa tu conexión e inténtalo de nuevo.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export default function RecaptchaCheckbox({ siteKey, onChange }) {
  const hostRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 420px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 420px)')
    const sync = () => { onChange(''); setError(''); setReady(false); setCompact(media.matches) }
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [onChange])

  useEffect(() => {
    let cancelled = false
    let widgetId = null
    let api = null
    const mount = document.createElement('div')
    hostRef.current.appendChild(mount)
    onChange('')
    loadRecaptcha().then((recaptcha) => {
      if (cancelled) return
      api = recaptcha
      widgetId = api.render(mount, {
        sitekey: siteKey, size: compact ? 'compact' : 'normal',
        callback: (token) => { if (!cancelled) { onChange(token); setError('') } },
        'expired-callback': () => { if (!cancelled) { onChange(''); setError('La verificación venció. Marca nuevamente la casilla.') } },
        'error-callback': () => { if (!cancelled) { onChange(''); setError('No se pudo verificar reCAPTCHA. Revisa tu conexión y vuelve a intentar.') } },
      })
      setReady(true)
    }).catch((err) => { if (!cancelled) { onChange(''); setError(err.message) } })
    return () => {
      cancelled = true
      if (widgetId !== null && api) { try { api.reset(widgetId) } catch { /* Widget ya retirado por Google. */ } }
      mount.remove()
    }
  }, [siteKey, onChange, compact, retry])

  return <section className="login-captcha" aria-label="Verificación de seguridad">
    <span className="login-captcha-label">Verificación de seguridad</span>
    <div className="login-captcha-widget" ref={hostRef} />
    {!ready && !error ? <p className="login-captcha-hint" role="status">Cargando reCAPTCHA…</p> : null}
    {error ? <div className="login-captcha-error"><p role="alert">{error}</p><button type="button" onClick={() => { setError(''); setReady(false); setRetry((value) => value + 1) }}>Volver a intentar</button></div> : null}
  </section>
}
