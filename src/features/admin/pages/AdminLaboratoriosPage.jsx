import { useEffect, useMemo, useState } from 'react'
import {
  createLab,
  deleteLab,
  listAdminAreas,
  listAdminLabs,
  updateLab,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminAssetsPage.css'

const defaultForm = { name: '', location: '', capacity: 20, description: '', area_id: '', is_active: true }

function AdminLaboratoriosPage({ user }) {
  const [areas, setAreas] = useState([])
  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultForm)

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

  const handleDelete = async (labId) => {
    if (!window.confirm('Deseas eliminar este laboratorio?')) return
    setError('')
    setMessage('')
    try {
      await deleteLab(labId)
      setMessage('Laboratorio eliminado correctamente.')
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el laboratorio')
    }
  }

  return (
    <section className="infra-page" aria-label="Laboratorios">
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Estructura academica</p>
          <h2>Laboratorios</h2>
          <p>Asocia cada laboratorio a un area y define su capacidad y ubicacion.</p>
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
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Laboratorios</h3>
                <p>Cada laboratorio pertenece a un area y puede recibir reservas.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleSubmit}>
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
              <label className="infra-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  disabled={!canManage}
                />
                <span>Laboratorio activo para reservas</span>
              </label>
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

            <div className="infra-list">
              {labs.map((lab) => (
                <article key={lab.id} className="infra-item">
                  <div>
                    <strong>{lab.name}</strong>
                    <p>{lab.location} · Capacidad {lab.capacity}</p>
                    <small>{lab.area_name || areaNameById[String(lab.area_id)] || 'Sin area'}</small>
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
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminLaboratoriosPage
