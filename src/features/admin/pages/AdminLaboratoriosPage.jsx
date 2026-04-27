import { useEffect, useMemo, useState } from 'react'
import {
  createLab,
  deleteLab,
  listAdminAreas,
  listAdminLabs,
  updateLab,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import './AdminAssetsPage.css'

const ACCESS_ROLE_OPTIONS = ['Estudiante', 'Docente', 'Auxiliar', 'Encargado', 'Administrador']

const defaultForm = {
  name: '',
  location: '',
  capacity: 20,
  description: '',
  area_id: '',
  is_active: true,
  allowed_roles: [],
  allowed_user_ids: [],
  required_permissions: [],
}

function parseAccessList(value) {
  return Array.from(new Set(String(value || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)))
}

function formatAccessList(value) {
  return Array.isArray(value) ? value.join(', ') : ''
}

function summarizeAccess(lab) {
  const parts = []
  if (Array.isArray(lab.allowed_roles) && lab.allowed_roles.length) {
    parts.push(`Roles: ${lab.allowed_roles.join(', ')}`)
  }
  if (Array.isArray(lab.allowed_user_ids) && lab.allowed_user_ids.length) {
    parts.push(`${lab.allowed_user_ids.length} usuario(s) especifico(s)`)
  }
  if (Array.isArray(lab.required_permissions) && lab.required_permissions.length) {
    parts.push(`Permisos: ${lab.required_permissions.join(', ')}`)
  }
  return parts.length ? parts.join(' · ') : 'Acceso general para usuarios activos'
}

function AdminLaboratoriosPage({ user }) {
  const [areas, setAreas] = useState([])
  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmModal, setConfirmModal] = useState(null)

  const canManage = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])

  const loadData = async () => {
    setLoading(true)
    try {
      const [areasData, labsData] = await Promise.all([listAdminAreas(), listAdminLabs()])
      setAreas(areasData)
      setLabs(labsData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los laboratorios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const areaNameById = useMemo(
    () => Object.fromEntries(areas.map((area) => [String(area.id), area.name])),
    [areas],
  )

  const resetForm = () => {
    setEditingId(null)
    setForm(defaultForm)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canManage) return
    setError('')
    setMessage('')
    const payload = { ...form, area_id: String(form.area_id || ''), capacity: Number(form.capacity) }
    try {
      if (editingId) {
        await updateLab(editingId, payload)
        setMessage('Laboratorio actualizado correctamente.')
      } else {
        await createLab(payload)
        setMessage('Laboratorio creado correctamente.')
      }
      resetForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el laboratorio')
    }
  }

  const handleDelete = (labId) => {
    setConfirmModal({
      message: 'Esta accion no se puede deshacer.',
      onConfirm: async () => {
        setConfirmModal(null)
        setError('')
        setMessage('')
        try {
          await deleteLab(labId)
          setMessage('Laboratorio eliminado correctamente.')
          await loadData()
        } catch (err) {
          setError(err.message || 'No se pudo eliminar el laboratorio')
        }
      },
    })
  }

  return (
    <section className="infra-page" aria-label="Laboratorios">
      {confirmModal ? (
        <ConfirmModal
          title="Eliminar laboratorio"
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Estructura academica</p>
          <h2>Espacios de laboratorio</h2>
          <p>Define capacidad, ubicacion y area para que cada reserva use datos confiables.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total</span><strong>{labs.length}</strong></div>
          <div><span>Activos</span><strong>{labs.filter((l) => l.is_active !== false).length}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {loading ? (
        <p className="infra-empty" style={{margin: '24px 40px'}}>Cargando laboratorios...</p>
      ) : (
        <div className="infra-grid">
          <section className="infra-card infra-card-full">
            <div className="infra-section-head">
              <div>
                <h3>Laboratorios</h3>
                <p>Cada laboratorio pertenece a un area y puede recibir reservas.</p>
              </div>
            </div>

            <div className="infra-list">
              {labs.map((lab) => (
                <article key={lab.id} className="infra-item">
                  <div>
                    <strong>{lab.name}</strong>
                    <p>{lab.location} · Capacidad {lab.capacity}</p>
                    <small>{lab.area_name || areaNameById[String(lab.area_id)] || 'Sin area'}</small>
                    <small>{summarizeAccess(lab)}</small>
                  </div>
                  <div className="infra-actions compact">
                    <button
                      type="button"
                      className="infra-secondary"
                      disabled={!canManage}
                      onClick={() => {
                        setEditingId(lab.id)
                        setForm({
                          name: lab.name,
                          location: lab.location,
                          capacity: lab.capacity,
                          description: lab.description || '',
                          area_id: String(lab.area_id),
                          is_active: lab.is_active !== false,
                          allowed_roles: Array.isArray(lab.allowed_roles) ? lab.allowed_roles : [],
                          allowed_user_ids: Array.isArray(lab.allowed_user_ids) ? lab.allowed_user_ids : [],
                          required_permissions: Array.isArray(lab.required_permissions) ? lab.required_permissions : [],
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="infra-danger"
                      disabled={!canManage}
                      onClick={() => handleDelete(lab.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <details className="ux-extra-toggle" open={Boolean(editingId)}>
              <summary>{editingId ? 'Editar laboratorio seleccionado' : 'Agregar laboratorio'}</summary>
              <div className="ux-extra-toggle-content">
                <form className="infra-form" onSubmit={handleSubmit}>
                  <div className="infra-form-section">
                    <span className="infra-form-section-label">1 — Identificacion y area</span>
                    <div className="infra-form-grid">
                      <label>
                        <span>Nombre</span>
                        <input
                          value={form.name}
                          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                          required
                          disabled={!canManage}
                        />
                      </label>
                      <label>
                        <span>Area</span>
                        <select
                          value={form.area_id}
                          onChange={(event) => setForm((prev) => ({ ...prev, area_id: event.target.value }))}
                          required
                          disabled={!canManage}
                        >
                          <option value="">Selecciona un area</option>
                          {areas.map((area) => (
                            <option key={area.id} value={area.id}>{area.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="infra-form-section">
                    <span className="infra-form-section-label">2 — Ubicacion y capacidad</span>
                    <div className="infra-form-grid">
                      <label>
                        <span>Ubicacion</span>
                        <input
                          value={form.location}
                          onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                          required
                          disabled={!canManage}
                        />
                      </label>
                      <label>
                        <span>Capacidad</span>
                        <input
                          type="number"
                          min="1"
                          value={form.capacity}
                          onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
                          required
                          disabled={!canManage}
                        />
                      </label>
                    </div>
                    <label>
                      <span>Descripcion</span>
                      <textarea
                        rows="3"
                        value={form.description}
                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                        disabled={!canManage}
                      />
                    </label>
                  </div>
                  <div className="infra-form-section">
                    <span className="infra-form-section-label">3 — Configuracion</span>
                    <label className="infra-checkbox">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                        disabled={!canManage}
                      />
                      <span>Laboratorio activo para reservas</span>
                    </label>
                  </div>
                  <div className="infra-form-section">
                    <span className="infra-form-section-label">4 — Acceso a reservas</span>
                    <p className="infra-muted">
                      Si dejas estos campos vacios, cualquier usuario activo con acceso al modulo podra ver y reservar este laboratorio.
                    </p>
                    <div className="infra-form-grid">
                      <label>
                        <span>Roles autorizados</span>
                        <select
                          multiple
                          value={form.allowed_roles}
                          onChange={(event) => setForm((prev) => ({
                            ...prev,
                            allowed_roles: Array.from(event.target.selectedOptions, (option) => option.value),
                          }))}
                          disabled={!canManage}
                        >
                          {ACCESS_ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <small>Usa Ctrl o Shift para seleccionar varios roles.</small>
                      </label>
                      <label>
                        <span>Permisos requeridos</span>
                        <textarea
                          rows="3"
                          value={formatAccessList(form.required_permissions)}
                          onChange={(event) => setForm((prev) => ({
                            ...prev,
                            required_permissions: parseAccessList(event.target.value),
                          }))}
                          placeholder="Ej. reservar_laboratorio_especial"
                          disabled={!canManage}
                        />
                        <small>Opcional. Separa permisos con coma o salto de linea.</small>
                      </label>
                    </div>
                    <label>
                      <span>Usuarios autorizados especificos</span>
                      <textarea
                        rows="3"
                        value={formatAccessList(form.allowed_user_ids)}
                        onChange={(event) => setForm((prev) => ({
                          ...prev,
                          allowed_user_ids: parseAccessList(event.target.value),
                        }))}
                        placeholder="Ej. 3gyzwrw9yophi7r, je3b9oa1ilac1af"
                        disabled={!canManage}
                      />
                      <small>Opcional. Sirve para laboratorios restringidos por usuario interno.</small>
                    </label>
                  </div>
                  <div className="infra-actions">
                    <button type="submit" className="infra-primary" disabled={!canManage}>
                      {editingId ? 'Actualizar laboratorio' : 'Crear laboratorio'}
                    </button>
                    {editingId ? (
                      <button type="button" className="infra-secondary" onClick={resetForm} disabled={!canManage}>
                        Cancelar edicion
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            </details>
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminLaboratoriosPage
