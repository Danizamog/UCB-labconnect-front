import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { changeMyPassword, getMyAccount } from '../services/accountService'
import './MyAccountPage.css'

const EMPTY_PASSWORDS = { current_password: '', new_password: '', new_password_confirm: '' }

function PasswordInput({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return <label className="account-password-field"><span>{label}</span><div className="account-password-input">
    <input type={visible ? 'text' : 'password'} autoComplete={autoComplete} maxLength={128} required value={value} onChange={onChange} />
    <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Ocultar ${label}` : `Mostrar ${label}`}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div></label>
}

function MyAccountPage({ onLogout, requiredChange = false }) {
  const focusDialog = useCallback((node) => node?.focus(), [])
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getMyAccount().then(setAccount).catch((err) => setError(err.message)).finally(() => setLoading(false)) }, [])

  const requirements = useMemo(() => ({
    length: passwords.new_password.length >= 12 && passwords.new_password.length <= 128,
    uppercase: /[A-Z]/.test(passwords.new_password), lowercase: /[a-z]/.test(passwords.new_password), number: /\d/.test(passwords.new_password),
    symbol: /[^A-Za-z0-9]/.test(passwords.new_password),
    match: Boolean(passwords.new_password) && passwords.new_password === passwords.new_password_confirm,
  }), [passwords])
  const completedRequirements = Object.values(requirements).filter(Boolean).length
  const isLocal = (account?.auth_provider || 'local') === 'local'
  const canSubmit = Boolean(account) && completedRequirements === 6 && Boolean(passwords.current_password) && !saving && !message

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true); setError(''); setMessage('')
    try {
      await changeMyPassword(passwords)
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
  const checks = [['length', 'Entre 12 y 128 caracteres'], ['uppercase', 'Al menos una mayúscula'], ['lowercase', 'Al menos una minúscula'], ['number', 'Al menos un número'], ['symbol', 'Al menos un símbolo'], ['match', 'Ambas contraseñas coinciden']]

  const passwordForm = <form onSubmit={submit} className="password-form">
    <PasswordInput label={requiredChange ? 'Contraseña temporal o actual' : 'Contraseña actual'} autoComplete="current-password" value={passwords.current_password} onChange={(event) => setPasswords((current) => ({ ...current, current_password: event.target.value }))} />
    <PasswordInput label="Nueva contraseña" autoComplete="new-password" value={passwords.new_password} onChange={(event) => setPasswords((current) => ({ ...current, new_password: event.target.value }))} />
    <PasswordInput label="Confirmar nueva contraseña" autoComplete="new-password" value={passwords.new_password_confirm} onChange={(event) => setPasswords((current) => ({ ...current, new_password_confirm: event.target.value }))} />
    <div className="password-strength"><div style={{ width: `${completedRequirements * (100 / 6)}%` }} /><span>{completedRequirements}/6 requisitos</span></div>
    <ul className="password-checklist">{checks.map(([key, label]) => <li className={requirements[key] ? 'ok' : ''} key={key}><Check size={15} /> {label}</li>)}</ul>
    <p className="account-readonly-note">No puedes reutilizar tus últimas cinco contraseñas. La nueva contraseña tendrá una vigencia de 90 días.</p>
    <button type="submit" disabled={!canSubmit}>{saving ? 'Actualizando...' : 'Cambiar contraseña'}</button>
    <small>Al cambiarla se cerrarán tus sesiones activas y deberás iniciar sesión nuevamente.</small>
  </form>

  if (requiredChange) return <main className="account-password-gate">
    <section className="account-card account-password-dialog" role="dialog" aria-modal="true" aria-labelledby="required-password-title" tabIndex={-1} ref={focusDialog}>
      <div className="account-card-title"><KeyRound /><div><h1 id="required-password-title">Cambia tu contraseña para continuar</h1><p>{account?.username}</p></div></div>
      <p>Por seguridad, debes reemplazar la contraseña temporal o vencida antes de ingresar a LabConnect.</p>
      {error ? <p className="account-alert is-error" role="alert">{error}</p> : null}
      {message ? <p className="account-alert is-success" role="status">{message}</p> : null}
      {isLocal ? passwordForm : <p>Esta cuenta utiliza SSO. Cierra sesión e ingresa con Google.</p>}
      <button className="account-signout" type="button" onClick={onLogout}>Cerrar sesión</button>
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
        <div className="account-card-title"><KeyRound /><div><h2>Seguridad de acceso</h2><p>{isLocal ? 'Actualiza tu contraseña de forma segura.' : 'Tu acceso está protegido por Google SSO.'}</p></div></div>
        <div className="account-auth-method"><span>Método de acceso</span><strong>{isLocal ? 'Usuario y contraseña' : 'Google SSO'}</strong></div>
        {!isLocal ? <div className="account-sso-message"><ShieldCheck size={28} /><div><strong>Credencial administrada por Google</strong><p>Para cambiarla o recuperar el acceso, utiliza tu cuenta institucional de Google.</p></div></div> :
          passwordForm}
      </article>
    </div>
  </section>
}

export default MyAccountPage
