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

  const roleOptions = useMemo(
    () => roles.map((role) => ({ id: role.id, nombre: role.nombre })),
    [roles],
  )

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        const [rolesResponse, usersResponse] = await Promise.all([listRoles(), listUsersWithRoles()])

        if (!mounted) {
          return
        }

        setRoles(rolesResponse)
        setUsers(usersResponse)
      } catch (error) {
        if (!mounted) {
          return
        }

        setErrorMessage(error?.message || 'No se pudo cargar la información de roles.')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [])

  const resetDraft = () => {
    setRoleDraft({ nombre: '', descripcion: '', permisosText: '' })
    setEditingRoleId(null)
  }

  const parsePermisos = (permisosText) => {
    const trimmed = permisosText.trim()

    if (!trimmed) {
      return []
    }

    return trimmed
      .split(',')
      .map((permiso) => permiso.trim())
      .filter(Boolean)
  }

  const handleRoleDraftChange = (field, value) => {
    setSuccessMessage('')
    setErrorMessage('')
    setRoleDraft((previous) => ({ ...previous, [field]: value }))
  }

  const handleEditRole = (role) => {
    setErrorMessage('')
    setSuccessMessage('')
    setEditingRoleId(role.id)
    setRoleDraft({
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisosText: Array.isArray(role.permisos) ? role.permisos.join(', ') : '',
    })
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
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo eliminar el rol.')
    } finally {
      setRoleDeletingId(null)
    }
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
        <h2>Administración de roles</h2>
        <p>Asigna y actualiza los permisos de acceso para cada usuario.</p>
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
                <span>Permisos (separados por coma)</span>
                <input
                  className="roles-input"
                  value={roleDraft.permisosText}
                  onChange={(event) => handleRoleDraftChange('permisosText', event.target.value)}
                  placeholder="roles.read, roles.write"
                />
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
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>{role.nombre}</td>
                    <td>{role.descripcion || '—'}</td>
                    <td>
                      {Array.isArray(role.permisos) && role.permisos.length
                        ? role.permisos.join(', ')
                        : '—'}
                    </td>
                    <td className="roles-actions-cell">
                      <button type="button" className="roles-ghost-button" onClick={() => handleEditRole(role)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="roles-danger-button"
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={roleDeletingId === role.id}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
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
    </section>
  )
}

export default AdminRolesPage
