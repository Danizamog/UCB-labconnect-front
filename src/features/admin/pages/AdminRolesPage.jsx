import { useCallback, useEffect, useMemo, useState } from 'react'
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

const TABS = {
  ROLES: 'roles',
  USERS: 'users',
}

const PRIVILEGED_ROLE_NAMES = new Set(['Administrador', 'Administrador de Accesos', 'OSI - Auditor de Seguridad'])
const SYSTEM_ROLE_NAMES = new Set([...PRIVILEGED_ROLE_NAMES, 'Estudiante', 'Docente', 'Encargado de Laboratorio', 'Invitado'])
const PRIVILEGED_PERMISSION_NAMES = new Set([
  'aprobar_clases',
  'crear_usuarios', 'modificar_usuarios', 'dar_baja_usuarios', 'desbloquear_usuarios', 'reiniciar_credenciales',
  'gestionar_roles', 'asignar_roles', 'consultar_auditoria_seguridad', 'consultar_eventos_autenticacion',
  'consultar_sesiones_usuarios', 'consultar_incidentes_seguridad', 'revisar_accesos_rbac', 'exportar_reportes_seguridad',
])

const PERMISSION_ICONS = {
  gestionar_clases_propias: '📚', aprobar_clases: '✅',
  crear_usuarios: '➕', modificar_usuarios: '✏️', dar_baja_usuarios: '⛔', desbloquear_usuarios: '🔓', reiniciar_credenciales: '🗝️',
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
  'crear_usuarios', 'modificar_usuarios', 'dar_baja_usuarios', 'desbloquear_usuarios', 'reiniciar_credenciales',
  'consultar_roles', 'gestionar_roles', 'asignar_roles',
  'gestionar_reservas', 'gestionar_reservas_materiales', 'gestionar_reglas_reserva',
  'gestionar_estructura_laboratorios', 'gestionar_horarios_laboratorio', 'gestionar_accesos_laboratorio',
  'gestionar_penalizaciones', 'gestionar_inventario', 'gestionar_stock', 'gestionar_estado_equipos',
  'gestionar_mantenimiento', 'registrar_tickets_equipo', 'gestionar_prestamos', 'gestionar_reactivos_quimicos',
  'gestionar_tutorias_propias', 'aprobar_tutorias', 'gestionar_asistencia_tutorias',
  'gestionar_observaciones_tutorias', 'solicitar_recursos_clase', 'generar_reportes', 'consultar_estadisticas',
  'consultar_auditoria_seguridad', 'consultar_eventos_autenticacion', 'consultar_sesiones_usuarios',
  'consultar_incidentes_seguridad', 'revisar_accesos_rbac', 'exportar_reportes_seguridad',
].map((value) => ({ value, label: value.replaceAll('_', ' '), description: 'Permiso RBAC de LabConnect.', icon: PERMISSION_ICONS[value] || '•' }))

function parsePermisos(permisosText) {
  const trimmed = permisosText.trim()

  if (!trimmed) {
    return []
  }

  return trimmed
    .split(',')
    .map((permiso) => permiso.trim())
    .filter(Boolean)
}

function AdminRolesPage({ user, onSessionRefresh }) {
  const canEditRoles = hasAnyPermission(user, ['gestionar_roles'])
  const canAssignRoles = hasAnyPermission(user, ['asignar_roles'])
  const canViewAssignments = canAssignRoles || hasAnyPermission(user, ['revisar_accesos_rbac'])
  const [activeTab, setActiveTab] = useState(TABS.ROLES)
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [permissionOptions, setPermissionOptions] = useState(FALLBACK_PERMISSION_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [roleDraft, setRoleDraft] = useState({ nombre: '', descripcion: '', permisosText: '' })
  const [editingRoleId, setEditingRoleId] = useState(null)
  const [roleUpdatingId, setRoleUpdatingId] = useState(null)
  const [roleDeletingId, setRoleDeletingId] = useState(null)
  const [userUpdatingId, setUserUpdatingId] = useState(null)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [viewPermissionsRoleId, setViewPermissionsRoleId] = useState(null)
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState(null)

  const roleOptions = useMemo(
    () => roles.map((role) => ({ id: role.id, nombre: role.nombre })),
    [roles],
  )
  const currentRoleName = String(user?.role || '')
  const currentUsername = String(user?.username || '').toLowerCase()
  const assignableRoleOptions = useMemo(() => roleOptions.filter((role) => (
    !PRIVILEGED_ROLE_NAMES.has(role.nombre)
    || (currentRoleName === 'Administrador' && role.nombre === 'Administrador de Accesos')
    || (currentRoleName === 'Administrador de Accesos' && role.nombre === 'OSI - Auditor de Seguridad')
  )), [currentRoleName, roleOptions])
  const currentPermissionOptions = permissionOptions.length ? permissionOptions : FALLBACK_PERMISSION_OPTIONS

  const selectedPermissions = useMemo(() => parsePermisos(roleDraft.permisosText), [roleDraft.permisosText])
  const selectedPermissionsSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      const [rolesResponse, usersResponse, permissionsResponse] = await Promise.all([
        listRoles(),
        canViewAssignments ? listUsersWithRoles() : Promise.resolve([]),
        listPermissionsCatalog().catch(() => FALLBACK_PERMISSION_OPTIONS),
      ])

      setRoles(rolesResponse)
      setUsers(usersResponse)
      setPermissionOptions(Array.isArray(permissionsResponse) && permissionsResponse.length ? permissionsResponse : FALLBACK_PERMISSION_OPTIONS)
      setSuccessMessage('Datos recargados correctamente.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo cargar la información de roles.')
    } finally {
      setLoading(false)
    }
  }, [canViewAssignments])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resetDraft = () => {
    setRoleDraft({ nombre: '', descripcion: '', permisosText: '' })
    setEditingRoleId(null)
    setIsPermissionsModalOpen(false)
  }

  const handleRoleDraftChange = (field, value) => {
    setSuccessMessage('')
    setErrorMessage('')
    setRoleDraft((previous) => ({ ...previous, [field]: value }))
  }

  const handleEditRole = (role) => {
    setErrorMessage('')
    setSuccessMessage('')
    setIsPermissionsModalOpen(false)
    setEditingRoleId(role.id)
    setRoleDraft({
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisosText: Array.isArray(role.permisos) ? role.permisos.join(', ') : '',
    })
  }

  const handleTogglePermission = (permission) => {
    const current = new Set(parsePermisos(roleDraft.permisosText))

    if (current.has(permission)) {
      current.delete(permission)
    } else {
      current.add(permission)
    }

    const ordered = currentPermissionOptions.map((option) => option.value).filter((value) => current.has(value))
    handleRoleDraftChange('permisosText', ordered.join(', '))
  }

  const handleRemovePermission = (permissionToRemove) => {
    const current = new Set(parsePermisos(roleDraft.permisosText))
    current.delete(permissionToRemove)
    const ordered = currentPermissionOptions.map((option) => option.value).filter((value) => current.has(value))
    handleRoleDraftChange('permisosText', ordered.join(', '))
  }

  const handleClearPermissions = () => {
    handleRoleDraftChange('permisosText', '')
  }

  const handleSaveRole = async () => {
    try {
      setErrorMessage('')
      setSuccessMessage('')

      const payload = {
        nombre: roleDraft.nombre.trim(),
        descripcion: roleDraft.descripcion.trim(),
        permisos: parsePermisos(roleDraft.permisosText),
      }

      if (!payload.nombre) {
        setErrorMessage('El nombre del rol es obligatorio.')
        return
      }

      if (editingRoleId) {
        setRoleUpdatingId(editingRoleId)
        const updated = await updateRole(editingRoleId, payload)
        setRoles((previous) => previous.map((role) => (role.id === updated.id ? updated : role)))
        setSuccessMessage('Rol actualizado correctamente.')
      } else {
        const created = await createRole(payload)
        setRoles((previous) => [created, ...previous])
        setSuccessMessage('Rol creado correctamente.')
      }

      resetDraft()
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo guardar el rol.')
    } finally {
      setRoleUpdatingId(null)
    }
  }

  const handleDeleteRole = async (roleId) => {
    try {
      setErrorMessage('')
      setSuccessMessage('')
      setRoleDeletingId(roleId)
      await deleteRole(roleId)
      setRoles((previous) => previous.filter((role) => role.id !== roleId))
      setSuccessMessage('Rol eliminado correctamente.')
      setConfirmDeleteRoleId(null)
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo eliminar el rol.')
    } finally {
      setRoleDeletingId(null)
    }
  }

  const handleConfirmDelete = (roleId) => {
    setConfirmDeleteRoleId(roleId)
  }

  const handleAssignUserRole = async (userId, newRoleId) => {
    try {
      setErrorMessage('')
      setSuccessMessage('')
      setUserUpdatingId(userId)

      const updatedUser = await assignUserRole(userId, newRoleId || null)
      const selectedRole = roles.find((role) => role.id === (newRoleId || null))

      setUsers((previousUsers) =>
        previousUsers.map((user) => {
          if (user.id !== userId) {
            return user
          }

          return {
            ...user,
            ...updatedUser,
            roleId: newRoleId || null,
            role: selectedRole || null,
          }
        }),
      )

      const isCurrentSessionUser =
        updatedUser?.id === user?.user_id ||
        (updatedUser?.email && updatedUser.email === user?.username)

      if (isCurrentSessionUser && typeof onSessionRefresh === 'function') {
        const refreshResult = await onSessionRefresh()
        if (refreshResult?.success) {
          setSuccessMessage('Tu rol y tus permisos se actualizaron al instante en esta sesion.')
        } else {
          setSuccessMessage('Rol de usuario actualizado correctamente. La sesion se validara de nuevo al continuar.')
        }
        return
      }

      setSuccessMessage('Rol de usuario actualizado correctamente. Los permisos nuevos ya quedan disponibles al validar la sesion.')
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo actualizar el rol del usuario.')
    } finally {
      setUserUpdatingId(null)
    }
  }

  return (
    <section className="roles-page" aria-label="Administración de roles">
      <header className="roles-header">
        <div className="roles-header-content">
          <p className="roles-header-kicker">Gestion operativa</p>
          <h2>Roles y permisos</h2>
          <p>Configura accesos por responsabilidad para que cada usuario vea solo lo que necesita.</p>
        </div>
        <button
          type="button"
          className="roles-reload-button"
          onClick={loadData}
          disabled={loading}
          title="Recargar datos de la base de datos"
          aria-label="Recargar informacion de roles y usuarios"
        >
          {loading ? 'Cargando...' : 'Recargar'}
        </button>
      </header>

      <div className="roles-body">
      <div className="roles-tabs" role="tablist" aria-label="Gestion de roles">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.ROLES}
          className={`roles-tab-button ${activeTab === TABS.ROLES ? 'is-active' : ''}`}
          onClick={() => setActiveTab(TABS.ROLES)}
        >
          Administrar roles
        </button>
        {canViewAssignments ? <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.USERS}
          className={`roles-tab-button ${activeTab === TABS.USERS ? 'is-active' : ''}`}
          onClick={() => setActiveTab(TABS.USERS)}
        >
          Asignar roles a usuarios
        </button> : null}
      </div>

      {errorMessage ? <p className="roles-error">{errorMessage}</p> : null}
      {successMessage ? <p className="roles-success">{successMessage}</p> : null}
      {loading ? <p className="roles-counter">Cargando información...</p> : null}

      {!loading && activeTab === TABS.ROLES ? (
        <>
          {canEditRoles ? <details className="ux-extra-toggle" open={Boolean(editingRoleId)}>
            <summary>{editingRoleId ? 'Editar rol seleccionado' : 'Crear nuevo rol'}</summary>
            <div className="ux-extra-toggle-content">
              <div className="roles-form-card">
                <h3>{editingRoleId ? 'Editar rol' : 'Crear nuevo rol'}</h3>
                <div className="roles-form-grid">
                  <label>
                    <span>Nombre</span>
                    <input
                      className="roles-input"
                      value={roleDraft.nombre}
                      onChange={(event) => handleRoleDraftChange('nombre', event.target.value)}
                      placeholder="Administrador"
                    />
                  </label>
                  <label>
                    <span>Descripción</span>
                    <input
                      className="roles-input"
                      value={roleDraft.descripcion}
                      onChange={(event) => handleRoleDraftChange('descripcion', event.target.value)}
                      placeholder="Acceso total"
                    />
                  </label>
                  <label className="roles-form-full">
                    <span>Permisos seleccionados ({selectedPermissions.length})</span>
                    <div className="roles-permissions-display">
                      {selectedPermissions.length > 0 ? (
                        <div className="roles-chips-container">
                          {selectedPermissions.map((permission) => {
                            const option = currentPermissionOptions.find((opt) => opt.value === permission)

                            return (
                              <div key={permission} className="roles-chip" title={option?.label || permission}>
                                <span className="roles-chip-icon">{option?.icon || PERMISSION_ICONS[permission] || '•'}</span>
                                <span className="roles-chip-label">{option?.label || permission}</span>
                                <button
                                  type="button"
                                  className="roles-chip-remove"
                                  onClick={() => handleRemovePermission(permission)}
                                  aria-label={`Eliminar ${option?.label || permission}`}
                                >
                                  ✕
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="roles-empty-state">No hay permisos seleccionados</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="roles-primary-button"
                      onClick={() => setIsPermissionsModalOpen(true)}
                    >
                      {selectedPermissions.length > 0 ? 'Editar permisos' : 'Seleccionar permisos'}
                    </button>
                  </label>
                </div>
                <div className="roles-toolbar">
                  <span className="roles-counter">
                    {roles.length} rol{roles.length === 1 ? '' : 'es'} registrado{roles.length === 1 ? '' : 's'}
                  </span>
                  <div className="roles-actions">
                    {editingRoleId ? (
                      <button type="button" className="roles-ghost-button" onClick={resetDraft}>
                        Cancelar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="roles-save-button"
                      onClick={handleSaveRole}
                      disabled={Boolean(roleUpdatingId)}
                    >
                      {editingRoleId ? 'Guardar rol' : 'Crear rol'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </details> : null}

          {isPermissionsModalOpen ? (
            <div className="roles-modal-backdrop" role="dialog" aria-modal="true" aria-label="Seleccionar permisos">
              <div className="roles-modal">
                <div className="roles-modal-header">
                  <h3>Seleccionar permisos</h3>
                  <button
                    type="button"
                    className="roles-ghost-button"
                    onClick={() => setIsPermissionsModalOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>

                <div className="roles-permissions-grid">
                  {currentPermissionOptions.filter((permission) => !PRIVILEGED_PERMISSION_NAMES.has(permission.value)).map((permission) => {
                    const isSelected = selectedPermissionsSet.has(permission.value)

                    return (
                      <button
                        type="button"
                        key={permission.value}
                        className={`roles-permission-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleTogglePermission(permission.value)}
                      >
                        <span className="roles-permission-icon" aria-hidden="true">
                          {permission.icon || PERMISSION_ICONS[permission.value] || '•'}
                        </span>
                        <span className="roles-permission-texts">
                          <strong>{permission.label}</strong>
                          <small>{permission.value}</small>
                          <small>{permission.description || 'Sin descripcion disponible.'}</small>
                        </span>
                        <span className="roles-permission-check">{isSelected ? '✓' : ''}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="roles-modal-actions">
                  <button type="button" className="roles-ghost-button" onClick={handleClearPermissions}>
                    Limpiar
                  </button>
                  <button type="button" className="roles-save-button" onClick={() => setIsPermissionsModalOpen(false)}>
                    Listo
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="roles-table-wrap">
            <table className="roles-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Permisos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const displayPermissions = Array.isArray(role.permisos) ? role.permisos.slice(0, 3) : []
                  const remainingCount = Array.isArray(role.permisos) ? role.permisos.length - 3 : 0

                  return (
                    <tr key={role.id}>
                      <td className="roles-table-name">{role.nombre}</td>
                      <td className="roles-table-description">{role.descripcion || '—'}</td>
                      <td className="roles-table-permissions">
                        <div className="roles-badges-container">
                          {displayPermissions.map((perm) => {
                            const option = currentPermissionOptions.find((opt) => opt.value === perm)

                            return (
                              <div key={perm} className="roles-badge-wrapper">
                                <span className="roles-badge" title={option?.label || perm}>
                                  <span>{option?.icon || '•'}</span>
                                </span>
                                <div className="roles-badge-tooltip">{option?.label || perm}</div>
                              </div>
                            )
                          })}
                          {remainingCount > 0 ? (
                            <button
                              type="button"
                              className="roles-badge-more"
                              onClick={() => setViewPermissionsRoleId(role.id)}
                              title={Array.isArray(role.permisos) ? role.permisos.slice(3).map((p) => currentPermissionOptions.find((opt) => opt.value === p)?.label || p).join(', ') : ''}
                            >
                              +{remainingCount}
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="roles-actions-cell">
                        {canEditRoles && !PRIVILEGED_ROLE_NAMES.has(role.nombre) ? <button type="button" className="roles-action-button roles-action-edit" onClick={() => handleEditRole(role)}>
                          ✎ Editar
                        </button> : null}
                        {canEditRoles && !SYSTEM_ROLE_NAMES.has(role.nombre) ? <button
                          type="button"
                          className="roles-action-button roles-action-delete"
                          onClick={() => handleConfirmDelete(role.id)}
                          disabled={roleDeletingId === role.id}
                        >
                          🗑 Eliminar
                        </button> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!loading && activeTab === TABS.USERS ? (
        <div className="roles-table-wrap">
          <p className="roles-counter">
            La asignación RBAC se limita a los roles institucionales definidos. {canAssignRoles ? 'Puedes asignarlos desde esta tabla.' : 'Esta consulta es de solo lectura.'}
          </p>
          <table className="roles-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol actual</th>
                <th>Permisos del rol</th>
                <th>Asignar rol</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name || 'Sin nombre'}</td>
                  <td>{user.email}</td>
                  <td>{user.role?.nombre || 'Sin rol'}</td>
                  <td className="roles-table-permissions">
                    <div className="roles-badges-container">
                      {(user.role?.permisos || []).length > 0 ? (
                        user.role.permisos.map((perm) => {
                          const option = currentPermissionOptions.find((opt) => opt.value === perm)

                          return (
                            <div key={`${user.id}-${perm}`} className="roles-badge-wrapper">
                              <span className="roles-badge" title={option?.label || perm}>
                                <span>{option?.icon || '*'}</span>
                              </span>
                              <div className="roles-badge-tooltip">{option?.label || perm}</div>
                            </div>
                          )
                        })
                      ) : (
                        <span className="roles-empty-state">Sin permisos</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {canAssignRoles && (
                      !PRIVILEGED_ROLE_NAMES.has(user.role?.nombre)
                      || (currentRoleName === 'Administrador' && user.role?.nombre === 'Administrador' && String(user.email || '').toLowerCase() !== currentUsername)
                    ) ? <select
                      className="roles-select"
                      value={roleOptions.some((role) => role.id === user.roleId) ? user.roleId : ''}
                      disabled={userUpdatingId === user.id}
                      onChange={(event) => handleAssignUserRole(user.id, event.target.value)}
                    >
                      <option value="">Sin rol</option>
                      {assignableRoleOptions.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.nombre}
                        </option>
                      ))}
                    </select> : <span>{user.role?.nombre || 'Sin rol'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && activeTab === TABS.ROLES && roles.length === 0 ? (
        <p className="roles-counter">No hay roles registrados.</p>
      ) : null}

      {!loading && activeTab === TABS.USERS && users.length === 0 ? (
        <p className="roles-counter">No hay usuarios para asignar roles.</p>
      ) : null}

      {viewPermissionsRoleId ? (() => {
        const roleWithFullPerms = roles.find((r) => r.id === viewPermissionsRoleId)

        return roleWithFullPerms ? (
          <div className="roles-modal-backdrop" role="dialog" aria-modal="true" aria-label="Ver todos los permisos">
            <div className="roles-modal roles-modal-permissions">
              <div className="roles-modal-header">
                <h3>Permisos de "{roleWithFullPerms.nombre}"</h3>
                <button
                  type="button"
                  className="roles-ghost-button"
                  onClick={() => setViewPermissionsRoleId(null)}
                >
                  Cerrar
                </button>
              </div>

              <div className="roles-permissions-list">
                {Array.isArray(roleWithFullPerms.permisos) && roleWithFullPerms.permisos.length > 0 ? (
                  <ul>
                    {roleWithFullPerms.permisos.map((perm) => {
                      const option = currentPermissionOptions.find((opt) => opt.value === perm)

                      return (
                        <li key={perm} className="roles-permission-list-item">
                          <span className="roles-permission-list-icon">{option?.icon || '•'}</span>
                          <div>
                            <strong>{option?.label || perm}</strong>
                            <small>{option?.value || perm}</small>
                            <small>{option?.description || 'Sin descripcion disponible.'}</small>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="roles-empty-state">Este rol no tiene permisos asignados.</p>
                )}
              </div>
            </div>
          </div>
        ) : null
      })() : null}

      {confirmDeleteRoleId ? (() => {
        const roleToDelete = roles.find((r) => r.id === confirmDeleteRoleId)

        return roleToDelete ? (
          <div className="roles-modal-backdrop" role="alertdialog" aria-modal="true" aria-label="Confirmar eliminación">
            <div className="roles-modal roles-modal-confirm">
              <div className="roles-modal-header">
                <h3>⚠️ Confirmar eliminación</h3>
              </div>

              <div className="roles-modal-content">
                <p>
                  ¿Está seguro de que desea eliminar el rol <strong>"{roleToDelete.nombre}"</strong>?
                </p>
                <p className="roles-warning-text">
                  Esta acción no se puede deshacer y afectará a los usuarios asignados a este rol.
                </p>
              </div>

              <div className="roles-modal-actions">
                <button
                  type="button"
                  className="roles-ghost-button"
                  onClick={() => setConfirmDeleteRoleId(null)}
                  disabled={roleDeletingId === confirmDeleteRoleId}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="roles-danger-button"
                  onClick={() => handleDeleteRole(confirmDeleteRoleId)}
                  disabled={roleDeletingId === confirmDeleteRoleId}
                >
                  {roleDeletingId === confirmDeleteRoleId ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        ) : null
      })() : null}
      </div>
    </section>
  )
}

export default AdminRolesPage
