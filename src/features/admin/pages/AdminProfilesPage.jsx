import { useEffect, useMemo, useState } from 'react'
import { deleteUserProfile, listUserProfiles, updateUserProfile } from '../services/profileService'
import { assignUserRole, listRoles } from '../services/rolesService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminProfilesPage.css'

const defaultForm = {
  name: '',
  roleId: '',
  password: '',
  is_active: true,
}

function AdminProfilesPage({ user }) {
  const [profiles, setProfiles] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const loadData = async () => {
    setLoading(true)
    try {
      const [profileData, roleData] = await Promise.all([listUserProfiles(), listRoles()])
      setProfiles(profileData)
      setRoles(roleData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los perfiles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const summary = useMemo(() => {
    const active = profiles.filter((p) => p.is_active !== false).length
    const byRole = {}
    profiles.forEach((p) => {
      const roleName = p.role || 'Sin rol'
      byRole[roleName] = (byRole[roleName] || 0) + 1
    })
    return { total: profiles.length, active, byRole }
  }, [profiles])

  const canManage = hasAnyPermission(user, ['gestionar_roles_permisos'])
  const canReactivate = hasAnyPermission(user, ['reactivar_cuentas'])

  const resetFeedback = () => { setError(''); setMessage('') }

  const handleDelete = async (profile) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${profile.name || profile.username}? Esta acción no se puede deshacer.`)) return
    resetFeedback()
    try {
      await deleteUserProfile(profile.id)
      setMessage('Usuario eliminado correctamente.')
      if (editingUser?.id === profile.id) cancelEdit()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el usuario')
    }
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setForm(defaultForm)
    resetFeedback()
  }

  const handleEdit = (profile) => {
    resetFeedback()
    setEditingUser(profile)
    const matchedRole = roles.find((r) => r.nombre === profile.role)
    setForm({
      name: profile.name || '',
      roleId: matchedRole?.id || '',
      password: '',
      is_active: profile.is_active !== false,
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    resetFeedback()

    try {
      const payload = {
        name: form.name.trim(),
        is_active: form.is_active,
      }
      if (form.password.trim()) {
        payload.password = form.password.trim()
      }

      await updateUserProfile(editingUser.id, payload)

      if (form.roleId) {
        await assignUserRole(editingUser.id, form.roleId)
      }

      setMessage('Perfil actualizado correctamente.')
      cancelEdit()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil')
    }
  }

  return (
    <section className="profiles-page" aria-label="Gestión de perfiles">
      <header className="profiles-header">
        <div>
          <p className="profiles-kicker">Gestión de usuarios</p>
          <h2>Perfiles institucionales</h2>
          <p>Edita el nombre, rol y estado de los usuarios registrados en el sistema.</p>
        </div>
        <div className="profiles-summary">
          <div><span>Total</span><strong>{summary.total}</strong></div>
          <div><span>Activos</span><strong>{summary.active}</strong></div>
          {Object.entries(summary.byRole).slice(0, 2).map(([roleName, count]) => (
            <div key={roleName}><span>{roleName}</span><strong>{count}</strong></div>
          ))}
        </div>
      </header>

      {message ? <p className="profiles-alert success">{message}</p> : null}
      {error ? <p className="profiles-alert error">{error}</p> : null}

      <div className="profiles-grid">
        <section className="profiles-card">
          {editingUser ? (
            <>
              <div className="profiles-card-head">
                <div>
                  <h3>Editar perfil</h3>
                  <p>{editingUser.username || editingUser.name}</p>
                </div>
              </div>

              <form className="profiles-form" onSubmit={handleSubmit}>
                <div className="profiles-form-grid">
                  <label>
                    <span>Nombre completo</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                      disabled={!canManage}
                    />
                  </label>

                  <label>
                    <span>Rol</span>
                    <select
                      value={form.roleId}
                      onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))}
                      disabled={!canManage}
                    >
                      <option value="">Sin rol asignado</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Nueva contraseña (opcional)</span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Solo si deseas cambiarla"
                      disabled={!canManage}
                    />
                  </label>
                </div>

                <label className="profiles-checkbox">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    disabled={!canReactivate}
                  />
                  <span>Cuenta activa</span>
                </label>

                <div className="profiles-actions">
                  <button
                    type="submit"
                    className="profiles-primary"
                    disabled={!canManage && !canReactivate}
                  >
                    Guardar cambios
                  </button>
                  <button type="button" className="profiles-secondary" onClick={cancelEdit}>
                    Cancelar
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="profiles-card-head">
              <div>
                <h3>Editar perfil</h3>
                <p className="profiles-empty">
                  Selecciona un usuario de la lista para editar su información.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="profiles-card">
          <div className="profiles-card-head">
            <div>
              <h3>Directorio institucional</h3>
              <p>Lista de usuarios registrados en el sistema.</p>
            </div>
          </div>

          {loading ? (
            <p className="profiles-empty">Cargando perfiles...</p>
          ) : (
            <div className="profiles-list">
              {profiles.map((profile) => (
                <article
                  key={profile.id}
                  className={`profiles-item${editingUser?.id === profile.id ? ' editing' : ''}`}
                >
                  <div className="profiles-item-head">
                    <div>
                      <strong>{profile.name || profile.username}</strong>
                      <p>{profile.username}</p>
                    </div>
                    <span className={`profiles-badge ${profile.is_active !== false ? 'active' : 'inactive'}`}>
                      {profile.is_active !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="profiles-meta">
                    <span>{profile.role || 'Sin rol'}</span>
                  </div>

                  <div className="profiles-actions compact">
                    <button
                      type="button"
                      className="profiles-secondary"
                      onClick={() => handleEdit(profile)}
                      disabled={!canManage && !canReactivate}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="profiles-danger"
                      onClick={() => handleDelete(profile)}
                      disabled={!canManage}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default AdminProfilesPage
