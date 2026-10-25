import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Download, Eye, History, Info, KeyRound, LogIn, RefreshCw, Search, ShieldCheck, UsersRound } from 'lucide-react'
import WorkflowDialog from '../../../shared/components/WorkflowDialog'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import { exportSecurityReport, loadSecurityDashboard, ROLE_HISTORY_PERMISSIONS, SECURITY_SOURCES } from '../services/securityService'
import RoleChangeHistory from '../components/RoleChangeHistory'
import { eventLabel, eventResult, humanReason, incidentState, parseSecurityDate, ROLE_ACTIONS, securityDate, securityDay, sessionState } from '../lib/securityPresentation'
import './SecurityAuditPage.css'

const SECTIONS = [
  { id: 'overview', label: 'Resumen', icon: ShieldCheck, description: 'Un punto de partida para revisar cuentas, accesos y cambios de permisos.' },
  { id: 'roles', source: 'roleHistory', label: 'Cambios de roles', icon: History, description: 'Quién creó, editó o asignó un rol, por qué lo hizo y qué cambió.' },
  { id: 'auth', source: 'auth', label: 'Accesos', icon: LogIn, description: 'Ingresos con Google o contraseña, intentos fallidos y bloqueos de cuenta.' },
  { id: 'sessions', source: 'sessions', label: 'Sesiones', icon: KeyRound, description: 'Accesos emitidos por el sistema y su estado actual: vigente, vencido o cerrado.' },
  { id: 'incidents', source: 'incidents', label: 'Incidentes', icon: AlertTriangle, description: 'Hallazgos de seguridad registrados, su gravedad y seguimiento.' },
  { id: 'reviews', source: 'reviews', label: 'Revisiones de acceso', icon: ClipboardCheck, description: 'Evaluaciones de los accesos de una persona. Son distintas del historial automático de cambios de roles.' },
  { id: 'audit', source: 'audit', label: 'Actividad del sistema', icon: Activity, description: 'Evidencia de cambios de contraseña, bajas, desbloqueos y otras acciones registradas.' },
]
const EMPTY_DATA = { audit: [], auth: [], sessions: [], incidents: [], reviews: [], users: [], roles: [], roleHistory: [], errors: [], available: [], roleChangeCount: null }
const searchable = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const recordDate = (record, source) => source === 'sessions' ? record.issued_at || record.created : record.created || record.updated
const severity = (value) => ({ critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja', critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' })[String(value).toLowerCase()] || 'Sin clasificar'
const decisionLabel = (value) => ({ approved: 'Acceso confirmado', maintain: 'Mantener acceso', mantener: 'Mantener acceso', revoke: 'Retirar acceso', revoked: 'Acceso retirado', retirar: 'Retirar acceso', rejected: 'Rechazado', pending: 'Pendiente', reviewed: 'Revisado' })[value] || (value ? 'Decisión registrada' : 'Sin decisión registrada')

function Badge({ state }) { return <span className={`security-badge is-${state.tone}`}><span aria-hidden="true" />{state.label}</span> }
function recordState(record, source, now) {
  if (source === 'sessions') return sessionState(record, now)
  if (source === 'incidents') return incidentState(record)
  if (source === 'reviews') return { label: decisionLabel(record.decision), tone: record.decision === 'pending' ? 'warning' : 'neutral', value: record.decision || 'unknown' }
  return eventResult(record)
}

function SecurityAuditPage({ user, currentHash, onNavigate }) {
  const [data, setData] = useState(EMPTY_DATA)
  const [localSection, setLocalSection] = useState(() => window.location.hash.replace('#', '') || 'overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(Date.now)
  const requestId = useRef(0)
  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true); setError('')
    try {
      const result = await loadSecurityDashboard(user)
      if (requestId.current === id) { setData(result); setUpdatedAt(new Date().toISOString()); setRevision((value) => value + 1) }
    } catch (err) { if (requestId.current === id) setError(err.message) }
    finally { if (requestId.current === id) setLoading(false) }
  }, [user])
  useEffect(() => { load(); return () => { requestId.current += 1 } }, [load])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer) }, [])
  const sections = SECTIONS.filter((section) => !section.source || hasAnyPermission(user, SECURITY_SOURCES[section.source].permissions))
  const requestedSection = currentHash === undefined ? localSection : currentHash.replace(/^#/, '') || 'overview'
  const active = sections.find((section) => section.id === requestedSection) || sections[0]
  const selectSection = (id) => {
    setLocalSection(id)
    if (onNavigate) onNavigate(`/app/seguridad#${id}`, { replace: true })
    else window.history.replaceState({}, '', `/app/seguridad#${id}`)
  }
  const failedAccesses = data.auth.filter((record) => ['failed', 'blocked'].includes(eventResult(record).value)
    && (parseSecurityDate(record.created)?.getTime() || 0) >= now - 86400000
    && (parseSecurityDate(record.created)?.getTime() || 0) <= now).length
  const openIncidents = data.incidents.filter((record) => incidentState(record).value !== 'closed').length
  const activeSessions = data.sessions.filter((record) => sessionState(record, now).value === 'active').length
  const metrics = [
    { source: 'auth', label: 'Accesos fallidos · 24 h', value: failedAccesses, detail: 'En los accesos recientes consultados', icon: LogIn, target: 'auth', warning: failedAccesses > 0 },
    { source: 'sessions', label: 'Sesiones vigentes', value: activeSessions, detail: 'Con vencimiento futuro y sin revocación', icon: KeyRound, target: 'sessions' },
    { source: 'incidents', label: 'Incidentes pendientes', value: openIncidents, detail: 'Sin cierre en los registros consultados', icon: AlertTriangle, target: 'incidents', warning: openIncidents > 0 },
    { source: 'roleHistory', label: 'Cambios de roles', value: data.roleChangeCount, detail: 'Total del historial de roles y permisos', icon: History, target: 'roles' },
  ].filter((metric) => hasAnyPermission(user, SECURITY_SOURCES[metric.source].permissions))
  if (!metrics.length && hasAnyPermission(user, ['consultar_roles'])) metrics.push({ source: 'roles', label: 'Roles configurados', value: data.roles.length, detail: 'Responsabilidades definidas en el sistema', icon: ShieldCheck })
  const exportReport = async () => {
    if (exporting) return
    setExporting(true); setError('')
    try {
      const report = await exportSecurityReport(user)
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = `evidencia-seguridad-${securityDay(new Date().toISOString())}.json`
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setError(`No se pudo exportar la evidencia: ${err.message}`) }
    finally { setExporting(false) }
  }
  return <section className="security-page" aria-label="Centro de seguridad">
    <header className="security-hero"><div><p className="security-eyebrow">Supervisión y trazabilidad</p><h1>Seguridad</h1><p className="security-hero-description">Revisa quién accede a LabConnect, qué cambios se realizan y qué situaciones necesitan seguimiento.</p><span className="security-readonly"><ShieldCheck size={13} /> Consulta según tus permisos · sin modificar evidencia</span></div><div className="security-actions"><button type="button" className="security-button" disabled={loading} onClick={load}><RefreshCw size={15} className={loading ? 'security-spin' : ''} />Actualizar</button>{hasAnyPermission(user, ['exportar_reportes_seguridad']) ? <button type="button" className="security-button is-primary" disabled={exporting || loading} onClick={exportReport}><Download size={15} />{exporting ? 'Preparando…' : 'Exportar evidencia'}</button> : null}</div></header>
    {error ? <p className="security-alert is-error" role="alert">{error}</p> : null}
    {data.errors.length ? <details className="security-alert is-warning"><summary>{data.errors.length} {data.errors.length === 1 ? 'fuente no disponible' : 'fuentes no disponibles'}. Sus cifras no se muestran como cero.</summary><ul>{data.errors.map((item) => <li key={item.key}><strong>{item.label}:</strong> {item.message}</li>)}</ul></details> : null}
    {metrics.length ? <div className="security-metrics">{metrics.map((metric) => <button type="button" className={metric.warning && data.available.includes(metric.source) ? 'has-attention' : ''} key={metric.source} onClick={() => metric.target && selectSection(metric.target)} disabled={!metric.target}><span className="security-metric-icon">{createElement(metric.icon, { size: 20 })}</span><span className="security-metric-copy"><span>{metric.label}</span><strong>{loading ? '—' : data.available.includes(metric.source) ? metric.value : 'No disponible'}</strong><small>{metric.detail}</small></span>{metric.target ? <ArrowRight size={14} /> : null}</button>)}</div> : null}
    <div className="security-workspace"><nav className="security-tabs" aria-label="Secciones de seguridad">{sections.map((section) => <button type="button" key={section.id} className={active.id === section.id ? 'is-active' : ''} aria-current={active.id === section.id ? 'page' : undefined} onClick={() => selectSection(section.id)}>{createElement(section.icon, { size: 16 })}{section.label}</button>)}</nav><article className="security-panel" aria-label={active.label}><div className="security-panel-heading"><div><h2>{active.label}</h2><p>{active.description}</p></div><span className="security-panel-icon">{createElement(active.icon, { size: 22 })}</span></div><div className="security-panel-content">
      {active.id === 'overview' ? <><div className="security-overview-heading"><h3>¿Qué necesitas revisar?</h3><p>Cada sección responde una pregunta distinta. Solo se muestran las fuentes que puedes consultar.</p></div>{hasAnyPermission(user, ROLE_HISTORY_PERMISSIONS) ? <div className="security-history-feature"><span className="security-feature-icon"><History size={25} /></span><div><span className="security-feature-eyebrow">Historial de roles y permisos</span><h3>Quién cambió los accesos</h3><p>Identifica al responsable, el motivo y los permisos que se añadieron o retiraron.</p>{data.roleHistory[0] ? <small>Último registro: {ROLE_ACTIONS[data.roleHistory[0].action] || 'Cambio de acceso'} · {data.roleHistory[0].actor_email || 'Responsable registrado'} · {securityDate(data.roleHistory[0].created)}</small> : <small>Los nuevos cambios se registran automáticamente.</small>}</div><button type="button" className="security-button is-primary" onClick={() => selectSection('roles')}>Ver cambios de roles <ArrowRight size={15} /></button></div> : null}
        <div className="security-section-cards">{sections.filter((section) => !['overview', 'roles'].includes(section.id)).map((section) => <button type="button" key={section.id} onClick={() => selectSection(section.id)}><span className="security-section-icon">{createElement(section.icon, { size: 21 })}</span><strong>{section.id === 'auth' ? '¿Quién intentó ingresar?' : section.id === 'sessions' ? '¿Qué sesiones siguen vigentes?' : section.id === 'incidents' ? '¿Qué incidentes requieren atención?' : section.id === 'reviews' ? '¿Qué accesos fueron revisados?' : '¿Qué acciones quedaron registradas?'}</strong><p>{section.description}</p><span className="security-section-link">Abrir {section.label.toLowerCase()} <ArrowRight size={14} /></span></button>)}</div>
        <div className="security-scope-note"><Info size={17} /><div><strong>Cómo interpretar las cifras</strong><p>Los accesos, sesiones, incidentes y revisiones muestran hasta 100 registros recientes por fuente. No representan un total histórico. El contador de cambios de roles sí corresponde al total de su historial.</p>{hasAnyPermission(user, ['consultar_usuarios']) ? <p>Cuentas consultadas: {data.available.includes('users') ? data.users.length : 'no disponible'} · Roles definidos: {data.available.includes('roles') ? data.roles.length : 'no disponible'}</p> : null}</div></div>
      </> : active.id === 'roles' ? <RoleChangeHistory key={revision} /> : loading ? <p className="security-empty" role="status">Actualizando registros de seguridad…</p> : !data.available.includes(active.source) ? <div className="security-source-error" role="alert"><AlertTriangle size={23} /><strong>No se pudo consultar {active.label.toLowerCase()}.</strong><p>Esto no significa que no existan registros. Actualiza para volver a intentar.</p><button type="button" onClick={load}><RefreshCw size={14} /> Volver a intentar</button></div> : <SecurityRecords key={active.id} records={data[active.source]} source={active.source} now={now} />}
    </div></article></div><footer className="security-page-footer"><span><CheckCircle2 size={13} />{updatedAt ? `Última consulta: ${securityDate(updatedAt)}` : 'Consultando las fuentes disponibles…'}</span><span>Fechas en horario de Bolivia · UTC−4</span></footer>
  </section>
}

function SecurityRecords({ records, source, now }) {
  const [filters, setFilters] = useState({ query: '', status: '', date_from: '', date_to: '', page: 1 })
  const [detail, setDetail] = useState(null)
  const filtered = useMemo(() => records.filter((record) => {
    const label = source === 'sessions' ? 'Sesión de usuario' : source === 'reviews' ? record.role_name : eventLabel(record)
    const query = searchable(filters.query)
    const day = securityDay(recordDate(record, source))
    return searchable([label, record.email, record.actor_email, record.user_id, record.responsible, record.title, record.description, record.role_name, humanReason(record.reason)].join(' ')).includes(query)
      && (!filters.status || recordState(record, source, now).value === filters.status)
      && (!filters.date_from || day >= filters.date_from)
      && (!filters.date_to || (day && day <= filters.date_to))
  }).sort((a, b) => (parseSecurityDate(recordDate(b, source))?.getTime() || 0) - (parseSecurityDate(recordDate(a, source))?.getTime() || 0)), [records, source, filters, now])
  const pages = Math.max(1, Math.ceil(filtered.length / 15))
  const page = Math.min(filters.page, pages)
  const shown = filtered.slice((page - 1) * 15, page * 15)
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  const statuses = source === 'sessions' ? [['active', 'Vigentes'], ['expired', 'Vencidas'], ['revoked', 'Cerradas o revocadas'], ['unknown', 'Sin confirmar']]
    : source === 'incidents' ? [['open', 'Abiertos'], ['review', 'En revisión'], ['closed', 'Resueltos']]
      : source === 'reviews' ? [] : [['success', 'Correctos'], ['failed', 'Fallidos'], ['blocked', 'Bloqueados'], ['recorded', 'Registrados']]
  return <><div className="security-record-filters"><label className="security-search"><Search size={16} /><input aria-label="Buscar registros de seguridad" value={filters.query} placeholder="Buscar cuenta, actividad o motivo…" onChange={(event) => update('query', event.target.value)} /></label>{statuses.length ? <label>Estado<select aria-label="Filtrar estado de seguridad" value={filters.status} onChange={(event) => update('status', event.target.value)}><option value="">Todos los estados</option>{statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> : null}<label>Desde<input type="date" aria-label="Registros desde" value={filters.date_from} onChange={(event) => update('date_from', event.target.value)} /></label><label>Hasta<input type="date" aria-label="Registros hasta" value={filters.date_to} onChange={(event) => update('date_to', event.target.value)} /></label></div><p className="security-record-count">{filtered.length} coincidencias en {records.length} registros consultados</p>{shown.length ? <div className="security-table-scroll" tabIndex={0} role="region" aria-label="Registros de seguridad desplazables"><table className="security-table"><thead><tr><th>{source === 'sessions' ? 'Cuenta' : source === 'incidents' ? 'Incidente' : source === 'reviews' ? 'Revisión' : 'Actividad'}</th><th>{source === 'sessions' ? 'Inicio de sesión' : source === 'incidents' ? 'Gravedad' : 'Cuenta o responsable'}</th><th>Estado</th><th>{source === 'sessions' ? 'Vencimiento' : 'Fecha'}</th><th>Detalle</th></tr></thead><tbody>{shown.map((record, index) => <tr key={record.id || index}><td><strong>{source === 'sessions' ? record.email || 'Cuenta no registrada' : source === 'incidents' ? record.title || 'Incidente sin título' : source === 'reviews' ? record.role_name || record.period || 'Revisión de acceso' : eventLabel(record)}</strong><small>{source === 'sessions' ? 'Sesión emitida por LabConnect' : source === 'incidents' ? record.description : source === 'reviews' ? record.period || 'Evaluación de una asignación de acceso' : humanReason(record.reason)}</small></td><td>{source === 'sessions' ? securityDate(record.issued_at || record.created) : source === 'incidents' ? severity(record.severity) : record.actor_email || record.email || record.responsible || (record.user_id ? `Cuenta ${record.user_id}` : 'Sin cuenta identificada')}</td><td><Badge state={recordState(record, source, now)} /></td><td><time>{securityDate(source === 'sessions' ? record.expires_at : recordDate(record, source))}</time></td><td><button type="button" className="security-detail-button" aria-label={`Ver detalle de ${source === 'sessions' ? record.email || 'sesión' : eventLabel(record)}`} onClick={() => setDetail(record)}><Eye size={15} /> Ver</button></td></tr>)}</tbody></table></div> : <div className="security-empty"><ShieldCheck size={29} /><strong>{records.length ? 'No hay coincidencias con esos filtros' : source === 'incidents' ? 'No hay incidentes registrados en esta fuente' : source === 'reviews' ? 'No hay revisiones de acceso registradas' : 'No hay registros disponibles en esta fuente'}</strong><p>{records.length ? 'Prueba con otra búsqueda o un rango de fechas más amplio.' : source === 'reviews' ? 'Esta sección muestra evaluaciones de acceso. Las asignaciones y ediciones automáticas están en «Cambios de roles».' : 'No se encontraron registros en la consulta actual.'}</p></div>}<div className="security-record-pagination"><span>Página {page} de {pages}</span><button type="button" aria-label="Registros anteriores" disabled={page <= 1} onClick={() => setFilters((current) => ({ ...current, page: page - 1 }))}><ChevronLeft size={17} /></button><button type="button" aria-label="Registros siguientes" disabled={page >= pages} onClick={() => setFilters((current) => ({ ...current, page: page + 1 }))}><ChevronRight size={17} /></button></div>
    {detail ? <WorkflowDialog title={source === 'sessions' ? 'Detalle de la sesión' : source === 'incidents' ? 'Detalle del incidente' : source === 'reviews' ? 'Detalle de la revisión de acceso' : eventLabel(detail)} eyebrow="Evidencia de seguridad" description={securityDate(recordDate(detail, source))} icon={source === 'sessions' ? KeyRound : ShieldCheck} onClose={() => setDetail(null)} footer={<button type="button" className="security-button" onClick={() => setDetail(null)}>Cerrar detalle</button>}><div className="security-detail-state"><Badge state={recordState(detail, source, now)} /></div><dl className="security-detail-facts">
      {source === 'sessions' ? <><Fact label="Cuenta" value={detail.email} /><Fact label="Inicio de la sesión" value={securityDate(detail.issued_at || detail.created)} /><Fact label="Vencimiento" value={securityDate(detail.expires_at)} /><Fact label="Revocación" value={detail.revoked_at ? securityDate(detail.revoked_at) : 'No registrada'} /><Fact label="Motivo del cierre" value={detail.reason ? humanReason(detail.reason) : 'No se registró un cierre.'} /></> : source === 'incidents' ? <><Fact label="Incidente" value={detail.title} /><Fact label="Descripción" value={detail.description} /><Fact label="Gravedad" value={severity(detail.severity)} /><Fact label="Responsable del seguimiento" value={detail.responsible} /></> : source === 'reviews' ? <><Fact label="Periodo revisado" value={detail.period} /><Fact label="Rol evaluado" value={detail.role_name} /><Fact label="Cuenta revisada" value={detail.email || detail.user_id} /><Fact label="Responsable de la revisión" value={detail.reviewer_id} /><Fact label="Decisión" value={decisionLabel(detail.decision)} /><Fact label="Observación" value={detail.observation} /></> : <><Fact label="Actividad" value={eventLabel(detail)} /><Fact label="Cuenta o responsable" value={detail.actor_email || detail.email} /><Fact label="Qué ocurrió" value={humanReason(detail.reason)} /><Fact label="Tipo de recurso afectado" value={{ user: 'Cuenta de usuario', laboratory: 'Laboratorio', role: 'Rol' }[detail.target_type] || 'No especificado'} /><Fact label="Recurso afectado" value={detail.target_id} /></>}
    </dl><p className="security-detail-reference">Referencia del registro: {detail.id || 'No disponible'}</p></WorkflowDialog> : null}
  </>
}
function Fact({ label, value }) { return <div><dt>{label}</dt><dd>{value || 'No registrado'}</dd></div> }

export default SecurityAuditPage
