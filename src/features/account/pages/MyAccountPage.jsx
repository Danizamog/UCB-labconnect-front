import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { changeMyPassword, getMyAccount } from '../services/accountService'
import { persistAuthResponse } from '../../auth/services/authService'
import './MyAccountPage.css'

const EMPTY_PASSWORDS = { current_password: '', new_password: '', new_password_confirm: '' }

function PasswordInput({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return <label className="account-password-field"><span>{label}</span><div className="account-password-input">
    <LockKeyhole className="account-input-lock" size={17} aria-hidden="true" />
    <input type={visible ? 'text' : 'password'} autoComplete={autoComplete} placeholder={autoComplete === 'current-password' ? 'Introduce tu contraseña actual' : 'Introduce tu nueva contraseña'} maxLength={128} required value={value} onChange={onChange} />
    <button type="button" onClick={() => setVisible((current) => !current)} aria-pressed={visible} aria-label={visible ? `Ocultar ${label}` : `Mostrar ${label}`}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div></label>
}

function MyAccountPage({ onLogout, onPasswordEstablished, requiredChange = false }) {
  const focusDialog = useCallback((node) => node?.focus(), [])
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS)
  const [saving, setSaving] = useState(false)
  const [googleVerificationExpired, setGoogleVerificationExpired] = useState(false)

  useEffect(() => { getMyAccount().then(setAccount).catch((err) => setError(err.message)).finally(() => setLoading(false)) }, [])

  useEffect(() => {
    if (!account?.google_verification_expires_at) return
    const timeout = window.setTimeout(() => setGoogleVerificationExpired(true), Math.max(0, account.google_verification_expires_at * 1000 - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [account?.google_verification_expires_at])

  const requirements = useMemo(() => ({
    length: passwords.new_password.length >= 12 && passwords.new_password.length <= 128,
    uppercase: /[A-Z]/.test(passwords.new_password), lowercase: /[a-z]/.test(passwords.new_password), number: /\d/.test(passwords.new_password),
    symbol: /[^A-Za-z0-9]/.test(passwords.new_password),
  }), [passwords])
  const completedRequirements = Object.values(requirements).filter(Boolean).length
  const localEnabled = account?.local_password_enabled ?? ['local', 'hybrid'].includes(account?.auth_provider)
  const googleVerified = Boolean(account?.can_reset_password_with_google) && !googleVerificationExpired
  const confirmationMatches = Boolean(passwords.new_password) && passwords.new_password === passwords.new_password_confirm
  const canSubmit = Boolean(account) && completedRequirements === 5 && confirmationMatches && (googleVerified || (localEnabled && Boolean(passwords.current_password))) && !saving && !message

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await changeMyPassword({ ...passwords, current_password: googleVerified ? null : passwords.current_password })
      if (response?.access_token) {
        const session = persistAuthResponse(response)
        if (!session.success) throw new Error(session.message)
        setPasswords(EMPTY_PASSWORDS)
        if (onPasswordEstablished) await onPasswordEstablished()
        else window.location.assign('/app')
        return
      }
      setMessage('Contraseña actualizada. Por seguridad, volverás a iniciar sesión.')
      setPasswords(EMPTY_PASSWORDS)
      window.setTimeout(() => onLogout?.(), 1200)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  if (loading) return <section className="account-page"><div className="account-loading">Cargando tu cuenta...</div></section>

  const initials = String(account?.name || account?.username || 'U').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const fields = [
    ['Tipo de perfil', account?.profile_type || 'No especificado'], ['Facultad', account?.faculty || 'No registrada'],
    ['Carrera', account?.career || 'No registrada'], ['Código', account?.student_code || 'No registrado'],
    ['Campus', account?.campus || 'No registrado'], ['Teléfono', account?.phone || 'No registrado'],
  ]
  const checks = [['length', 'Entre 12 y 128 caracteres'], ['uppercase', 'Al menos una mayúscula'], ['lowercase', 'Al menos una minúscula'], ['number', 'Al menos un número'], ['symbol', 'Al menos un símbolo']]

  const passwordForm = <form onSubmit={submit} className="password-form">
    {googleVerified ? <div className="account-google-proof"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Identidad verificada con Google</strong><span>No necesitas introducir una contraseña anterior.</span></div></div> : <PasswordInput label={requiredChange ? 'Contraseña temporal o actual' : 'Contraseña actual'} autoComplete="current-password" value={passwords.current_password} onChange={(event) => setPasswords((current) => ({ ...current, current_password: event.target.value }))} />}
    <PasswordInput label="Nueva contraseña" autoComplete="new-password" value={passwords.new_password} onChange={(event) => setPasswords((current) => ({ ...current, new_password: event.target.value }))} />
    <PasswordInput label="Confirmar nueva contraseña" autoComplete="new-password" value={passwords.new_password_confirm} onChange={(event) => setPasswords((current) => ({ ...current, new_password_confirm: event.target.value }))} />
    {passwords.new_password_confirm ? <small className={confirmationMatches ? 'account-confirmation-ok' : 'account-confirmation-error'}>{confirmationMatches ? 'Las contraseñas coinciden.' : 'Las contraseñas todavía no coinciden.'}</small> : null}
    <div className="account-password-rules">
      <div className="account-rules-heading"><strong>Tu contraseña debe incluir</strong><span>{completedRequirements}/5 requisitos</span></div>
      <div className="password-strength" role="progressbar" aria-label="Requisitos de contraseña completados" aria-valuemin={0} aria-valuemax={5} aria-valuenow={completedRequirements}><div style={{ width: `${completedRequirements * 20}%` }} /></div>
      <ul className="password-checklist">{checks.map(([key, label]) => <li className={requirements[key] ? 'ok' : ''} key={key}><span className="account-check-icon" aria-hidden="true">{requirements[key] ? <Check size={12} /> : null}</span><span>{label}{requirements[key] ? <span className="account-sr-only">: cumplido</span> : null}</span></li>)}</ul>
    </div>
    <p className="account-password-policy">Vigencia de 90 días. Debe ser diferente de tus últimas cinco contraseñas.</p>
    <button type="submit" disabled={!canSubmit}>{saving ? 'Guardando...' : !localEnabled ? 'Establecer contraseña' : 'Cambiar contraseña'}{!saving ? <ArrowRight size={17} aria-hidden="true" /> : null}</button>
    <small className="account-session-note"><LockKeyhole size={13} aria-hidden="true" />{!localEnabled ? 'Al guardar, continuarás a LabConnect de forma segura.' : 'Al guardar, volverás a iniciar sesión por seguridad.'}</small>
  </form>

  const needsGoogleVerification = !googleVerified && !localEnabled
  const reverifyGoogle = <div className="account-sso-message"><ShieldCheck size={24} /><div><strong>Verifica tu identidad con Google</strong><p>{googleVerificationExpired ? 'La verificación de seguridad venció. Vuelve a iniciar sesión con Google para continuar.' : 'Inicia sesión con tu cuenta institucional de Google para establecer o recuperar tu contraseña de LabConnect.'}</p><button type="button" className="account-reverify" onClick={onLogout}>Volver al acceso con Google</button></div></div>

  if (requiredChange) return <main className="account-password-gate">
    <section className="account-password-dialog" role="dialog" aria-modal="true" aria-labelledby="required-password-title" tabIndex={-1} ref={focusDialog}>
      <aside className="account-setup-intro">
        <div className="account-setup-brand"><span><KeyRound size={20} aria-hidden="true" /></span>LabConnect</div>
        <div className="account-setup-copy"><div className="account-setup-emblem"><ShieldCheck size={36} strokeWidth={1.5} aria-hidden="true" /></div><p className="account-setup-eyebrow">Seguridad de tu cuenta</p><h2>Tu cuenta, lista para el siguiente paso.</h2><p>Configura una contraseña propia para ingresar también con tus credenciales institucionales.</p>
        <ol className="account-setup-steps"><li><span><Check size={14} aria-hidden="true" /></span><div><strong>Cuenta identificada</strong><small>Tu acceso institucional está vinculado.</small></div></li><li className="is-current"><span>2</span><div><strong>{localEnabled ? 'Actualiza tu contraseña' : 'Establece tu contraseña'}</strong><small>Completa los cinco requisitos de seguridad.</small></div></li></ol></div>
        <p className="account-setup-footer"><LockKeyhole size={14} aria-hidden="true" /> Una cuenta para Google y credenciales.</p>
      </aside>
      <div className="account-setup-content">
      <span className="account-setup-step-label">Configuración de acceso</span>
      <h1 id="required-password-title">{!localEnabled ? 'Establece tu contraseña de LabConnect' : 'Actualiza tu contraseña para continuar'}</h1>
      <p className="account-setup-description">Completa este paso para acceder a LabConnect. Esta contraseña es independiente de la de Google.</p>
      {account?.username ? <div className="account-setup-identity"><Mail size={15} aria-hidden="true" /><span>{account.username}</span></div> : null}
      {error ? <p className="account-alert is-error" role="alert">{error}</p> : null}
      {message ? <p className="account-alert is-success" role="status">{message}</p> : null}
      {needsGoogleVerification ? reverifyGoogle : passwordForm}
      <button className="account-signout" type="button" onClick={onLogout}><LogOut size={15} aria-hidden="true" /> Cerrar sesión</button>
      </div>
    </section>
  </main>

  return <section className="account-page">
    <header className="account-hero">
      <div className="account-avatar" aria-hidden="true">{initials}</div>
      <div className="account-hero-copy"><p>Cuenta personal</p><h1>{account?.name || 'Mi cuenta'}</h1><span><Mail size={15} /> {account?.username}</span></div>
      <div className="account-badges"><span><ShieldCheck size={15} /> {account?.role || 'Sin rol'}</span><span className={account?.is_active ? 'is-active' : 'is-inactive'}>{account?.is_active ? 'Cuenta activa' : 'Cuenta inactiva'}</span></div>
    </header>
    {error ? <p className="account-alert is-error" role="alert">{error}</p> : null}
    {message ? <p className="account-alert is-success">{message}</p> : null}
    {account?.must_change_password ? <p className="account-alert is-error" role="alert">Debes reemplazar la contraseña temporal o vencida antes de usar los demás módulos.</p> : null}
    <div className="account-grid">
      <article className="account-card">
        <div className="account-card-title"><UserRound /><div><h2>Información personal</h2><p>Datos registrados en tu perfil institucional.</p></div></div>
        <div className="account-identity-row"><span>Nombre completo</span><strong>{account?.name || 'No registrado'}</strong></div>
        <div className="account-identity-row"><span>Correo institucional</span><strong>{account?.username || 'No registrado'}</strong></div>
        <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className="account-readonly-note"><LockKeyhole size={16} /> Tus datos institucionales son de solo lectura. Un administrador puede corregirlos.</p>
      </article>
      <article className="account-card">
        <div className="account-card-title"><KeyRound /><div><h2>Seguridad de acceso</h2><p>La contraseña de LabConnect es independiente de la de Google.</p></div></div>
        <div className="account-auth-method"><span>Métodos de acceso</span><strong>{account?.google_linked ? 'Google SSO + credenciales' : 'Correo y contraseña'}</strong></div>
        {needsGoogleVerification ? reverifyGoogle : passwordForm}
        {!googleVerified && localEnabled ? <div className="account-recovery-note"><p>¿Olvidaste tu contraseña? Vuelve a ingresar con Google para verificar tu identidad y restablecerla.</p><button type="button" className="account-reverify" onClick={onLogout}>Recuperar mediante Google</button></div> : null}
      </article>
    </div>
  </section>
}

export default MyAccountPage
