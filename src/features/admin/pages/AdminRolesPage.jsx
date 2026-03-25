import { useEffect, useMemo, useState } from 'react'
import {
  assignUserRole,
  createRole,
  deleteRole,
  listRoles,
  listUsersWithRoles,
  updateRole,
} from '../services/rolesService'
import './AdminRolesPage.css'

const TABS = {
  ROLES: 'roles',
  USERS: 'users',
}

const PERMISSION_OPTIONS = [
  { value: 'gestionar_roles_permisos', label: 'Gestionar roles y permisos', description: 'Crear, editar y eliminar roles. Asignar permisos a usuarios.', icon: '🛡️' },
  { value: 'reactivar_cuentas', label: 'Reactivar cuentas', description: 'Reactivar cuentas de usuario desactivadas.', icon: '🔄' },
  { value: 'gestionar_reservas', label: 'Gestionar reservas', description: 'Crear, editar, consultar y cancelar reservas de laboratorio.', icon: '📅' },
  { value: 'gestionar_reservas_materiales', label: 'Gestionar materiales en reservas', description: 'Agregar, modificar y remover materiales de las reservas.', icon: '🧪' },
  { value: 'gestionar_reglas_reserva', label: 'Gestionar reglas de reserva', description: 'Establecer las políticas y reglas de las reservas.', icon: '⚙️' },
  { value: 'gestionar_inventario', label: 'Gestionar inventario', description: 'Crear, actualizar y eliminar equipos del inventario.', icon: '📦' },
  { value: 'gestionar_stock', label: 'Gestionar stock', description: 'Administrar niveles de stock y disponibilidad de materiales.', icon: '📊' },
  { value: 'gestionar_estado_equipos', label: 'Gestionar estado de equipos', description: 'Cambiar estado de equipos (disponible, mantenimiento, dañado, etc).', icon: '🧰' },
  { value: 'gestionar_mantenimiento', label: 'Gestionar mantenimiento', description: 'Registrar y seguimiento del mantenimiento de equipos.', icon: '🛠️' },
  { value: 'gestionar_prestamos', label: 'Gestionar préstamos', description: 'Autorizar, registrar y devolver préstamos de materiales.', icon: '🤝' },
  { value: 'adjuntar_evidencia_inventario', label: 'Adjuntar evidencia de inventario', description: 'Subir documentos y fotos como evidencia de inventario.', icon: '📎' },
  { value: 'gestionar_accesos_laboratorio', label: 'Gestionar accesos al laboratorio', description: 'Habilitar y deshabilitar acceso a espacios del laboratorio.', icon: '🚪' },
  { value: 'gestionar_penalizaciones', label: 'Gestionar penalizaciones', description: 'Aplicar sanciones por incumplimiento de normas.', icon: '⚠️' },
  { value: 'gestionar_tutorias', label: 'Gestionar tutorías', description: 'Crear y editar sesiones de tutorías académicas.', icon: '🎓' },
  { value: 'gestionar_inscripciones_tutorias', label: 'Gestionar inscripciones de tutorías', description: 'Registrar estudiantes en sesiones de tutoría.', icon: '📝' },
  { value: 'gestionar_asistencia_tutorias', label: 'Gestionar asistencia a tutorías', description: 'Registrar y consultar asistencia de tutorías.', icon: '✅' },
  { value: 'gestionar_observaciones_tutorias', label: 'Gestionar observaciones de tutorías', description: 'Agregar notas y observaciones sobre el desempeño en tutorías.', icon: '📋' },
  { value: 'gestionar_notificaciones', label: 'Gestionar notificaciones', description: 'Crear y enviar notificaciones a usuarios.', icon: '🔔' },
  { value: 'generar_reportes', label: 'Generar reportes', description: 'Crear reportes detallados sobre operaciones del sistema.', icon: '📈' },
  { value: 'consultar_estadisticas', label: 'Consultar estadísticas', description: 'Ver dashboards y estadísticas del sistema.', icon: '📉' },
  { value: 'gestionar_reactivos_quimicos', label: 'Gestionar reactivos químicos', description: 'Controlar stock y uso de químicos en el laboratorio.', icon: '⚗️' },
]

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

function formatPermissionName(name) {
  if (!name) return name
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function AdminRolesPage() {
  const [activeTab, setActiveTab] = useState(TABS.ROLES)
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
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

  const selectedPermissions = useMemo(() => parsePermisos(roleDraft.permisosText), [roleDraft.permisosText])
  const selectedPermissionsSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions])

  const loadData = async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      const [rolesResponse, usersResponse] = await Promise.all([listRoles(), listUsersWithRoles()])

      setRoles(rolesResponse)
      setUsers(usersResponse)
      setSuccessMessage('Datos recargados correctamente.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo cargar la información de roles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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

    const ordered = PERMISSION_OPTIONS.map((option) => option.value).filter((value) => current.has(value))
    handleRoleDraftChange('permisosText', ordered.join(', '))
  }

  const handleRemovePermission = (permissionToRemove) => {
    const current = new Set(parsePermisos(roleDraft.permisosText))
    current.delete(permissionToRemove)
    const ordered = PERMISSION_OPTIONS.map((option) => option.value).filter((value) => current.has(value))
    handleRoleDraftChange('permisosText', ordered.join(', '))
  }

  const handleClearPermissions = () => {
    handleRoleDraftChange('permisosText', '')
  }

  const getPermissionLabel = (value) => {
    return PERMISSION_OPTIONS.find((opt) => opt.value === value)?.label || value
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

      setSuccessMessage('Rol de usuario actualizado correctamente.')
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
          <div>
            <h2>Administración de roles</h2>
            <p>Asigna y actualiza los permisos de acceso para cada usuario.</p>
          </div>
          <button
            type="button"
            className="roles-reload-button"
            onClick={loadData}
            disabled={loading}
            title="Recargar datos de la base de datos"
            aria-label="Recargar información de roles y usuarios"
          >
            🔄 {loading ? 'Cargando...' : 'Recargar'}
          </button>
        </div>
      </header>

      <div className="roles-tabs" role="tablist" aria-label="Gestión de roles">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.ROLES}
          className={`roles-tab-button ${activeTab === TABS.ROLES ? 'is-active' : ''}`}
          onClick={() => setActiveTab(TABS.ROLES)}
        >
          Administrar roles
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.USERS}
          className={`roles-tab-button ${activeTab === TABS.USERS ? 'is-active' : ''}`}
          onClick={() => setActiveTab(TABS.USERS)}
        >
          Asignar roles a usuarios
        </button>
      </div>

      {errorMessage ? <p className="roles-error">{errorMessage}</p> : null}
      {successMessage ? <p className="roles-success">{successMessage}</p> : null}
      {loading ? <p className="roles-counter">Cargando información...</p> : null}

      {!loading && activeTab === TABS.ROLES ? (
        <>
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
                        const option = PERMISSION_OPTIONS.find((opt) => opt.value === permission)

                        return (
                          <div key={permission} className="roles-chip" title={option?.label || permission}>
                            <span className="roles-chip-icon">{option?.icon || '•'}</span>
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
                  {PERMISSION_OPTIONS.map((permission) => {
                    const isSelected = selectedPermissionsSet.has(permission.value)

                    return (
                      <button
                        type="button"
                        key={permission.value}
                        className={`roles-permission-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleTogglePermission(permission.value)}
                      >
                        <span className="roles-permission-icon" aria-hidden="true">
                          {permission.icon}
                        </span>
                        <span className="roles-permission-texts">
                          <strong>{permission.label}</strong>
                          <small>{permission.value}</small>
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
                            const option = PERMISSION_OPTIONS.find((opt) => opt.value === perm)

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
                              title={Array.isArray(role.permisos) ? role.permisos.slice(3).map((p) => PERMISSION_OPTIONS.find((opt) => opt.value === p)?.label || p).join(', ') : ''}
                            >
                              +{remainingCount}
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="roles-actions-cell">
                        <button type="button" className="roles-action-button roles-action-edit" onClick={() => handleEditRole(role)}>
                          ✎ Editar
                        </button>
                        <button
                          type="button"
                          className="roles-action-button roles-action-delete"
                          onClick={() => handleConfirmDelete(role.id)}
                          disabled={roleDeletingId === role.id}
                        >
                          🗑 Eliminar
                        </button>
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
          <table className="roles-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol actual</th>
                <th>Asignar rol</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name || 'Sin nombre'}</td>
                  <td>{user.email}</td>
                  <td>{user.role?.nombre || 'Sin rol'}</td>
                  <td>
                    <select
                      className="roles-select"
                      value={user.roleId || ''}
                      disabled={userUpdatingId === user.id}
                      onChange={(event) => handleAssignUserRole(user.id, event.target.value)}
                    >
                      <option value="">Sin rol</option>
                      {roleOptions.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.nombre}
                        </option>
                      ))}
                    </select>
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
                      const option = PERMISSION_OPTIONS.find((opt) => opt.value === perm)

                      return (
                        <li key={perm} className="roles-permission-list-item">
                          <span className="roles-permission-list-icon">{option?.icon || '•'}</span>
                          <div>
                            <strong>{option?.label || perm}</strong>
                            <small>{option?.value || perm}</small>
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
    </section>
  )
}

export default AdminRolesPage
