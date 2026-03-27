import { useEffect, useMemo, useState } from 'react'
import {
  createUserProfile,
  listUserProfiles,
  updateUserProfile,
} from '../services/profileService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminProfilesPage.css'

const defaultForm = {
  username: '',
  password: '',
  name: '',
  profile_type: 'student',
  phone: '',
  academic_page: '',
  faculty: '',
  career: '',
  student_code: '',
  campus: '',
  bio: '',
  is_active: true,
}

const profileTypeLabels = {
  student: 'Estudiante',
  teacher: 'Docente',
  staff: 'Administrativo',
  guest: 'Invitado',
  lab_manager: 'Encargado',
}

function buildPayload(form, isEditing) {
  const payload = {
    username: form.username.trim().toLowerCase(),
    name: form.name.trim(),
    profile_type: form.profile_type,
    phone: form.phone.trim(),
    academic_page: form.academic_page.trim(),
    faculty: form.faculty.trim(),
    career: form.career.trim(),
    student_code: form.student_code.trim(),
    campus: form.campus.trim(),
    bio: form.bio.trim(),
    is_active: Boolean(form.is_active),
  }

  if (form.password.trim()) {
    payload.password = form.password.trim()
  }

  if (!isEditing) {
    payload.password = form.password.trim()
  }

  return payload
}

function AdminProfilesPage({ user }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const loadProfiles = async () => {
    setLoading(true)
    try {
      const data = await listUserProfiles()
      setProfiles(data)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los perfiles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const summary = useMemo(() => {
    const active = profiles.filter((item) => item.is_active !== false).length
    const teachers = profiles.filter((item) => item.profile_type === 'teacher').length
    const students = profiles.filter((item) => item.profile_type === 'student').length

    return { active, teachers, students }
  }, [profiles])
  const canManageProfiles = hasAnyPermission(user, ['gestionar_roles_permisos'])
  const canReactivateAccounts = hasAnyPermission(user, ['reactivar_cuentas'])

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const resetForm = () => {
    setEditingUserId(null)
    setForm(defaultForm)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    resetFeedback()

    try {
      const payload = buildPayload(form, Boolean(editingUserId))

      if (editingUserId) {
        await updateUserProfile(editingUserId, payload)
        setMessage('Perfil actualizado correctamente.')
      } else {
        await createUserProfile(payload)
        setMessage('Perfil creado correctamente.')
      }

      resetForm()
      await loadProfiles()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil')
    }
  }

  const handleEdit = (profile) => {
    setEditingUserId(profile.id)
    setForm({
      username: profile.username || '',
      password: '',
      name: profile.name || '',
      profile_type: profile.profile_type || 'student',
      phone: profile.phone || '',
      academic_page: profile.academic_page || '',
      faculty: profile.faculty || '',
      career: profile.career || '',
      student_code: profile.student_code || '',
      campus: profile.campus || '',
      bio: profile.bio || '',
      is_active: profile.is_active !== false,
    })
  }

  return (
    <section className="profiles-page" aria-label="Gestión de perfiles">
      <header className="profiles-header">
        <div>
          <p className="profiles-kicker">Gestión de usuarios</p>
          <h2>Perfiles de estudiantes y docentes</h2>
          <p>
            Crea y edita perfiles institucionales sin mezclar esta información con la pestaña de roles.
            La asignación RBAC sigue viviendo en <strong>Roles</strong>.
          </p>
        </div>
        <div className="profiles-summary">
          <div><span>Perfiles</span><strong>{profiles.length}</strong></div>
          <div><span>Activos</span><strong>{summary.active}</strong></div>
          <div><span>Docentes</span><strong>{summary.teachers}</strong></div>
          <div><span>Estudiantes</span><strong>{summary.students}</strong></div>
        </div>
      </header>

      {message ? <p className="profiles-alert success">{message}</p> : null}
      {error ? <p className="profiles-alert error">{error}</p> : null}
      {!canManageProfiles ? (
        <p className="profiles-alert error">
          Tu rol solo puede reactivar o desactivar cuentas. La creación y edición completa de perfiles requiere <strong>gestionar_roles_permisos</strong>.
        </p>
      ) : null}

      <div className="profiles-grid">
        <section className="profiles-card">
          <div className="profiles-card-head">
            <div>
              <h3>{editingUserId ? 'Editar perfil' : 'Crear perfil'}</h3>
              <p>Registra correos institucionales y la información académica base de cada usuario.</p>
            </div>
          </div>

          <form className="profiles-form" onSubmit={handleSubmit}>
            <div className="profiles-form-grid">
              <label>
                <span>Correo institucional</span>
                <input
                  type="email"
                  value={form.username}
                  onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="nombre@ucb.edu.bo"
                  required
                  disabled={Boolean(editingUserId) || !canManageProfiles}
                />
              </label>
              <label>
                <span>Nombre completo</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  disabled={!canManageProfiles}
                />
              </label>
              <label>
                <span>Tipo de perfil</span>
                <select
                  value={form.profile_type}
                  onChange={(event) => setForm((prev) => ({ ...prev, profile_type: event.target.value }))}
                  disabled={!canManageProfiles}
                >
                  {Object.entries(profileTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{editingUserId ? 'Nueva contraseña temporal' : 'Contraseña temporal'}</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder={editingUserId ? 'Solo si deseas cambiarla' : 'Minimo 8 caracteres'}
                  required={!editingUserId}
                  disabled={!canManageProfiles}
                />
              </label>
              <label>
                <span>Teléfono</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  disabled={!canManageProfiles}
                />
              </label>
              <label>
                <span>Página académica</span>
                <input
                  value={form.academic_page}
                  onChange={(event) => setForm((prev) => ({ ...prev, academic_page: event.target.value }))}
                  placeholder="https://..."
                  disabled={!canManageProfiles}
                />
              </label>
              <label>
                <span>Facultad</span>
                <input
                  value={form.faculty}
                  onChange={(event) => setForm((prev) => ({ ...prev, faculty: event.target.value }))}
                  disabled={!canManageProfiles}
                />
              </label>
              <label>
                <span>Carrera</span>
                <input
                  value={form.career}
                  onChange={(event) => setForm((prev) => ({ ...prev, career: event.target.value }))}
                  disabled={!canManageProfiles}
                />
              </label>
              <label>
                <span>Código institucional</span>
                <input
                  value={form.student_code}
                  onChange={(event) => setForm((prev) => ({ ...prev, student_code: event.target.value }))}
                  disabled={!canManageProfiles}
                />
              </label>
              <label>
                <span>Campus</span>
                <input
                  value={form.campus}
                  onChange={(event) => setForm((prev) => ({ ...prev, campus: event.target.value }))}
                  disabled={!canManageProfiles}
                />
              </label>
            </div>

            <label>
              <span>Resumen del perfil</span>
              <textarea
                rows="4"
                value={form.bio}
                onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                disabled={!canManageProfiles}
              />
            </label>

            <label className="profiles-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                disabled={!canReactivateAccounts}
              />
              <span>Perfil activo para ingreso al sistema</span>
            </label>

            <div className="profiles-actions">
              <button
                type="submit"
                className="profiles-primary"
                disabled={(!canManageProfiles && !editingUserId) || (!canManageProfiles && !canReactivateAccounts)}
              >
                {editingUserId ? 'Guardar perfil' : 'Crear perfil'}
              </button>
              {!canManageProfiles && !canReactivateAccounts ? (
                <button type="button" className="profiles-secondary" disabled>
                  Sin permisos de edición
                </button>
              ) : null}
              {editingUserId ? (
                <button type="button" className="profiles-secondary" onClick={resetForm}>
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="profiles-card">
          <div className="profiles-card-head">
            <div>
              <h3>Directorio institucional</h3>
              <p>Revisa y actualiza la ficha académica de estudiantes, docentes y encargados.</p>
            </div>
          </div>

          {loading ? (
            <p className="profiles-empty">Cargando perfiles...</p>
          ) : (
            <div className="profiles-list">
              {profiles.map((profile) => (
                <article key={profile.id} className="profiles-item">
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
                    <span>{profileTypeLabels[profile.profile_type] || 'Sin clasificar'}</span>
                    <span>{profile.faculty || 'Sin facultad'}</span>
                    <span>{profile.career || 'Sin carrera'}</span>
                    <span>{profile.role || 'Sin rol RBAC'}</span>
                  </div>

                  <p className="profiles-bio">{profile.bio || 'Sin resumen académico registrado.'}</p>

                  <div className="profiles-details">
                    <div><span>Teléfono</span><strong>{profile.phone || 'No registrado'}</strong></div>
                    <div><span>Código</span><strong>{profile.student_code || 'No registrado'}</strong></div>
                    <div><span>Campus</span><strong>{profile.campus || 'No registrado'}</strong></div>
                    <div><span>Página</span><strong>{profile.academic_page || 'No registrada'}</strong></div>
                  </div>

                  <div className="profiles-actions compact">
                    <button type="button" className="profiles-secondary" onClick={() => handleEdit(profile)} disabled={!canManageProfiles && !canReactivateAccounts}>
                      Editar perfil
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
