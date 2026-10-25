import { createElement, Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Eye, FlaskConical, History, KeyRound, LayoutGrid, Pencil, Plus, RefreshCw, Search, ShieldCheck, Table2, Trash2, Users } from 'lucide-react'
import WorkflowDialog from '../../../shared/components/WorkflowDialog'
import { assignUserRole, createRole, deleteRole, listPermissionsCatalog, listRoles, listUsersWithRoles, updateRole } from '../services/rolesService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminRolesPage.css'

const SYSTEM_ROLES = new Set(['Administrador', 'Administrador de Accesos', 'OSI - Auditor de Seguridad', 'Estudiante', 'Docente', 'Encargado de Laboratorio', 'Invitado'])
const GROUPS = [
  { id: 'identity', label: 'Usuarios y credenciales', icon: Users },
  { id: 'roles', label: 'Roles y accesos', icon: KeyRound },
  { id: 'labs', label: 'Laboratorios y reservas', icon: CalendarDays },
  { id: 'inventory', label: 'Inventario y préstamos', icon: FlaskConical },
  { id: 'academic', label: 'Clases y tutorías', icon: BookOpen },
  { id: 'reports', label: 'Reportes y estadísticas', icon: Table2 },
  { id: 'security', label: 'Seguridad y auditoría', icon: ShieldCheck },
  { id: 'other', label: 'Otras funciones', icon: LayoutGrid },
]
const EMPTY_ROLE = { nombre: '', descripcion: '', permisos: [] }
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const permissionLabel = (value) => String(value || '').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
const countLabel = (count) => `${count} ${count === 1 ? 'permiso' : 'permisos'}`

function groupFor(value) {
  if (/auditoria|autenticacion|sesiones_usuarios|incidentes_seguridad|revisar_accesos|reportes_seguridad/.test(value)) return 'security'
  if (/roles/.test(value)) return 'roles'
  if (/usuario|cuenta|credencial|directorio/.test(value)) return 'identity'
  if (/tutoria|clase|asistencia/.test(value)) return 'academic'
  if (/inventario|stock|equipo|mantenimiento|prestamo|reactivo|material/.test(value)) return 'inventory'
  if (/reporte|estadistica/.test(value)) return 'reports'
  if (/laboratorio|reserva|penalizacion|horario/.test(value)) return 'labs'
  return 'other'
}

function PermissionIcon({ value, size = 16 }) {
  return createElement(GROUPS.find((group) => group.id === groupFor(value))?.icon || KeyRound, { size, 'aria-hidden': true })
}

function ReasonField({ value, onChange }) {
  return <label className="access-reason">Motivo del cambio <textarea required minLength={5} maxLength={500} rows={2} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Describe por qué realizas este cambio…" /><small>Quedará registrado junto a tu identidad y los valores anteriores y nuevos.</small></label>
}

function AdminRolesPage({ user, onSessionRefresh, onNavigate }) {
  const canEdit = hasAnyPermission(user, ['gestionar_roles'])
  const canAssign = hasAnyPermission(user, ['asignar_roles'])
  const canViewAssignments = canEdit || canAssign || hasAnyPermission(user, ['revisar_accesos_rbac'])
  const canViewHistory = canEdit || canAssign || hasAnyPermission(user, ['revisar_accesos_rbac', 'consultar_auditoria_seguridad'])
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('roles')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editor, setEditor] = useState(null)
  const [draft, setDraft] = useState(EMPTY_ROLE)
  const [permissionSearch, setPermissionSearch] = useState('')
  const [viewRole, setViewRole] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [hiddenRoles, setHiddenRoles] = useState([])
  const [matrixMode, setMatrixMode] = useState('all')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [nextRoles, nextUsers, nextCatalog] = await Promise.all([listRoles(), canViewAssignments ? listUsersWithRoles() : [], listPermissionsCatalog()])
      setRoles(nextRoles); setUsers(nextUsers); setCatalog(nextCatalog)
    } catch (err) { setError(err.message || 'No se pudieron cargar los roles.') }
    finally { setLoading(false) }
  }, [canViewAssignments])
  useEffect(() => { load() }, [load])

  const permissions = useMemo(() => {
    const options = new Map(catalog.map((item) => [item.value, item]))
    roles.forEach((role) => role.permisos.forEach((value) => { if (!options.has(value)) options.set(value, { value, label: permissionLabel(value), legacy: true }) }))
    return [...options.values()]
  }, [catalog, roles])
  const permissionById = new Map(permissions.map((item) => [item.value, item]))
  const labelFor = (value) => permissionById.get(value)?.label || permissionLabel(value)
  const selected = new Set(draft.permisos)
  const visibleRoles = roles.filter((role) => !hiddenRoles.includes(role.id))
  const query = normalize(search)
  const filteredRoles = roles.filter((role) => normalize(role.nombre + ' ' + role.descripcion).includes(query))
  const filteredUsers = users.filter((account) => normalize([account.name, account.email, account.role?.nombre].join(' ')).includes(query))
  const filteredPermissions = permissions.filter((item) => normalize(item.label + ' ' + item.value).includes(query)
    && (moduleFilter === 'all' || groupFor(item.value) === moduleFilter)
    && (matrixMode === 'all' || (matrixMode === 'shared' ? visibleRoles.length > 0 && visibleRoles.every((role) => role.permisos.includes(item.value)) : visibleRoles.some((role) => role.permisos.includes(item.value)))))
  const grouped = (items) => GROUPS.map((group) => ({ ...group, items: items.filter((item) => groupFor(item.value) === group.id) })).filter((group) => group.items.length)
  const viewedRole = roles.find((role) => role.id === viewRole)
  const assignedCount = (id) => users.filter((account) => account.roleId === id).length
  const reasonValid = reason.trim().length >= 5
  const openEditor = (role) => {
    setDraft(role ? { nombre: role.nombre, descripcion: role.descripcion || '', permisos: [...role.permisos] } : EMPTY_ROLE)
    setEditor(role?.id || 'new'); setPermissionSearch(''); setReason(''); setDialogError('')
  }
  const afterChange = async () => {
    await onSessionRefresh?.({ force: true })
    await load()
  }
  const saveRole = async (event) => {
    event.preventDefault()
    if (busy || !reasonValid) return
    setBusy(true); setDialogError('')
    try {
      const payload = { ...draft, nombre: draft.nombre.trim(), descripcion: draft.descripcion.trim(), reason: reason.trim() }
      if (editor === 'new') await createRole(payload)
      else await updateRole(editor, payload)
      setEditor(null); setMessage('Rol guardado. El cambio y su motivo quedaron registrados.'); await afterChange()
    } catch (err) { setDialogError(err.message) } finally { setBusy(false) }
  }
  const saveAssignment = async () => {
    if (busy || !reasonValid) return
    setBusy(true); setDialogError('')
    try {
      await assignUserRole(assignment.account.id, assignment.roleId || null, { reason: reason.trim() })
      setAssignment(null); setMessage('Asignación actualizada y registrada en el historial.'); await afterChange()
    } catch (err) { setDialogError(err.message) } finally { setBusy(false) }
  }
  const removeRole = async () => {
    if (busy || !reasonValid) return
    setBusy(true); setDialogError('')
    try {
      await deleteRole(deleteTarget.id, { reason: reason.trim() })
      setDeleteTarget(null); setMessage('Rol eliminado. Se conserva el historial de sus cambios.'); await afterChange()
    } catch (err) { setDialogError(err.message) } finally { setBusy(false) }
  }
  const tabs = [{ id: 'roles', label: 'Roles', icon: ShieldCheck }, ...(canViewAssignments ? [{ id: 'users', label: 'Asignaciones', icon: Users }] : []), { id: 'matrix', label: 'Matriz de accesos', icon: Table2 }]

  return <section className="access-page" aria-label="Administración de roles">
    <header className="access-header"><div><p className="access-eyebrow">Administración de accesos</p><h1>Roles y permisos</h1><p>Define responsabilidades, compara accesos y consulta quién realizó cada cambio.</p></div><div className="access-header-actions"><button type="button" className="access-button is-secondary" disabled={loading} onClick={load}><RefreshCw size={15} /> Actualizar</button>{canViewHistory ? <a className="access-button is-secondary" href="/app/seguridad#roles" onClick={(event) => { if (onNavigate) { event.preventDefault(); onNavigate('/app/seguridad#roles') } }}><History size={15} /> Historial en Seguridad</a> : null}{canEdit ? <button type="button" className="access-button is-primary" onClick={() => openEditor()}><Plus size={16} /> Crear rol</button> : null}</div></header>
    <div className="access-stats"><div><span className="access-stat-icon"><ShieldCheck size={21} /></span><span><strong>{roles.length}</strong><small>Roles configurados</small></span></div><div><span className="access-stat-icon is-teal"><KeyRound size={21} /></span><span><strong>{permissions.length}</strong><small>Funciones independientes</small></span></div>{canViewAssignments ? <div><span className="access-stat-icon"><Users size={21} /></span><span><strong>{users.filter((account) => account.roleId).length}</strong><small>Personas con rol asignado</small></span></div> : null}<div><span className="access-stat-icon is-gold"><History size={21} /></span><span><strong className="access-stat-word">Trazabilidad</strong><small>Responsable, motivo y detalle</small></span></div></div>
    {message ? <p className="access-alert is-success" role="status">{message}</p> : null}{error ? <p className="access-alert is-error" role="alert">{error}</p> : null}
    <div className="access-workspace"><div className="access-workspace-toolbar"><div className="access-tabs" role="tablist" aria-label="Vistas de roles" onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const buttons = [...event.currentTarget.querySelectorAll('[role="tab"]')]
      const index = buttons.indexOf(document.activeElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
      event.preventDefault(); buttons[next].focus(); buttons[next].click()
    }}>{tabs.map(({ id, label, icon }) => <button key={id} type="button" role="tab" id={`access-tab-${id}`} aria-selected={tab === id} aria-controls="access-panel" tabIndex={tab === id ? 0 : -1} onClick={() => { setTab(id); setSearch('') }}>{createElement(icon, { size: 16 })}{label}</button>)}</div>{tab !== 'history' ? <label className="access-search"><Search size={16} /><input aria-label={tab === 'matrix' ? 'Buscar permiso en matriz' : tab === 'users' ? 'Buscar usuario' : 'Buscar rol'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'matrix' ? 'Buscar funcionalidad…' : 'Buscar…'} /></label> : null}</div>
      <div id="access-panel" role="tabpanel" aria-labelledby={`access-tab-${tab}`}>
        {loading ? <p className="access-empty" role="status">Cargando roles y accesos…</p> : error ? <p className="access-empty">Actualiza para volver a intentar.</p> : <>
          {tab === 'roles' ? <><div className="access-section-heading"><div><h2>Responsabilidades del sistema</h2><p>Cada rol reúne las funciones de una responsabilidad. Todos se pueden asignar y configurar con los permisos correspondientes.</p></div><span>{filteredRoles.length} roles</span></div><div className="access-role-grid">{filteredRoles.map((role, index) => <article className={`access-role-card access-role-tone-${index % 4}`} key={role.id}><div className="access-role-top"><span className="access-role-icon"><ShieldCheck size={23} /></span><span className="access-role-kind">{SYSTEM_ROLES.has(role.nombre) ? 'Perfil base' : 'Personalizado'}</span></div><h3>{role.nombre}</h3><p className="access-role-description">{role.descripcion || 'Configura las funciones de esta responsabilidad.'}</p><div className="access-role-meta"><span><KeyRound size={13} />{countLabel(role.permisos.length)}</span>{canViewAssignments ? <span><Users size={13} />{assignedCount(role.id)} personas</span> : null}</div><div className="access-card-permissions">{[...new Set(role.permisos.map(groupFor))].slice(0, 5).map((id) => <span className="access-module-chip" key={id} title={GROUPS.find((g) => g.id === id)?.label}>{createElement(GROUPS.find((g) => g.id === id)?.icon || KeyRound, { size: 15 })}</span>)}{!role.permisos.length ? <span className="access-no-permissions">Autoservicio según su perfil</span> : null}</div><footer><button type="button" className="access-text-button" onClick={() => { setViewRole(role.id); setPermissionSearch('') }}><Eye size={15} /> Ver permisos</button><div>{canEdit ? <button type="button" className="access-icon-button" aria-label={`Editar ${role.nombre}`} onClick={() => openEditor(role)}><Pencil size={15} /></button> : null}{canEdit && !SYSTEM_ROLES.has(role.nombre) ? <button type="button" className="access-icon-button is-danger" aria-label={`Eliminar ${role.nombre}`} onClick={() => { setDeleteTarget(role); setReason(''); setDialogError('') }}><Trash2 size={15} /></button> : null}</div></footer></article>)}</div>{!filteredRoles.length ? <p className="access-empty">No hay roles que coincidan con la búsqueda.</p> : null}</> : null}
          {tab === 'users' && canViewAssignments ? <><div className="access-section-heading"><div><h2>Asignaciones por persona</h2><p>{canAssign ? 'Puedes asignar cualquier rol. Cada modificación requiere un motivo y queda registrada.' : 'Consulta de las responsabilidades actuales.'}</p></div><span>{filteredUsers.length} personas</span></div><div className="access-table-scroll"><table className="access-user-table"><thead><tr><th>Persona</th><th>Rol actual</th><th>Permisos</th><th>Acción</th></tr></thead><tbody>{filteredUsers.map((account) => <tr key={account.id}><td><div className="access-person"><span>{String(account.name || account.email).slice(0, 1).toUpperCase()}</span><div><strong>{account.name || 'Sin nombre'}{account.id === user?.user_id ? <small>Tu cuenta</small> : null}</strong><small>{account.email}</small></div></div></td><td><span className="access-user-role"><ShieldCheck size={13} />{account.role?.nombre || 'Sin rol'}</span></td><td>{countLabel(account.role?.permisos.length || 0)}</td><td>{canAssign ? <button type="button" className="access-button is-secondary" onClick={() => { setAssignment({ account, roleId: account.roleId || '' }); setReason(''); setDialogError('') }}>Cambiar rol <ArrowRight size={14} /></button> : <span className="access-muted">Consulta</span>}</td></tr>)}</tbody></table></div>{!filteredUsers.length ? <p className="access-empty">No hay personas que coincidan con la búsqueda.</p> : null}</> : null}
          {tab === 'matrix' ? <><div className="access-section-heading"><div><h2>Matriz de accesos</h2><p>Filtra módulos y compara únicamente los roles que necesitas.</p></div><span className="access-matrix-legend"><Check size={14} /> Permitido <span>— Sin permiso</span></span></div><div className="access-matrix-filters"><label>Módulo<select aria-label="Filtrar módulo" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="all">Todos los módulos</option>{GROUPS.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label><label>Mostrar<select aria-label="Filtrar coincidencias" value={matrixMode} onChange={(event) => setMatrixMode(event.target.value)}><option value="all">Todas las funciones</option><option value="any">Con acceso en algún rol</option><option value="shared">Compartidas por los roles visibles</option></select></label><span>{filteredPermissions.length} funciones · {visibleRoles.length} roles</span></div><div className="access-role-picker" aria-label="Roles visibles en la matriz">{roles.map((role) => <label key={role.id} className={!hiddenRoles.includes(role.id) ? 'is-selected' : ''}><input type="checkbox" checked={!hiddenRoles.includes(role.id)} onChange={() => setHiddenRoles((current) => current.includes(role.id) ? current.filter((id) => id !== role.id) : [...current, role.id])} />{role.nombre}</label>)}</div>{visibleRoles.length ? <div className="access-matrix-scroll" tabIndex={0} role="region" aria-label="Matriz de accesos desplazable"><table className="access-matrix"><thead><tr><th scope="col">Funcionalidad<small>Permisos agrupados por módulo</small></th>{visibleRoles.map((role) => <th scope="col" key={role.id}><span>{role.nombre}</span><small>{countLabel(role.permisos.length)}</small>{canEdit ? <button type="button" aria-label={`Editar permisos de ${role.nombre}`} onClick={() => openEditor(role)}><Pencil size={12} /> Editar</button> : null}</th>)}</tr></thead><tbody>{grouped(filteredPermissions).map((group) => <Fragment key={group.id}><tr className="access-matrix-group"><th colSpan={visibleRoles.length + 1}><span>{createElement(group.icon, { size: 15 })}{group.label}<small>{group.items.length} funciones</small></span></th></tr>{group.items.map((item) => <tr key={item.value}><th scope="row"><span className="access-matrix-function"><PermissionIcon value={item.value} /><span>{item.label}<small>{item.value}</small></span></span></th>{visibleRoles.map((role) => <td key={role.id} aria-label={`${role.nombre}: ${role.permisos.includes(item.value) ? 'permitido' : 'sin permiso'}`}>{role.permisos.includes(item.value) ? <span className="access-matrix-check"><Check size={15} /></span> : <span className="access-matrix-denied">—</span>}</td>)}</tr>)}</Fragment>)}</tbody></table>{!filteredPermissions.length ? <p className="access-empty">No hay funciones que coincidan con los filtros.</p> : null}</div> : <p className="access-empty">Selecciona al menos un rol para comparar sus accesos.</p>}</> : null}
        </>}
      </div>
    </div>
    {editor ? <WorkflowDialog title={editor === 'new' ? 'Crear rol' : `Editar ${draft.nombre}`} eyebrow="Configurar responsabilidad" icon={ShieldCheck} description="Selecciona las funciones de este rol. El historial conservará la configuración anterior y la nueva." wide busy={busy} onClose={() => setEditor(null)} footer={<><span className="access-selection-count">{countLabel(draft.permisos.length)} seleccionados</span><button type="button" className="access-button is-secondary" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button type="submit" form="access-role-form" className="access-button is-primary" disabled={busy || !reasonValid || !draft.nombre.trim()}>{busy ? 'Guardando…' : 'Guardar cambios'}<Check size={15} /></button></>}>
      {dialogError ? <p className="workflow-dialog-error" role="alert">{dialogError}</p> : null}<form id="access-role-form" className="access-editor" onSubmit={saveRole}><div className="access-editor-fields"><label>Nombre del rol<input required maxLength={100} value={draft.nombre} readOnly={editor !== 'new' && SYSTEM_ROLES.has(draft.nombre)} onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))} />{editor !== 'new' && SYSTEM_ROLES.has(draft.nombre) ? <small>Nombre estable del perfil. Sus permisos y descripción son editables.</small> : null}</label><label>Descripción<input maxLength={500} value={draft.descripcion} onChange={(event) => setDraft((current) => ({ ...current, descripcion: event.target.value }))} /></label></div><div className="access-editor-heading"><div><h3>Permisos por módulo</h3><p>Activa o retira cada función de forma independiente.</p></div><label className="access-search"><Search size={15} /><input aria-label="Buscar permiso" placeholder="Buscar función…" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} /></label></div><div className="access-permission-groups">{grouped(permissions.filter((item) => normalize(item.label + ' ' + item.value).includes(normalize(permissionSearch)))).map((group) => <details key={group.id} className="access-permission-group" open><summary><span className="access-group-icon">{createElement(group.icon, { size: 17 })}</span><strong>{group.label}</strong><span>{group.items.filter((item) => selected.has(item.value)).length}/{group.items.length}</span><ChevronDown size={15} /></summary><div className="access-permission-options">{group.items.map((item) => <label key={item.value} className={`access-permission-option${selected.has(item.value) ? ' is-selected' : ''}`}><span className="access-option-icon"><PermissionIcon value={item.value} /></span><span><strong>{item.label}</strong><small>{item.legacy ? 'Permiso heredado: puede conservarse o retirarse.' : item.description}</small></span><input type="checkbox" aria-label={item.label} checked={selected.has(item.value)} onChange={() => setDraft((current) => ({ ...current, permisos: current.permisos.includes(item.value) ? current.permisos.filter((value) => value !== item.value) : [...current.permisos, item.value] }))} /></label>)}</div></details>)}</div><ReasonField value={reason} onChange={setReason} /></form>
    </WorkflowDialog> : null}
    {viewedRole ? <WorkflowDialog title={viewedRole.nombre} eyebrow="Permisos actuales" icon={ShieldCheck} description={viewedRole.descripcion} wide onClose={() => setViewRole(null)} footer={<button type="button" className="access-button is-secondary" onClick={() => setViewRole(null)}>Cerrar</button>}><div className="access-view-permissions">{viewedRole.permisos.map((value) => <div key={value}><PermissionIcon value={value} /><div><strong>{labelFor(value)}</strong><small>{permissionById.get(value)?.description}</small></div><Check size={14} /></div>)}{!viewedRole.permisos.length ? <p className="access-empty">Este perfil no tiene permisos administrativos adicionales.</p> : null}</div></WorkflowDialog> : null}
    {assignment ? <WorkflowDialog title="Cambiar rol" eyebrow="Asignación de acceso" icon={Users} description="Todos los roles están disponibles. El cambio quedará asociado a tu identidad." busy={busy} onClose={() => setAssignment(null)} footer={<><button type="button" className="access-button is-secondary" disabled={busy} onClick={() => setAssignment(null)}>Cancelar</button><button type="button" className="access-button is-primary" disabled={busy || !reasonValid || assignment.roleId === (assignment.account.roleId || '')} onClick={saveAssignment}>{busy ? 'Guardando…' : 'Confirmar asignación'}<Check size={15} /></button></>}>
      {dialogError ? <p className="workflow-dialog-error" role="alert">{dialogError}</p> : null}<div className="access-assignment-person"><span className="access-role-icon"><Users size={23} /></span><div><strong>{assignment.account.name || 'Usuario'}</strong><small>{assignment.account.email}</small></div></div><div className="access-assignment-current"><span>Rol actual</span><strong>{assignment.account.role?.nombre || 'Sin rol'}</strong></div><label className="access-assignment-field">Nuevo rol<select aria-label="Nuevo rol" value={assignment.roleId} onChange={(event) => setAssignment((current) => ({ ...current, roleId: event.target.value }))}><option value="">Sin rol asignado</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}</select></label><ReasonField value={reason} onChange={setReason} /><p className="access-context-note">Debe permanecer al menos una cuenta activa que pueda gestionar y asignar roles.</p>
    </WorkflowDialog> : null}
    {deleteTarget ? <WorkflowDialog title="Eliminar rol" eyebrow="Confirmar eliminación" icon={Trash2} busy={busy} onClose={() => setDeleteTarget(null)} footer={<><button type="button" className="access-button is-secondary" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancelar</button><button type="button" className="access-button is-danger" disabled={busy || !reasonValid} onClick={removeRole}>Eliminar rol</button></>}>
      {dialogError ? <p className="workflow-dialog-error" role="alert">{dialogError}</p> : null}<p className="access-delete-copy">Eliminarás <strong>{deleteTarget.nombre}</strong>. Primero debe quedar sin usuarios asignados. Su historial se conservará.</p><ReasonField value={reason} onChange={setReason} />
    </WorkflowDialog> : null}
  </section>
}

export default AdminRolesPage
