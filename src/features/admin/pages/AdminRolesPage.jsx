import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Check, ChevronDown, Eye, FlaskConical, KeyRound, LayoutGrid, LockKeyhole, Pencil, Plus, RefreshCw, Search, ShieldCheck, ShieldPlus, Table2, Trash2, Users, X } from 'lucide-react'
import WorkflowDialog from '../../../shared/components/WorkflowDialog'
import {
  assignUserRole,
  createRole,
  deleteRole,
  listPermissionsCatalog,
  listRoles,
  listUsersWithRoles,
  updateRole,
} from '../services/rolesService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminRolesPage.css'

const PRIVILEGED_ROLE_NAMES = new Set(['Administrador', 'Administrador de Accesos', 'OSI - Auditor de Seguridad'])
const SYSTEM_ROLE_NAMES = new Set([...PRIVILEGED_ROLE_NAMES, 'Estudiante', 'Docente', 'Encargado de Laboratorio', 'Invitado'])
const PRIVILEGED_PERMISSION_NAMES = new Set([
  'aprobar_clases',
  'modificar_usuarios', 'dar_baja_usuarios', 'desbloquear_usuarios', 'reiniciar_credenciales',
  'gestionar_roles', 'asignar_roles', 'consultar_auditoria_seguridad', 'consultar_eventos_autenticacion',
  'consultar_sesiones_usuarios', 'consultar_incidentes_seguridad', 'revisar_accesos_rbac', 'exportar_reportes_seguridad',
])

const PERMISSION_ICONS = {
  gestionar_clases_propias: '📚', aprobar_clases: '✅',
  modificar_usuarios: '✏️', dar_baja_usuarios: '⛔', desbloquear_usuarios: '🔓', reiniciar_credenciales: '🗝️',
  consultar_usuarios: '👥', gestionar_usuarios: '🧑‍💼', gestionar_estado_cuentas: '🔐', consultar_directorio_operativo: '📇',
  consultar_roles: '🪪', gestionar_roles: '🛡️', asignar_roles: '🔑', iniciar_restablecimiento_credencial: '🔄',
  gestionar_reservas: '📅', gestionar_reservas_materiales: '📦', gestionar_reglas_reserva: '📋',
  gestionar_estructura_laboratorios: '🏢', gestionar_horarios_laboratorio: '🕒', gestionar_accesos_laboratorio: '🚪',
  gestionar_penalizaciones: '⚠️', gestionar_inventario: '🧰', gestionar_stock: '📊', gestionar_estado_equipos: '🖥️',
  gestionar_mantenimiento: '🛠️', gestionar_prestamos: '🤝', gestionar_reactivos_quimicos: '🧪',
  registrar_tickets_equipo: '🎫',
  gestionar_tutorias_propias: '🎓', aprobar_tutorias: '✅', gestionar_asistencia_tutorias: '📝',
  gestionar_observaciones_tutorias: '💬', solicitar_recursos_clase: '📨', generar_reportes: '📄', consultar_estadisticas: '📈',
  consultar_auditoria_seguridad: '🔎', consultar_eventos_autenticacion: '🔓', consultar_sesiones_usuarios: '💻',
  consultar_incidentes_seguridad: '🚨', revisar_accesos_rbac: '🧭', exportar_reportes_seguridad: '📤',
}

const FALLBACK_PERMISSION_OPTIONS = [
  'gestionar_clases_propias', 'aprobar_clases',
  'consultar_usuarios', 'consultar_directorio_operativo',
  'modificar_usuarios', 'dar_baja_usuarios', 'desbloquear_usuarios', 'reiniciar_credenciales',
  'consultar_roles', 'gestionar_roles', 'asignar_roles',
  'gestionar_reservas', 'gestionar_reservas_materiales', 'gestionar_reglas_reserva',
  'gestionar_estructura_laboratorios', 'gestionar_horarios_laboratorio', 'gestionar_accesos_laboratorio',
  'gestionar_penalizaciones', 'gestionar_inventario', 'gestionar_stock', 'gestionar_estado_equipos',
  'gestionar_mantenimiento', 'registrar_tickets_equipo', 'gestionar_prestamos', 'gestionar_reactivos_quimicos',
  'gestionar_tutorias_propias', 'aprobar_tutorias', 'gestionar_asistencia_tutorias',
  'gestionar_observaciones_tutorias', 'solicitar_recursos_clase', 'generar_reportes', 'consultar_estadisticas',
  'consultar_auditoria_seguridad', 'consultar_eventos_autenticacion', 'consultar_sesiones_usuarios',
  'consultar_incidentes_seguridad', 'revisar_accesos_rbac', 'exportar_reportes_seguridad',
].map((value) => ({ value, label: value.replaceAll('_', ' '), description: 'Permiso RBAC de LabConnect.', icon: getPermissionIcon(value) }))

function getPermissionIcon(value) {
  if (PERMISSION_ICONS[value]) return PERMISSION_ICONS[value]
  if (/tutoria|clase|asistencia/.test(value)) return '🎓'
  if (/equipo|inventario|mantenimiento/.test(value)) return '🧰'
  if (/stock|material|reactivo/.test(value)) return '📦'
  if (/usuario|cuenta|credencial/.test(value)) return '👤'
  if (/reserva|horario|laboratorio/.test(value)) return '📅'
  if (/reporte|estadistica/.test(value)) return '📊'
  return '🔑'
}

const PERMISSION_GROUPS = [
  { id: 'identity', label: 'Usuarios y credenciales', icon: Users },
  { id: 'roles', label: 'Roles y accesos', icon: KeyRound },
  { id: 'labs', label: 'Laboratorios y reservas', icon: FlaskConical },
  { id: 'inventory', label: 'Inventario y préstamos', icon: LayoutGrid },
  { id: 'academic', label: 'Clases y tutorías', icon: BookOpen },
  { id: 'reports', label: 'Reportes y estadísticas', icon: Table2 },
  { id: 'security', label: 'Seguridad y auditoría', icon: ShieldCheck },
  { id: 'other', label: 'Otras funciones', icon: KeyRound },
]

function permissionGroup(value) {
  if (/auditoria|autenticacion|sesiones_usuarios|incidentes_seguridad|revisar_accesos|reportes_seguridad/.test(value)) return 'security'
  if (/roles/.test(value)) return 'roles'
  if (/usuario|cuenta|credencial|directorio/.test(value)) return 'identity'
  if (/tutoria|clase|asistencia/.test(value)) return 'academic'
  if (/inventario|stock|equipo|mantenimiento|prestamo|reactivo|material/.test(value)) return 'inventory'
  if (/reporte|estadistica/.test(value)) return 'reports'
  if (/laboratorio|reserva|penalizacion/.test(value)) return 'labs'
  return 'other'
}

function searchable(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function permissionLabel(value) {
  const label = String(value || '').replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function permissionCount(count) {
  return count + (count === 1 ? ' permiso' : ' permisos')
}

const EMPTY_ROLE = { nombre: '', descripcion: '', permisos: [] }

function AdminRolesPage({ user, onSessionRefresh }) {
  const canEdit = hasAnyPermission(user, ['gestionar_roles'])
  const canAssign = hasAnyPermission(user, ['asignar_roles'])
  const canViewAssignments = canAssign || hasAnyPermission(user, ['revisar_accesos_rbac'])
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [catalog, setCatalog] = useState(FALLBACK_PERMISSION_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('roles')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editor, setEditor] = useState(null)
  const [draft, setDraft] = useState(EMPTY_ROLE)
  const [permissionSearch, setPermissionSearch] = useState('')
  const [viewRole, setViewRole] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [nextRoles, nextUsers, nextCatalog] = await Promise.all([
        listRoles(), canViewAssignments ? listUsersWithRoles() : Promise.resolve([]),
        listPermissionsCatalog().catch(() => FALLBACK_PERMISSION_OPTIONS),
      ])
      setRoles(nextRoles); setUsers(nextUsers)
      setCatalog(Array.isArray(nextCatalog) && nextCatalog.length ? nextCatalog : FALLBACK_PERMISSION_OPTIONS)
    } catch (err) { setError(err.message || 'No se pudieron cargar los roles.') }
    finally { setLoading(false) }
  }, [canViewAssignments])

  useEffect(() => { load() }, [load])

  // Include stored permissions absent from the current catalog so the matrix
  // remains an accurate view and editing never silently discards them.
  const permissions = useMemo(() => {
    const options = new Map(catalog.map((item) => [item.value, item]))
    roles.forEach((role) => (role.permisos || []).forEach((value) => {
      if (!options.has(value)) options.set(value, { value, label: permissionLabel(value), description: 'Permiso registrado en este rol.' })
    }))
    return [...options.values()]
  }, [catalog, roles])

  const permissionById = useMemo(() => new Map(permissions.map((item) => [item.value, item])), [permissions])
  const labelFor = (value) => permissionById.get(value)?.label || permissionLabel(value)
  const query = searchable(search)
  const filteredRoles = roles.filter((role) => searchable(role.nombre + ' ' + (role.descripcion || '')).includes(query))
  const filteredUsers = users.filter((account) => searchable([account.name, account.email, account.role?.nombre].join(' ')).includes(query))
  const filteredPermissions = permissions.filter((item) => searchable(item.label + ' ' + item.value).includes(query))
  const selected = new Set(draft.permisos)
  const catalogIds = new Set(catalog.map((item) => item.value))
  const editorGroups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: permissions.filter((item) => permissionGroup(item.value) === group.id && searchable(item.label + ' ' + item.description).includes(searchable(permissionSearch))),
  })).filter((group) => group.items.length)
  const roleBeingViewed = roles.find((role) => role.id === viewRole)
  const assignedCount = (roleId) => users.filter((account) => account.roleId === roleId || account.role?.id === roleId).length
  const accessAdminExists = users.some((account) => account.role?.nombre === 'Administrador de Accesos')

  const canChangeAccount = (account) => {
    const self = account.id === user?.user_id || searchable(account.email) === searchable(user?.username)
    if (!canAssign || self) return false
    if (!PRIVILEGED_ROLE_NAMES.has(account.role?.nombre)) return true
    return user?.role === 'Administrador' && account.role?.nombre === 'Administrador' && !accessAdminExists
  }
  const choicesFor = (account) => roles.filter((role) => {
    if (!PRIVILEGED_ROLE_NAMES.has(role.nombre)) return !PRIVILEGED_ROLE_NAMES.has(account.role?.nombre)
    if (role.nombre === 'Administrador de Accesos') return user?.role === 'Administrador' && account.role?.nombre === 'Administrador' && !accessAdminExists
    return role.nombre === 'OSI - Auditor de Seguridad' && user?.role === 'Administrador de Accesos' && !PRIVILEGED_ROLE_NAMES.has(account.role?.nombre)
  })

  const openEditor = (role) => {
    setDialogError(''); setPermissionSearch('')
    setDraft(role ? { nombre: role.nombre, descripcion: role.descripcion || '', permisos: [...(role.permisos || [])] } : EMPTY_ROLE)
    setEditor(role ? role.id : 'new')
  }

  const togglePermission = (value) => {
    setDraft((current) => ({ ...current, permisos: current.permisos.includes(value) ? current.permisos.filter((item) => item !== value) : [...current.permisos, value] }))
  }

  const saveRole = async (event) => {
    event.preventDefault()
    if (busy || !draft.nombre.trim()) return
    setBusy(true); setDialogError(''); setMessage('')
    try {
      const payload = { ...draft, nombre: draft.nombre.trim(), descripcion: draft.descripcion.trim() }
      const saved = editor === 'new' ? await createRole(payload) : await updateRole(editor, payload)
      setRoles((current) => editor === 'new' ? [saved, ...current] : current.map((role) => role.id === saved.id ? saved : role))
      setUsers((current) => current.map((account) => account.roleId === saved.id || account.role?.id === saved.id ? { ...account, role: saved } : account))
      setEditor(null); setMessage(editor === 'new' ? 'Rol creado correctamente.' : 'Rol actualizado correctamente.')
      await onSessionRefresh?.()
    } catch (err) { setDialogError(err.message || 'No se pudo guardar el rol.') }
    finally { setBusy(false) }
  }

  const removeRole = async () => {
    if (busy) return
    setBusy(true); setDialogError('')
    try {
      await deleteRole(deleteTarget.id)
      setRoles((current) => current.filter((role) => role.id !== deleteTarget.id))
      setDeleteTarget(null); setMessage('Rol eliminado correctamente.')
    } catch (err) { setDialogError(err.message || 'No se pudo eliminar el rol.') }
    finally { setBusy(false) }
  }

  const saveAssignment = async () => {
    if (busy) return
    setBusy(true); setDialogError('')
    try {
      await assignUserRole(assignment.account.id, assignment.roleId || null)
      const role = roles.find((item) => item.id === assignment.roleId) || null
      setUsers((current) => current.map((account) => account.id === assignment.account.id ? { ...account, roleId: role?.id || null, role } : account))
      setAssignment(null); setMessage('Asignación actualizada correctamente.')
      await onSessionRefresh?.()
      await load()
    } catch (err) { setDialogError(err.message || 'No se pudo asignar el rol.') }
    finally { setBusy(false) }
  }

  const tabs = [
    { id: 'roles', label: 'Roles', icon: ShieldCheck, count: roles.length },
    ...(canViewAssignments ? [{ id: 'users', label: 'Asignaciones', icon: Users, count: users.length }] : []),
    { id: 'matrix', label: 'Matriz de accesos', icon: Table2 },
  ]

  return <section className="access-page" aria-label="Administración de roles">
    <header className="access-header">
      <div><p className="access-eyebrow">Administración de accesos</p><h1>Roles y permisos</h1><p>Define qué puede hacer cada persona, según su responsabilidad.</p></div>
      <div className="access-header-actions"><button className="access-button is-secondary" type="button" onClick={load} disabled={loading} aria-label="Actualizar roles"><RefreshCw size={16} className={loading ? 'access-spin' : ''} /> Actualizar</button>{canEdit ? <button type="button" className="access-button is-primary" onClick={() => openEditor()} disabled={loading}><Plus size={17} /> Crear rol</button> : null}</div>
    </header>
    <div className="access-stats">
      <div><span className="access-stat-icon"><ShieldCheck size={20} /></span><span><strong>{roles.length}</strong><small>Roles registrados</small></span></div>
      <div><span className="access-stat-icon is-teal"><KeyRound size={20} /></span><span><strong>{permissions.length}</strong><small>Permisos disponibles</small></span></div>
      <div><span className="access-stat-icon is-gold"><LockKeyhole size={20} /></span><span><strong>{roles.filter((role) => PRIVILEGED_ROLE_NAMES.has(role.nombre)).length}</strong><small>Roles protegidos</small></span></div>
      {canViewAssignments ? <div><span className="access-stat-icon"><Users size={20} /></span><span><strong>{users.filter((account) => account.roleId || account.role).length}</strong><small>Usuarios con rol</small></span></div> : null}
    </div>
    <div className="access-workspace">
      <div className="access-workspace-toolbar">
        <div className="access-tabs" role="tablist" aria-label="Vistas de roles" onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          const buttons = [...event.currentTarget.querySelectorAll('[role="tab"]')]
          const index = buttons.indexOf(document.activeElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
          event.preventDefault(); buttons[next].focus(); buttons[next].click()
        }}>
          {tabs.map(({ id, label, icon, count }) => <button key={id} id={'access-tab-' + id} type="button" role="tab" aria-selected={tab === id} aria-controls="access-panel" tabIndex={tab === id ? 0 : -1} onClick={() => { setTab(id); setSearch('') }}>{createElement(icon, { size: 16 })}{label}{count !== undefined ? <span>{count}</span> : null}</button>)}
        </div>
        <label className="access-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'users' ? 'Buscar persona o rol…' : tab === 'matrix' ? 'Buscar permiso…' : 'Buscar rol…'} aria-label={tab === 'users' ? 'Buscar usuario' : tab === 'matrix' ? 'Buscar permiso en matriz' : 'Buscar rol'} />{search ? <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button> : null}</label>
      </div>
      {error ? <p className="access-feedback is-error" role="alert">{error}</p> : null}
      {message ? <p className="access-feedback is-success" role="status">{message}</p> : null}
      <div id="access-panel" role="tabpanel" aria-labelledby={'access-tab-' + tab}>
        {loading ? <div className="access-empty"><RefreshCw size={24} className="access-spin" /><h2>Cargando accesos</h2><p>Consultando roles y permisos del sistema…</p></div> : <>
          {tab === 'roles' ? <>
            <div className="access-section-heading"><div><h2>Roles del sistema</h2><p>Consulta sus capacidades o configura un rol personalizado.</p></div><span>{filteredRoles.length} roles</span></div>
            <div className="access-role-grid">{filteredRoles.map((role) => {
              const protectedRole = PRIVILEGED_ROLE_NAMES.has(role.nombre)
              const Icon = protectedRole ? ShieldCheck : SYSTEM_ROLE_NAMES.has(role.nombre) ? Users : ShieldPlus
              return <article className="access-role-card" key={role.id}>
                <div className="access-card-top"><span className={'access-role-icon' + (protectedRole ? ' is-protected' : '')}><Icon size={23} strokeWidth={1.7} /></span><span className={'access-type' + (protectedRole ? ' is-protected' : '')}>{protectedRole ? <LockKeyhole size={11} /> : null}{protectedRole ? 'Protegido' : SYSTEM_ROLE_NAMES.has(role.nombre) ? 'Institucional' : 'Personalizado'}</span></div>
                <h3>{role.nombre}</h3><p className="access-role-description">{role.descripcion || 'Accesos definidos según las funciones asignadas.'}</p>
                <div className="access-role-meta"><span><KeyRound size={13} />{permissionCount((role.permisos || []).length)}</span>{canViewAssignments ? <span><Users size={13} />{assignedCount(role.id)} usuarios</span> : null}</div>
                <div className="access-card-permissions">{(role.permisos || []).slice(0, 5).map((value) => <span className="roles-badge access-permission-mini" key={value} title={labelFor(value)} aria-label={labelFor(value)}>{getPermissionIcon(value)}</span>)}{(role.permisos || []).length > 5 ? <span className="access-more">+{role.permisos.length - 5}</span> : null}{!(role.permisos || []).length ? <span className="access-no-permissions">Autoservicio según su perfil</span> : null}</div>
                <footer><button type="button" className="access-text-button" onClick={() => { setViewRole(role.id); setPermissionSearch('') }}><Eye size={15} /> Ver permisos</button><div>{canEdit && !protectedRole ? <button type="button" className="access-icon-button" aria-label={'Editar ' + role.nombre} title="Editar rol" onClick={() => openEditor(role)}><Pencil size={15} /></button> : null}{canEdit && !SYSTEM_ROLE_NAMES.has(role.nombre) ? <button type="button" className="access-icon-button is-danger" aria-label={'Eliminar ' + role.nombre} title="Eliminar rol" onClick={() => { setDeleteTarget(role); setDialogError('') }}><Trash2 size={15} /></button> : null}{protectedRole ? <span className="access-protected-note"><LockKeyhole size={12} /> Acceso controlado</span> : null}</div></footer>
              </article>
            })}</div>
            {!filteredRoles.length ? <div className="access-empty"><ShieldCheck size={28} /><h2>No encontramos roles</h2><p>Prueba con otro nombre o crea un rol nuevo.</p></div> : null}
          </> : null}
          {tab === 'users' && canViewAssignments ? <>
            <div className="access-section-heading"><div><h2>Asignación de roles</h2><p>{canAssign ? 'Selecciona una persona y confirma el rol que le corresponde.' : 'Consulta de solo lectura de los accesos asignados.'}</p></div><span>{filteredUsers.length} personas</span></div>
            <div className="access-table-scroll"><table className="access-user-table"><thead><tr><th>Persona</th><th>Rol actual</th><th>Permisos</th><th>Acción</th></tr></thead><tbody>{filteredUsers.map((account) => <tr key={account.id}><td><div className="access-person"><span>{String(account.name || account.email || '?').slice(0, 1).toUpperCase()}</span><div><strong>{account.name || 'Sin nombre'}</strong><small>{account.email}</small></div></div></td><td><span className="access-user-role"><ShieldCheck size={13} />{account.role?.nombre || 'Sin rol'}</span></td><td><button type="button" className="access-text-button" disabled={!account.role?.id} onClick={() => { setViewRole(account.role.id); setPermissionSearch('') }}>{permissionCount((account.role?.permisos || []).length)} <Eye size={14} /></button></td><td>{canChangeAccount(account) ? <button type="button" className="access-button is-secondary" onClick={() => { setAssignment({ account, roleId: account.roleId || '' }); setDialogError('') }}>Cambiar rol <ArrowRight size={14} /></button> : <span className="access-protected-note"><LockKeyhole size={12} />{account.id === user?.user_id || searchable(account.email) === searchable(user?.username) ? 'Tu cuenta' : 'Solo consulta'}</span>}</td></tr>)}</tbody></table></div>
            {!filteredUsers.length ? <div className="access-empty"><Users size={28} /><h2>No hay personas para mostrar</h2><p>Revisa los filtros de búsqueda.</p></div> : null}
          </> : null}
          {tab === 'matrix' ? <>
            <div className="access-section-heading"><div><h2>Matriz de accesos</h2><p>Compara los permisos asignados a cada rol.</p></div><span className="access-matrix-legend"><Check size={13} /> Permitido <span>— Sin permiso</span></span></div>
            <div className="access-matrix-scroll" tabIndex={0} role="region" aria-label="Matriz de accesos desplazable"><table className="access-matrix"><thead><tr><th>Funcionalidad</th>{roles.map((role) => <th key={role.id}>{role.nombre}<small>{permissionCount((role.permisos || []).length)}</small></th>)}</tr></thead><tbody>{PERMISSION_GROUPS.map((group) => {
              const items = filteredPermissions.filter((item) => permissionGroup(item.value) === group.id)
              if (!items.length) return null
              return <MatrixGroup key={group.id} group={group} items={items} roles={roles} />
            })}</tbody></table></div>
            {!filteredPermissions.length ? <p className="access-empty">No se encontraron permisos con ese criterio.</p> : null}
          </> : null}
        </>}
      </div>
    </div>

    {editor ? <WorkflowDialog title={editor === 'new' ? 'Crear rol' : 'Editar rol'} eyebrow="Configurar capacidades" icon={ShieldPlus} description="Asigna únicamente las funciones necesarias para esta responsabilidad." wide busy={busy} onClose={() => setEditor(null)} footer={<><span className="access-selection-count"><KeyRound size={14} />{permissionCount(draft.permisos.length)} {draft.permisos.length === 1 ? 'seleccionado' : 'seleccionados'}</span><button className="access-button is-secondary" type="button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button className="access-button is-primary" form="access-role-form" type="submit" disabled={busy || !draft.nombre.trim()}>{busy ? 'Guardando…' : editor === 'new' ? 'Crear rol' : 'Guardar cambios'}<Check size={15} /></button></>}>
      {dialogError ? <p className="workflow-dialog-error" role="alert">{dialogError}</p> : null}
      <form id="access-role-form" className="access-editor" onSubmit={saveRole}>
        <div className="access-editor-fields"><label>Nombre del rol <input required maxLength={100} placeholder="Ej. Asistente de inventario" value={draft.nombre} onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))} /></label><label>Descripción<input maxLength={500} placeholder="¿Qué responsabilidad tendrá?" value={draft.descripcion} onChange={(event) => setDraft((current) => ({ ...current, descripcion: event.target.value }))} /></label></div>
        <div className="access-editor-heading"><div><h3>Permisos por módulo</h3><p>Marca cada función de forma independiente.</p></div><label className="access-search"><Search size={15} /><input aria-label="Buscar permiso" placeholder="Buscar función…" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} /></label></div>
        <div className="access-permission-groups">{editorGroups.map(({ id, label, icon, items }) => <details key={id} className="access-permission-group" open={Boolean(permissionSearch) || undefined}>
          <summary><span className="access-group-icon">{createElement(icon, { size: 17 })}</span><strong>{label}</strong><span>{items.filter((item) => selected.has(item.value)).length}/{items.length}</span><ChevronDown size={15} /></summary>
          <div className="access-permission-options">{items.map((item) => {
            const reserved = PRIVILEGED_PERMISSION_NAMES.has(item.value) || !catalogIds.has(item.value)
            return <label key={item.value} className={'access-permission-option' + (selected.has(item.value) ? ' is-selected' : '') + (reserved ? ' is-reserved' : '')}><span className="access-option-icon" aria-hidden="true">{getPermissionIcon(item.value)}</span><span><strong>{item.label}</strong><small>{reserved ? (!catalogIds.has(item.value) ? 'Permiso heredado · solo consulta' : 'Reservado a roles protegidos') : item.description || 'Función independiente del sistema.'}</small></span>{reserved ? <LockKeyhole size={14} aria-label="Permiso reservado" /> : <input type="checkbox" checked={selected.has(item.value)} onChange={() => togglePermission(item.value)} aria-label={item.label} />}</label>
          })}</div>
        </details>)}</div>
        {!editorGroups.length ? <p className="access-empty">No hay permisos que coincidan con tu búsqueda.</p> : null}
        <div className="workflow-note"><ShieldCheck size={18} /><div><strong>Permisos independientes y controlados</strong><p>Los permisos de identidad y seguridad están reservados a los roles protegidos. Los roles personalizados mantienen el acceso mínimo necesario.</p></div></div>
      </form>
    </WorkflowDialog> : null}

    {roleBeingViewed ? <WorkflowDialog title={roleBeingViewed.nombre} eyebrow="Permisos del rol" icon={ShieldCheck} description={roleBeingViewed.descripcion || 'Capacidades actualmente asignadas a este rol.'} wide onClose={() => setViewRole(null)} footer={<><span className="access-selection-count">{permissionCount((roleBeingViewed.permisos || []).length)} {(roleBeingViewed.permisos || []).length === 1 ? 'asignado' : 'asignados'}</span><button type="button" className="access-button is-secondary" onClick={() => setViewRole(null)}>Cerrar</button></>}>
      <label className="access-search access-dialog-search"><Search size={16} /><input aria-label="Filtrar permisos del rol" placeholder="Buscar entre sus permisos…" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} /></label>
      {PERMISSION_GROUPS.map(({ id, label, icon }) => {
        const values = (roleBeingViewed.permisos || []).filter((value) => permissionGroup(value) === id && searchable(labelFor(value) + ' ' + value).includes(searchable(permissionSearch)))
        return values.length ? <section className="access-view-group" key={id}><h3>{createElement(icon, { size: 16 })}{label}<span>{values.length}</span></h3><div className="access-view-permissions">{values.map((value) => <div key={value}><span aria-hidden="true">{getPermissionIcon(value)}</span><div><strong>{labelFor(value)}</strong><small>{permissionById.get(value)?.description || 'Permiso registrado en el sistema.'}</small></div><Check size={14} /></div>)}</div></section> : null
      })}
      {!(roleBeingViewed.permisos || []).length ? <div className="access-empty"><KeyRound size={28} /><h2>Perfil de autoservicio</h2><p>Este rol no tiene permisos administrativos adicionales.</p></div> : null}
    </WorkflowDialog> : null}

    {assignment ? <WorkflowDialog title="Cambiar rol" eyebrow="Asignación de acceso" icon={Users} description="Revisa la asignación antes de confirmar el cambio." busy={busy} onClose={() => setAssignment(null)} footer={<><button className="access-button is-secondary" type="button" disabled={busy} onClick={() => setAssignment(null)}>Cancelar</button><button className="access-button is-primary" type="button" disabled={busy || assignment.roleId === (assignment.account.roleId || '')} onClick={saveAssignment}>{busy ? 'Actualizando…' : 'Confirmar asignación'}<Check size={15} /></button></>}>
      {dialogError ? <p className="workflow-dialog-error" role="alert">{dialogError}</p> : null}
      <div className="access-assignment-person"><span className="access-role-icon"><Users size={23} /></span><div><strong>{assignment.account.name || 'Usuario'}</strong><small>{assignment.account.email}</small></div></div>
      <div className="access-assignment-current"><span>Rol actual</span><strong>{assignment.account.role?.nombre || 'Sin rol'}</strong></div>
      <label className="access-assignment-field">Nuevo rol<select value={assignment.roleId} onChange={(event) => setAssignment((current) => ({ ...current, roleId: event.target.value }))} aria-label="Nuevo rol">
        {PRIVILEGED_ROLE_NAMES.has(assignment.account.role?.nombre) ? <option value={assignment.account.roleId}>{assignment.account.role.nombre}</option> : <option value="">Sin rol asignado</option>}
        {choicesFor(assignment.account).map((role) => <option value={role.id} key={role.id}>{role.nombre}</option>)}
      </select></label>
      <div className="workflow-note"><ShieldCheck size={18} /><div><strong>El cambio actualiza sus capacidades</strong><p>La persona recibirá los permisos del nuevo rol al validar su sesión. No puedes modificar tu propia asignación.</p></div></div>
    </WorkflowDialog> : null}

    {deleteTarget ? <WorkflowDialog title="Eliminar rol" eyebrow="Confirmar eliminación" icon={Trash2} busy={busy} onClose={() => setDeleteTarget(null)} footer={<><button type="button" className="access-button is-secondary" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancelar</button><button type="button" className="access-button is-danger" disabled={busy} onClick={removeRole}>{busy ? 'Eliminando…' : 'Eliminar rol'}</button></>}>
      {dialogError ? <p className="workflow-dialog-error" role="alert">{dialogError}</p> : null}
      <p className="access-delete-copy">Vas a eliminar el rol <strong>{deleteTarget.nombre}</strong>. Esta acción no se puede deshacer.</p><div className="workflow-note"><LockKeyhole size={18} /><p>Si tiene usuarios asociados, el sistema impedirá su eliminación. Reasigna sus usuarios antes de eliminarlo.</p></div>
    </WorkflowDialog> : null}
  </section>
}

function MatrixGroup({ group, items, roles }) {
  const Icon = group.icon
  return <><tr className="access-matrix-group"><th colSpan={roles.length + 1}><Icon size={14} />{group.label}<span>{items.length}</span></th></tr>{items.map((item) => <tr key={item.value}><th scope="row"><span aria-hidden="true">{getPermissionIcon(item.value)}</span>{item.label}</th>{roles.map((role) => {
    const allowed = (role.permisos || []).includes(item.value)
    return <td key={role.id} aria-label={role.nombre + ': ' + (allowed ? 'permitido' : 'sin permiso')}>{allowed ? <span className="access-matrix-check"><Check size={14} /></span> : <span className="access-matrix-denied">—</span>}</td>
  })}</tr>)}</>
}

export default AdminRolesPage
