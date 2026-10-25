import { useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, History, Minus, Plus, RefreshCw, Search, UserRound } from 'lucide-react'
import WorkflowDialog from '../../../shared/components/WorkflowDialog'
import { listRoleHistory } from '../../admin/services/rolesService'
import { readablePermission, ROLE_ACTIONS, securityDate } from '../lib/securityPresentation'
import './RoleChangeHistory.css'

function permissions(snapshot) { return snapshot?.permisos || snapshot?.permissions || [] }
function changes(record) {
  const before = permissions(record.before), after = permissions(record.after)
  return { added: after.filter((value) => !before.includes(value)), removed: before.filter((value) => !after.includes(value)) }
}
function snapshotName(snapshot, empty) { return snapshot?.nombre || snapshot?.role_name || empty }

export default function RoleChangeHistory() {
  const [filters, setFilters] = useState({ query: '', action: '', date_from: '', date_to: '', page: 1 })
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      listRoleHistory(filters).then((value) => { if (active) setData(value) })
        .catch((err) => { if (active) setError(err.message) })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [filters, revision])
  const update = (key, value) => { setLoading(true); setError(''); setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 })) }
  const diff = detail ? changes(detail) : { added: [], removed: [] }
  return <div className="role-history">
    <div className="role-history-guide"><History size={20} /><div><strong>Quién cambió los accesos y por qué</strong><p>Cada registro conserva al responsable, su motivo y la configuración anterior y nueva. Este historial se consulta; no permite editar ni borrar evidencia.</p></div></div>
    <div className="role-history-filters"><label className="role-history-search"><Search size={16} /><input aria-label="Buscar cambios de roles" value={filters.query} placeholder="Responsable, persona, rol o motivo…" onChange={(event) => update('query', event.target.value)} /></label><label>Tipo de cambio<select aria-label="Tipo de cambio de rol" value={filters.action} onChange={(event) => update('action', event.target.value)}><option value="">Todos los cambios</option>{Object.entries(ROLE_ACTIONS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Desde<input type="date" aria-label="Cambios de roles desde" value={filters.date_from} onChange={(event) => update('date_from', event.target.value)} /></label><label>Hasta<input type="date" aria-label="Cambios de roles hasta" value={filters.date_to} onChange={(event) => update('date_to', event.target.value)} /></label></div>
    {error ? <div className="security-source-error" role="alert"><strong>No se pudo consultar el historial.</strong><p>{error}</p><button type="button" onClick={() => { setError(''); setLoading(true); setRevision((value) => value + 1) }}><RefreshCw size={14} /> Volver a intentar</button></div> : loading ? <p className="security-empty" role="status">Consultando cambios de roles…</p> : <>
      <div className="role-history-count"><span>{data.totalItems} {data.totalItems === 1 ? 'cambio registrado' : 'cambios registrados'}</span><small>Fechas y filtros en horario de Bolivia</small></div>
      {data.items.length ? <div className="role-history-list">{data.items.map((item) => {
        const difference = changes(item), assignment = item.action.startsWith('user.')
        return <article key={item.id}><div className="role-history-event-icon"><History size={19} /></div><div className="role-history-event-content"><div className="role-history-event-heading"><h3>{ROLE_ACTIONS[item.action] || 'Cambio de acceso registrado'}</h3><time><Clock3 size={12} />{securityDate(item.created)}</time></div><div className="role-history-subject"><strong>{item.role_name || 'Sin rol asignado'}</strong>{item.target_email ? <span>Cuenta afectada: {item.target_email}</span> : <span>Configuración del rol</span>}</div><p className="role-history-actor"><UserRound size={14} /><span>Responsable: <strong>{item.actor_email || 'Identidad no registrada'}</strong></span></p>{assignment ? <div className="role-history-transition"><span>{snapshotName(item.before, 'Sin rol')}</span><ArrowRight size={14} /><span>{snapshotName(item.after, 'Sin rol')}</span></div> : <div className="role-history-deltas"><span><Plus size={13} />{difference.added.length} permisos añadidos</span><span><Minus size={13} />{difference.removed.length} retirados</span></div>}<div className="role-history-reason"><strong>Motivo</strong><p>{item.reason || 'Sin motivo registrado.'}</p></div><button type="button" className="role-history-detail" aria-label={`Ver cambio de ${item.role_name || 'rol'}`} onClick={() => setDetail(item)}>Ver antes y después <ArrowRight size={14} /></button></div></article>
      })}</div> : <div className="security-empty"><History size={30} /><strong>No hay cambios que mostrar</strong><p>{filters.query || filters.action || filters.date_from || filters.date_to ? 'Prueba con otros filtros o un rango de fechas más amplio.' : 'Aquí aparecerán las nuevas creaciones, ediciones y asignaciones de roles. Los cambios anteriores a la implementación del historial no se reconstruyen.'}</p></div>}
      <div className="role-history-pagination"><span>Página {filters.page} de {Math.max(1, data.totalPages)}</span><button type="button" aria-label="Cambios anteriores" disabled={filters.page <= 1} onClick={() => update('page', filters.page - 1)}><ChevronLeft size={17} /></button><button type="button" aria-label="Cambios siguientes" disabled={filters.page >= data.totalPages} onClick={() => update('page', filters.page + 1)}><ChevronRight size={17} /></button></div>
    </>}
    {detail ? <WorkflowDialog title="Detalle del cambio de rol" eyebrow={ROLE_ACTIONS[detail.action] || 'Cambio de acceso'} description={securityDate(detail.created)} icon={History} wide onClose={() => setDetail(null)} footer={<button type="button" className="security-button" onClick={() => setDetail(null)}>Cerrar detalle</button>}>
      <dl className="role-history-facts"><div><dt>Quién lo realizó</dt><dd>{detail.actor_email || 'Sin identidad registrada'}</dd></div><div><dt>Rol que tenía el responsable</dt><dd>{detail.actor_role || 'No registrado'}</dd></div><div><dt>Rol afectado</dt><dd>{detail.role_name || 'Sin rol'}</dd></div><div><dt>Cuenta afectada</dt><dd>{detail.target_email || 'Se modificó la configuración del rol'}</dd></div></dl><div className="role-history-reason"><strong>Motivo declarado por el responsable</strong><p>{detail.reason}</p></div><div className="role-history-comparison">{[['Antes del cambio', detail.before, 'No existía una configuración'], ['Después del cambio', detail.after, 'Sin rol asignado o rol eliminado']].map(([title, snapshot, empty]) => <section key={title}><h3>{title}</h3><strong>{snapshotName(snapshot, empty)}</strong>{snapshot?.descripcion ? <p>{snapshot.descripcion}</p> : null}<span>{permissions(snapshot).length} permisos administrativos</span><details><summary>Consultar permisos de esta configuración</summary>{permissions(snapshot).length ? <ul>{permissions(snapshot).map((value) => <li key={value}><Check size={12} />{readablePermission(value)}</li>)}</ul> : <p>Sin permisos administrativos.</p>}</details></section>)}</div><div className="role-history-permission-diff"><section><h3><Plus size={15} /> Permisos añadidos ({diff.added.length})</h3>{diff.added.length ? <ul>{diff.added.map((value) => <li key={value}>{readablePermission(value)}</li>)}</ul> : <p>No se añadieron permisos.</p>}</section><section><h3><Minus size={15} /> Permisos retirados ({diff.removed.length})</h3>{diff.removed.length ? <ul>{diff.removed.map((value) => <li key={value}>{readablePermission(value)}</li>)}</ul> : <p>No se retiraron permisos.</p>}</section></div><p className="role-history-reference">Referencia del registro: {detail.id}</p>
    </WorkflowDialog> : null}
  </div>
}
