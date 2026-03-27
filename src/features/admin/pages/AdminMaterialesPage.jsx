import { useEffect, useMemo, useState } from 'react'
import {
  createMaterial,
  createMaterialMovement,
  deleteMaterial,
  listAdminLabs,
  listMaterialMovements,
  listMaterials,
  updateMaterial,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import { formatDateTime, movementTypeLabel } from '../../../shared/utils/formatters'
import './AdminAssetsPage.css'

const defaultMaterialForm = { name: '', category: '', unit: 'unidad', quantity_available: 0, minimum_stock: 0, laboratory_id: '', description: '' }
const defaultMovementForm = { stock_item_id: '', movement_type: 'entry', quantity: 1, notes: '' }

function normalizeLabId(value) {
  return value === '' ? '' : String(value)
}

function AdminMaterialesPage({ user }) {
  const [labs, setLabs] = useState([])
  const [materials, setMaterials] = useState([])
  const [materialMovements, setMaterialMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [materialForm, setMaterialForm] = useState(defaultMaterialForm)
  const [movementForm, setMovementForm] = useState(defaultMovementForm)

  const canManage = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])

  const loadData = async () => {
    setLoading(true)
    try {
      const [labsData, materialsData] = await Promise.all([listAdminLabs(), listMaterials()])
      setLabs(labsData)
      setMaterials(materialsData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los materiales')
    } finally {
      setLoading(false)
    }
    try {
      const movementsData = await listMaterialMovements(null, 25)
      setMaterialMovements(movementsData)
    } catch {
      // historial de movimientos no critico
    }
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!movementForm.stock_item_id && materials.length > 0) {
      setMovementForm((prev) => ({ ...prev, stock_item_id: String(materials[0].id) }))
    }
  }, [materials, movementForm.stock_item_id])

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )

  const selectedMovementMaterial = useMemo(
    () => materials.find((m) => String(m.id) === String(movementForm.stock_item_id)) || null,
    [materials, movementForm.stock_item_id],
  )

  const lowStockMaterials = useMemo(
    () => materials.filter((m) => Number(m.quantity_available) <= Number(m.minimum_stock || 0)),
    [materials],
  )

  const movementWillExceedStock = useMemo(() => {
    if (!selectedMovementMaterial || movementForm.movement_type !== 'consumption') return false
    return Number(movementForm.quantity || 0) > Number(selectedMovementMaterial.quantity_available || 0)
  }, [movementForm.movement_type, movementForm.quantity, selectedMovementMaterial])

  const resetMaterialForm = () => {
    setEditingId(null)
    setMaterialForm(defaultMaterialForm)
  }

  const handleMaterialSubmit = async (event) => {
    event.preventDefault()
    if (!canManage) return
    setError('')
    setMessage('')
    const payload = {
      ...materialForm,
      quantity_available: Number(materialForm.quantity_available),
      minimum_stock: Number(materialForm.minimum_stock),
      laboratory_id: normalizeLabId(materialForm.laboratory_id),
    }
    try {
      if (editingId) {
        await updateMaterial(editingId, payload)
        setMessage('Material actualizado correctamente.')
      } else {
        await createMaterial(payload)
        setMessage('Material creado correctamente.')
      }
      resetMaterialForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el material')
    }
  }

  const handleDelete = async (materialId) => {
    if (!window.confirm('Deseas eliminar este material?')) return
    setError('')
    setMessage('')
    try {
      await deleteMaterial(materialId)
      setMessage('Material eliminado correctamente.')
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el material')
    }
  }

  const handleMovementSubmit = async (event) => {
    event.preventDefault()
    if (!canManage) return
    setError('')
    setMessage('')
    if (!movementForm.stock_item_id) {
      setError('Selecciona un material para registrar el movimiento.')
      return
    }
    if (movementWillExceedStock) {
      setError('No puedes descontar mas unidades de las disponibles en stock.')
      return
    }
    try {
      await createMaterialMovement(String(movementForm.stock_item_id), {
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity),
        notes: movementForm.notes.trim() || undefined,
      })
      setMessage('Movimiento de stock registrado y auditado correctamente.')
      setMovementForm((prev) => ({ ...defaultMovementForm, stock_item_id: prev.stock_item_id }))
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento de stock')
    }
  }

  return (
    <section className="infra-page" aria-label="Materiales y reactivos">
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Inventario</p>
          <h2>Materiales</h2>
          <p>Estos materiales son los que el usuario puede reservar junto con su practica.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total</span><strong>{materials.length}</strong></div>
          <div><span>Alertas de stock</span><strong>{lowStockMaterials.length}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {loading ? (
        <p className="infra-empty">Cargando materiales...</p>
      ) : (
        <div className="infra-grid">
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Materiales y reactivos</h3>
                <p>Registra cada material con stock disponible y minimo.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleMaterialSubmit}>
              <div className="infra-form-grid">
                <label>
                  <span>Nombre del material</span>
                  <input value={materialForm.name} onChange={(e) => setMaterialForm((prev) => ({ ...prev, name: e.target.value }))} required disabled={!canManage} />
                </label>
                <label>
                  <span>Categoria</span>
                  <input value={materialForm.category} onChange={(e) => setMaterialForm((prev) => ({ ...prev, category: e.target.value }))} required disabled={!canManage} />
                </label>
                <label>
                  <span>Unidad</span>
                  <input value={materialForm.unit} onChange={(e) => setMaterialForm((prev) => ({ ...prev, unit: e.target.value }))} required disabled={!canManage} />
                </label>
                <label>
                  <span>Stock disponible</span>
                  <input type="number" min="0" value={materialForm.quantity_available} onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity_available: e.target.value }))} required disabled={!canManage} />
                </label>
                <label>
                  <span>Stock minimo</span>
                  <input type="number" min="0" value={materialForm.minimum_stock} onChange={(e) => setMaterialForm((prev) => ({ ...prev, minimum_stock: e.target.value }))} required disabled={!canManage} />
                </label>
                <label>
                  <span>Laboratorio</span>
                  <select value={materialForm.laboratory_id} onChange={(e) => setMaterialForm((prev) => ({ ...prev, laboratory_id: e.target.value }))} disabled={!canManage}>
                    <option value="">Disponible para cualquier laboratorio</option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Descripcion</span>
                <textarea rows="3" value={materialForm.description} onChange={(e) => setMaterialForm((prev) => ({ ...prev, description: e.target.value }))} disabled={!canManage} />
              </label>
              {canManage ? (
                <div className="infra-actions">
                  <button type="submit" className="infra-primary">
                    {editingId ? 'Actualizar material' : 'Crear material'}
                  </button>
                  {editingId ? (
                    <button type="button" className="infra-secondary" onClick={resetMaterialForm}>
                      Cancelar edicion
                    </button>
                  ) : null}
                </div>
              ) : null}
            </form>
          </section>

          <section className="infra-card">
            <section className="infra-stock-ops">
              <div className="infra-stock-panel">
                <div className="infra-section-head">
                  <div>
                    <h3>Movimientos de stock</h3>
                    <p>Registra ingresos, devoluciones o consumos con validacion y trazabilidad.</p>
                  </div>
                </div>

                <form className="infra-form" onSubmit={handleMovementSubmit}>
                  <div className="infra-form-grid">
                    <label>
                      <span>Material</span>
                      <select value={movementForm.stock_item_id} onChange={(e) => setMovementForm((prev) => ({ ...prev, stock_item_id: e.target.value }))} disabled={!canManage} required>
                        <option value="">Selecciona un material</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.quantity_available} {m.unit})</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Tipo de movimiento</span>
                      <select value={movementForm.movement_type} onChange={(e) => setMovementForm((prev) => ({ ...prev, movement_type: e.target.value }))} disabled={!canManage}>
                        <option value="entry">Ingreso / compra</option>
                        <option value="return">Devolucion</option>
                        <option value="consumption">Consumo / merma</option>
                      </select>
                    </label>
                    <label>
                      <span>Cantidad</span>
                      <input
                        type="number"
                        min="1"
                        max={movementForm.movement_type === 'consumption' ? selectedMovementMaterial?.quantity_available || 1 : undefined}
                        value={movementForm.quantity}
                        onChange={(e) => setMovementForm((prev) => ({ ...prev, quantity: e.target.value }))}
                        disabled={!canManage}
                        required
                      />
                    </label>
                    <label>
                      <span>Stock actual</span>
                      <input value={selectedMovementMaterial ? `${selectedMovementMaterial.quantity_available} ${selectedMovementMaterial.unit}` : 'Selecciona un material'} disabled />
                    </label>
                  </div>
                  <label>
                    <span>Motivo u observaciones</span>
                    <textarea rows="3" value={movementForm.notes} onChange={(e) => setMovementForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Ej. consumo en practica de quimica, compra semestral o devolucion del grupo 2" disabled={!canManage} />
                  </label>
                  {movementWillExceedStock ? (
                    <p className="infra-inline-error">La cantidad a descontar supera el stock disponible del material seleccionado.</p>
                  ) : null}
                  <div className="infra-actions">
                    <button type="submit" className="infra-primary" disabled={!canManage || movementWillExceedStock || !movementForm.stock_item_id}>
                      Registrar movimiento
                    </button>
                    <button type="button" className="infra-secondary" onClick={() => setMovementForm(defaultMovementForm)} disabled={!canManage}>
                      Limpiar
                    </button>
                  </div>
                </form>
              </div>

              <div className="infra-stock-panel">
                <div className="infra-section-head">
                  <div>
                    <h3>Historial reciente</h3>
                    <p>Cada ajuste guarda correo, fecha, cantidad y saldo resultante.</p>
                  </div>
                  <div className="infra-stock-alert-count">
                    <span>Alertas de stock</span>
                    <strong>{lowStockMaterials.length}</strong>
                  </div>
                </div>

                {lowStockMaterials.length > 0 ? (
                  <div className="infra-chip-list">
                    {lowStockMaterials.map((m) => (
                      <span key={m.id} className="infra-chip danger">
                        {m.name}: {m.quantity_available}/{m.minimum_stock} {m.unit}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="infra-empty">No hay alertas de stock bajo en este momento.</p>
                )}

                <div className="infra-table-wrap">
                  <table className="infra-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Material</th>
                        <th>Movimiento</th>
                        <th>Cantidad</th>
                        <th>Saldo</th>
                        <th>Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialMovements.length === 0 ? (
                        <tr><td colSpan="6">Todavia no hay movimientos registrados.</td></tr>
                      ) : (
                        materialMovements.map((movement) => (
                          <tr key={movement.id}>
                            <td>{formatDateTime(movement.created_at)}</td>
                            <td>{movement.stock_item_name}</td>
                            <td>{movementTypeLabel(movement.movement_type)}</td>
                            <td className={movement.quantity_change < 0 ? 'infra-negative' : 'infra-positive'}>
                              {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                            </td>
                            <td>{movement.quantity_after}</td>
                            <td>
                              <strong>{movement.performed_by}</strong>
                              {movement.notes ? <small>{movement.notes}</small> : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </section>

          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Lista de materiales</h3>
              </div>
            </div>
            <div className="infra-table-wrap">
              <table className="infra-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Categoria</th>
                    <th>Laboratorio</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr key={material.id}>
                      <td>{material.name}</td>
                      <td>{material.category}</td>
                      <td>{material.laboratory_id ? labNameById[Number(material.laboratory_id)] || `Lab ${material.laboratory_id}` : 'General'}</td>
                      <td>
                        <strong>{material.quantity_available} {material.unit}</strong>
                        <small>Minimo {material.minimum_stock}</small>
                      </td>
                      <td>
                        <div className="infra-actions compact">
                          {canManage ? (
                            <>
                              <button type="button" className="infra-secondary" onClick={() => setMovementForm((prev) => ({ ...prev, stock_item_id: String(material.id) }))}>
                                Mover stock
                              </button>
                              <button
                                type="button"
                                className="infra-secondary"
                                onClick={() => {
                                  setEditingId(material.id)
                                  setMaterialForm({
                                    name: material.name,
                                    category: material.category,
                                    unit: material.unit,
                                    quantity_available: material.quantity_available,
                                    minimum_stock: material.minimum_stock,
                                    laboratory_id: material.laboratory_id ? String(material.laboratory_id) : '',
                                    description: material.description || '',
                                  })
                                }}
                              >
                                Editar
                              </button>
                              <button type="button" className="infra-danger" onClick={() => handleDelete(material.id)}>
                                Eliminar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
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

export default AdminMaterialesPage
