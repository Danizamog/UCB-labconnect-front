import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  createAsset,
  deleteAsset,
  listAdminLabs,
  listAssets,
  listAssetStatusHistory,
  updateAsset,
  updateAssetStatus,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import { assetStatusBadgeClass, assetStatusLabel, formatDateTime } from '../../../shared/utils/formatters'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import './AdminAssetsPage.css'

const defaultForm = { name: '', category: '', location: '', description: '', serial_number: '', laboratory_id: '', status: 'available' }

function normalizeLabId(value) {
  return value === '' ? '' : String(value)
}

function AdminEquiposPage({ user }) {
  const [labs, setLabs] = useState([])
  const [assets, setAssets] = useState([])
  const [assetStatusHistory, setAssetStatusHistory] = useState({})
  const [selectedAssetHistoryId, setSelectedAssetHistoryId] = useState(null)
  const [assetHistoryLoadingId, setAssetHistoryLoadingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmModal, setConfirmModal] = useState(null)

  const canManage = hasAnyPermission(user, ['gestionar_inventario'])
  const canManageStatus = hasAnyPermission(user, ['gestionar_estado_equipos', 'gestionar_mantenimiento'])

  const loadData = async () => {
    setLoading(true)
    try {
      const [labsData, assetsData] = await Promise.all([listAdminLabs(), listAssets()])
      setLabs(labsData)
      setAssets(assetsData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los equipos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
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
    if (!form.location.trim()) {
      setError('La ubicacion del equipo es obligatoria.')
      return
    }
    const payload = { ...form, location: form.location.trim(), laboratory_id: normalizeLabId(form.laboratory_id) }
    try {
      if (editingId) {
        await updateAsset(editingId, payload)
        setMessage('Equipo actualizado correctamente.')
      } else {
        await createAsset(payload)
        setMessage('Equipo creado correctamente.')
      }
      resetForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el equipo')
    }
  }

  const handleDelete = (assetId) => {
    setConfirmModal({
      message: 'Esta accion no se puede deshacer.',
      onConfirm: async () => {
        setConfirmModal(null)
        setError('')
        setMessage('')
        try {
          await deleteAsset(assetId)
          setMessage('Equipo eliminado correctamente.')
          await loadData()
        } catch (err) {
          setError(err.message || 'No se pudo eliminar el equipo')
        }
      },
    })
  }

  const handleStatusChange = async (assetId, status) => {
    if (!canManageStatus) return
    setError('')
    setMessage('')
    try {
      const updated = await updateAssetStatus(assetId, status)
      setAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)))
      if (selectedAssetHistoryId === assetId) {
        const history = await listAssetStatusHistory(assetId)
        setAssetStatusHistory((prev) => ({ ...prev, [assetId]: history }))
      }
      setMessage('Estado del equipo actualizado correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado del equipo')
    }
  }

  const handleToggleHistory = async (assetId) => {
    if (selectedAssetHistoryId === assetId) {
      setSelectedAssetHistoryId(null)
      return
    }
    setSelectedAssetHistoryId(assetId)
    if (assetStatusHistory[assetId]) return
    setAssetHistoryLoadingId(assetId)
    try {
      const history = await listAssetStatusHistory(assetId)
      setAssetStatusHistory((prev) => ({ ...prev, [assetId]: history }))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial del equipo')
    } finally {
      setAssetHistoryLoadingId(null)
    }
  }

  return (
    <section className="infra-page" aria-label="Equipos">
      {confirmModal ? (
        <ConfirmModal
          title="Eliminar equipo"
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Inventario</p>
          <h2>Equipos</h2>
          <p>Gestiona hardware y equipos vinculados a cada espacio.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total</span><strong>{assets.length}</strong></div>
          <div><span>Disponibles</span><strong>{assets.filter((a) => a.status === 'available').length}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {loading ? (
        <p className="infra-empty">Cargando equipos...</p>
      ) : (
        <div className="infra-grid">
          <section className="infra-card infra-card-full">
            <div className="infra-section-head">
              <div>
                <h3>Equipos</h3>
                <p>Registra cada equipo con su ubicacion y estado actual.</p>
              </div>
            </div>

            {canManage ? (
              <form className="infra-form" onSubmit={handleSubmit}>
                <div className="infra-form-section">
                  <span className="infra-form-section-label">1 — Datos del equipo</span>
                  <div className="infra-form-grid">
                    <label>
                      <span>Nombre del equipo</span>
                      <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
                    </label>
                    <label>
                      <span>Categoria</span>
                      <input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} required />
                    </label>
                    <label>
                      <span>Numero de serie</span>
                      <input value={form.serial_number} onChange={(e) => setForm((prev) => ({ ...prev, serial_number: e.target.value }))} />
                    </label>
                    <label>
                      <span>Ubicacion</span>
                      <input
                        value={form.location}
                        onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                        placeholder="Mesa 4, gabinete 2 o estante A"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    <span>Descripcion</span>
                    <textarea rows="3" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </label>
                </div>
                <div className="infra-form-section">
                  <span className="infra-form-section-label">2 — Asignacion y estado</span>
                  <div className="infra-form-grid">
                    <label>
                      <span>Laboratorio</span>
                      <select value={form.laboratory_id} onChange={(e) => setForm((prev) => ({ ...prev, laboratory_id: e.target.value }))}>
                        <option value="">Sin laboratorio fijo</option>
                        {labs.map((lab) => (
                          <option key={lab.id} value={lab.id}>{lab.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Estado</span>
                      <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                        <option value="available">Disponible</option>
                        <option value="loaned">Prestado</option>
                        <option value="maintenance">Mantenimiento</option>
                        <option value="damaged">Danado</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="infra-actions">
                  <button type="submit" className="infra-primary">
                    {editingId ? 'Actualizar equipo' : 'Crear equipo'}
                  </button>
                  {editingId ? (
                    <button type="button" className="infra-secondary" onClick={resetForm}>
                      Cancelar edicion
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}

            <div className="infra-table-wrap">
              <table className="infra-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Categoria</th>
                    <th>Ubicacion</th>
                    <th>Laboratorio</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <Fragment key={asset.id}>
                      <tr>
                        <td>
                          <strong>{asset.name}</strong>
                          {asset.serial_number ? <small>Serie {asset.serial_number}</small> : null}
                        </td>
                        <td>{asset.category}</td>
                        <td>{asset.location || 'Sin ubicacion'}</td>
                        <td>{asset.laboratory_id ? labNameById[String(asset.laboratory_id)] || `Lab ${asset.laboratory_id}` : 'General'}</td>
                        <td>
                          <div className="infra-status-cell">
                            <span className={`infra-status-badge ${assetStatusBadgeClass(asset.status)}`}>
                              {assetStatusLabel(asset.status)}
                            </span>
                            <small>
                              {asset.status_updated_by
                                ? `Ultimo cambio: ${asset.status_updated_by} · ${formatDateTime(asset.status_updated_at)}`
                                : 'Sin cambios registrados'}
                            </small>
                            {canManageStatus ? (
                              <select value={asset.status} onChange={(e) => handleStatusChange(asset.id, e.target.value)}>
                                <option value="available">Disponible</option>
                                <option value="loaned">Prestado</option>
                                <option value="maintenance">Mantenimiento</option>
                                <option value="damaged">Danado</option>
                              </select>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="infra-actions compact">
                            <button type="button" className="infra-secondary" onClick={() => handleToggleHistory(asset.id)}>
                              {selectedAssetHistoryId === asset.id ? 'Ocultar historial' : 'Ver historial'}
                            </button>
                            {canManage ? (
                              <>
                                <button
                                  type="button"
                                  className="infra-secondary"
                                  onClick={() => {
                                    setEditingId(asset.id)
                                    setForm({
                                      name: asset.name,
                                      category: asset.category,
                                      location: asset.location || '',
                                      description: asset.description || '',
                                      serial_number: asset.serial_number || '',
                                      laboratory_id: asset.laboratory_id ? String(asset.laboratory_id) : '',
                                      status: asset.status,
                                    })
                                  }}
                                >
                                  Editar
                                </button>
                                <button type="button" className="infra-danger" onClick={() => handleDelete(asset.id)}>
                                  Eliminar
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {selectedAssetHistoryId === asset.id ? (
                        <tr className="infra-history-row">
                          <td colSpan="6">
                            <div className="infra-history-panel">
                              <div className="infra-history-head">
                                <strong>Historial de estados</strong>
                                <span>{assetHistoryLoadingId === asset.id ? 'Cargando...' : `${(assetStatusHistory[asset.id] || []).length} registro(s)`}</span>
                              </div>
                              {assetHistoryLoadingId === asset.id ? (
                                <p className="infra-empty">Cargando historial...</p>
                              ) : (assetStatusHistory[asset.id] || []).length === 0 ? (
                                <p className="infra-empty">Aun no hay cambios de estado registrados para este equipo.</p>
                              ) : (
                                <div className="infra-history-list">
                                  {(assetStatusHistory[asset.id] || []).map((entry) => (
                                    <article key={entry.id} className="infra-history-item">
                                      <div>
                                        <span className={`infra-status-badge ${assetStatusBadgeClass(entry.next_status)}`}>
                                          {entry.previous_status
                                            ? `${assetStatusLabel(entry.previous_status)} → ${assetStatusLabel(entry.next_status)}`
                                            : assetStatusLabel(entry.next_status)}
                                        </span>
                                        <small>{formatDateTime(entry.changed_at)}</small>
                                      </div>
                                      <div>
                                        <strong>{entry.changed_by}</strong>
                                        <small>{entry.notes || 'Cambio auditado desde el sistema.'}</small>
                                      </div>
                                    </article>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminEquiposPage
