import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Download, KeyRound, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react'
import { exportSecurityReport, loadSecurityDashboard } from '../services/securityService'
import './SecurityAuditPage.css'

const SECTIONS = [
  ['audit', 'Auditoría', 'Eventos trazables del sistema'], ['auth', 'Autenticaciones', 'Inicios de sesión exitosos y fallidos'],
  ['sessions', 'Sesiones', 'Sesiones emitidas, vigentes o revocadas'], ['incidents', 'Incidentes', 'Hallazgos registrados para seguimiento'],
  ['reviews', 'Revisiones RBAC', 'Evidencia de revisiones de acceso'],
]

function recordTitle(record) { return record.action || record.title || record.event_type || record.role_name || record.status || 'Registro de seguridad' }
function recordSubtitle(record) { return record.email || record.actor_email || record.reason || record.description || record.period || record.created || 'Sin detalle adicional' }

function SecurityAuditPage() {
  const [data, setData] = useState({ audit: [], auth: [], sessions: [], incidents: [], reviews: [], users: [], roles: [], errors: [] })
  const [active, setActive] = useState('audit')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await loadSecurityDashboard()) } catch (err) { setError(err.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const metrics = useMemo(() => {
    const activeSessions = data.sessions.filter((item) => !item.status || ['active', 'vigente'].includes(String(item.status).toLowerCase())).length
    const openIncidents = data.incidents.filter((item) => !['closed', 'resolved', 'cerrado', 'resuelto'].includes(String(item.status).toLowerCase())).length
    return [
      ['Usuarios', data.users.length, <UsersRound key="users" />, 'Cuentas visibles para auditoría'],
      ['Roles RBAC', data.roles.length, <ShieldCheck key="roles" />, 'Roles definidos en la matriz'],
      ['Sesiones activas', activeSessions, <KeyRound key="sessions" />, 'Sin exponer credenciales'],
      ['Incidentes abiertos', openIncidents, <AlertTriangle key="incidents" />, 'Pendientes de seguimiento'],
    ]
  }, [data])
  const activeSection = SECTIONS.find(([key]) => key === active)
  const activeRecords = data[active] || []

  const exportReport = async () => {
    try {
      const report = await exportSecurityReport()
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = `auditoria-seguridad-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
    } catch (err) { setError(err.message) }
  }

  return <section className="security-page">
    <header className="security-hero"><div><p>Oficina de Seguridad de la Información</p><h1>Centro de auditoría</h1><span>Supervisión de solo lectura: cuentas, sesiones, eventos, incidentes y accesos RBAC.</span></div>
      <div className="security-actions"><button type="button" onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? 'is-spinning' : ''} /> Actualizar</button><button type="button" className="is-primary" onClick={exportReport}><Download size={17} /> Exportar evidencia</button></div>
    </header>
    {error ? <p className="security-alert is-error">{error}</p> : null}
    {data.errors?.length ? <p className="security-alert is-warning">Algunas fuentes no respondieron; la información disponible se muestra igualmente.</p> : null}
    <div className="security-metrics">{metrics.map(([label, value, icon, detail]) => <article key={label}>{icon}<div><span>{label}</span><strong>{loading ? '—' : value}</strong><small>{detail}</small></div></article>)}</div>
    <div className="security-workspace">
      <nav className="security-tabs" aria-label="Fuentes de auditoría">{SECTIONS.map(([key, label]) => <button type="button" className={active === key ? 'is-active' : ''} onClick={() => setActive(key)} key={key}>{label}<span>{data[key]?.length || 0}</span></button>)}</nav>
      <article className="security-panel">
        <div className="security-panel-heading"><div><p>Fuente de evidencia</p><h2>{activeSection?.[1]}</h2><span>{activeSection?.[2]}</span></div><Activity /></div>
        {loading ? <div className="security-empty">Consultando eventos de seguridad...</div> : activeRecords.length ? <div className="security-record-list">{activeRecords.slice(0, 50).map((record, index) => <div className="security-record" key={record.id || `${active}-${index}`}><span className="security-record-dot" /><div><strong>{recordTitle(record)}</strong><p>{recordSubtitle(record)}</p></div><time>{String(record.created || record.updated || '').replace('T', ' ').slice(0, 19) || 'Sin fecha'}</time></div>)}</div> : <div className="security-empty"><ShieldCheck size={36} /><strong>Sin registros en esta fuente</strong><span>No se encontraron eventos para mostrar en este momento.</span></div>}
      </article>
    </div>
  </section>
}

export default SecurityAuditPage
