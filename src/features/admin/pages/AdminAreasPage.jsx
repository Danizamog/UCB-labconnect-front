import { useEffect, useState } from 'react'
import {
  createArea,
  deleteArea,
  listAdminAreas,
  updateArea,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminAssetsPage.css'

const defaultForm = { name: '', description: '', is_active: true }

function AdminAreasPage({ user }) {
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const canManage = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])

  const loadData = async () => {
    setLoading(true)
    try {
      setAreas(await listAdminAreas())
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las areas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm(defaultForm)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canManage) return
    setError('')
    setMessage('')
    try {
      if (editingId) {
        await updateArea(editingId, form)
        setMessage('Area actualizada correctamente.')
      } else {
        await createArea(form)
        setMessage('Area creada correctamente.')
      }
      resetForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el area')
    }
  }

  const handleDelete = async (areaId) => {
    if (!window.confirm('Deseas eliminar esta area?')) return
    setError('')
    setMessage('')
    try {
      await deleteArea(areaId)
      setMessage('Area eliminada correctamente.')
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el area')
    }
  }

  return (
    <section className="infra-page" aria-label="Areas academicas">
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Estructura academica</p>
          <h2>Areas</h2>
          <p>Crea agrupadores como Quimica, Fisica o Tecnologia para organizar los laboratorios.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total areas</span><strong>{areas.length}</strong></div>
          <div><span>Activas</span><strong>{areas.filter((a) => a.is_active).length}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {loading ? (
        <p className="infra-empty" style={{margin: '24px 40px'}}>Cargando areas...</p>
      ) : (
        <div className="infra-grid">
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Areas academicas</h3>
                <p>Cada area agrupa uno o mas laboratorios.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleSubmit}>
              <label>
                <span>Nombre del area</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  disabled={!canManage}
                />
              </label>
              <label>
                <span>Descripcion</span>
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  disabled={!canManage}
                />
              </label>
              <label className="infra-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  disabled={!canManage}
                />
                <span>Area activa para estudiantes</span>
              </label>
              <div className="infra-actions">
                <button type="submit" className="infra-primary" disabled={!canManage}>
                  {editingId ? 'Actualizar area' : 'Crear area'}
                </button>
                {editingId ? (
                  <button type="button" className="infra-secondary" onClick={resetForm} disabled={!canManage}>
                    Cancelar edicion
                  </button>
                ) : null}
              </div>
            </form>

            <div className="infra-list">
              {areas.map((area) => (
                <article key={area.id} className="infra-item">
                  <div>
                    <strong>{area.name}</strong>
                    <p>{area.description || 'Sin descripcion registrada.'}</p>
                    <small>{area.is_active ? 'Visible para usuarios' : 'Oculta para usuarios'}</small>
                  </div>
                  <div className="infra-actions compact">
                    <button
                      type="button"
                      className="infra-secondary"
                      disabled={!canManage}
                      onClick={() => {
                        setEditingId(area.id)
                        setForm({ name: area.name, description: area.description || '', is_active: area.is_active })
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="infra-danger"
                      disabled={!canManage}
                      onClick={() => handleDelete(area.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminAreasPage
