import { useEffect, useMemo, useState } from 'react'
import {
  createMaterial,
  createMaterialMovement,
  deleteMaterial,
  getStockItemsReport,
  listAdminLabs,
  listMaterialMovements,
  listMaterials,
  updateMaterial,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import { formatDateTime, movementTypeLabel } from '../../../shared/utils/formatters'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import './AdminAssetsPage.css'

const defaultMaterialForm = { name: '', category: '', unit: 'unidad', quantity_available: 0, minimum_stock: 0, laboratory_id: '', description: '' }
const defaultMovementForm = { stock_item_id: '', movement_type: 'entry', quantity: 1, notes: '' }

function normalizeLabId(value) {
  return value === '' ? '' : String(value)
}

function AdminMaterialesPage({ user }) {
  const [labs, setLabs] = useState([])
  const [materials, setMaterials] = useState([])
  const [stockReport, setStockReport] = useState(null)
  const [materialMovements, setMaterialMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [materialForm, setMaterialForm] = useState(defaultMaterialForm)
  const [movementForm, setMovementForm] = useState(defaultMovementForm)
  const [activeModal, setActiveModal] = useState(null)

  const [confirmModal, setConfirmModal] = useState(null)

  const canManage = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])

  const loadData = async () => {
    setLoading(true)
    try {
      const [labsData, materialsData, reportData] = await Promise.all([
        listAdminLabs(),
        listMaterials(),
        getStockItemsReport({ onlyLowOrOut: true }).catch(() => null),
      ])
      setLabs(labsData)
      setMaterials(materialsData)
      setStockReport(reportData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los materiales')
      setStockReport(null)
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

  const outOfStockCount = useMemo(
    () => (stockReport ? Number(stockReport.out_of_stock || 0) : materials.filter((m) => Number(m.quantity_available) <= 0).length),
    [materials, stockReport],
  )

  const stockAlertsCount = useMemo(
    () => (stockReport ? Number(stockReport.low_stock || 0) + outOfStockCount : lowStockMaterials.length),
    [lowStockMaterials.length, outOfStockCount, stockReport],
  )

  const resetMaterialForm = () => {
    setEditingId(null)
    setMaterialForm(defaultMaterialForm)
  }

  const openMaterialModal = (material = null) => {
    setError('')
    setMessage('')
    if (material) {
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
    } else {
      resetMaterialForm()
    }
    setActiveModal('material')
  }

  const openMovementModal = (material = null) => {
    setError('')
    setMessage('')
    setMovementForm((prev) => ({
      ...prev,
      stock_item_id: material?.id ? String(material.id) : prev.stock_item_id || (materials[0]?.id ? String(materials[0].id) : ''),
    }))
    setActiveModal('movement')
  }

  const closeWorkflowModal = () => {
    setActiveModal(null)
    setError('')
    if (activeModal === 'material') {
      resetMaterialForm()
    }
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
      setActiveModal(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el material')
    }
  }

  const handleDelete = (materialId) => {
    setConfirmModal({
      message: 'Esta accion no se puede deshacer.',
      onConfirm: async () => {
        setConfirmModal(null)
        setError('')
        setMessage('')
        try {
          await deleteMaterial(materialId)
          setMessage('Material eliminado correctamente.')
          await loadData()
        } catch (err) {
          setError(err.message || 'No se pudo eliminar el material')
        }
      },
    })
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
      setActiveModal(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento de stock')
    }
  }

  return (
    <section className="infra-page" aria-label="Materiales y reactivos">
      {confirmModal ? (
        <ConfirmModal
          title="Eliminar material"
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}
      {activeModal ? (
        <div className="infra-workflow-backdrop" role="dialog" aria-modal="true" aria-label={activeModal === 'material' ? 'Gestionar material' : 'Registrar movimiento de stock'}>
          <section className="infra-workflow-modal">
            <div className="infra-workflow-modal-head">
              <div>
                <p className="infra-kicker">{activeModal === 'material' ? 'Catalogo de materiales' : 'Trazabilidad de stock'}</p>
                <h3>{activeModal === 'material' ? (editingId ? 'Editar material' : 'Nuevo material') : 'Movimiento de stock'}</h3>
                <p>
                  {activeModal === 'material'
                    ? 'Registra materiales con laboratorio, unidad de medida y stock minimo para que el inventario sea facil de leer.'
                    : 'Documenta ingresos, devoluciones o consumos con saldo actualizado y observaciones para auditoria.'}
                </p>
              </div>
              <button type="button" className="infra-workflow-close" onClick={closeWorkflowModal} aria-label="Cerrar">
                x
              </button>
            </div>

            {error ? <p className="infra-alert infra-error">{error}</p> : null}

            {activeModal === 'material' ? (
              <form className="infra-form infra-workflow-form" onSubmit={handleMaterialSubmit}>
                <div className="infra-form-section">
                  <span className="infra-form-section-label">1 - Identificacion</span>
                  <div className="infra-form-grid">
                    <label>
                      <span>Nombre del material</span>
                      <input
                        value={materialForm.name}
                        onChange={(e) => setMaterialForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ej. Alcohol isopropilico, cable UTP, resistencia 220 ohm"
                        required
                        disabled={!canManage}
                      />
                    </label>
                    <label>
                      <span>Categoria</span>
                      <input
                        value={materialForm.category}
                        onChange={(e) => setMaterialForm((prev) => ({ ...prev, category: e.target.value }))}
                        placeholder="Reactivo, electronica, redes, limpieza"
                        required
                        disabled={!canManage}
                      />
                    </label>
                  </div>
                  <label>
                    <span>Descripcion</span>
                    <textarea
                      rows="3"
                      value={materialForm.description}
                      onChange={(e) => setMaterialForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Agrega detalles utiles para docentes, auxiliares o encargados."
                      disabled={!canManage}
                    />
                  </label>
                </div>

                <div className="infra-form-section">
                  <span className="infra-form-section-label">2 - Stock y asignacion</span>
                  <div className="infra-form-grid">
                    <label>
                      <span>Unidad</span>
                      <input
                        value={materialForm.unit}
                        onChange={(e) => setMaterialForm((prev) => ({ ...prev, unit: e.target.value }))}
                        placeholder="unidad, ml, g, kit, metro"
                        required
                        disabled={!canManage}
                      />
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
                    <label>
                      <span>Stock disponible</span>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.quantity_available}
                        onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity_available: e.target.value }))}
                        required
                        disabled={!canManage}
                      />
                    </label>
                    <label>
                      <span>Stock minimo</span>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.minimum_stock}
                        onChange={(e) => setMaterialForm((prev) => ({ ...prev, minimum_stock: e.target.value }))}
                        required
                        disabled={!canManage}
                      />
                    </label>
                  </div>
                </div>

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={closeWorkflowModal}>
                    Cerrar
                  </button>
                  <button type="submit" className="infra-primary" disabled={!canManage}>
                    {editingId ? 'Actualizar material' : 'Crear material'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="infra-form infra-workflow-form" onSubmit={handleMovementSubmit}>
                <div className="infra-form-section">
                  <span className="infra-form-section-label">1 - Material y tipo</span>
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
                  </div>
                </div>

                <div className="infra-form-section">
                  <span className="infra-form-section-label">2 - Cantidad y observaciones</span>
                  <div className="infra-form-grid">
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
                    <textarea
                      rows="3"
                      value={movementForm.notes}
                      onChange={(e) => setMovementForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Ej. consumo en practica de quimica, compra semestral o devolucion del grupo 2"
                      disabled={!canManage}
                    />
                  </label>
                </div>

                {movementWillExceedStock ? (
                  <p className="infra-inline-error">La cantidad a descontar supera el stock disponible del material seleccionado.</p>
                ) : null}

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={closeWorkflowModal}>
                    Cerrar
                  </button>
                  <button type="submit" className="infra-primary" disabled={!canManage || movementWillExceedStock || !movementForm.stock_item_id}>
                    Registrar movimiento
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Inventario</p>
          <h2>Materiales</h2>
          <p>Estos materiales son los que el usuario puede reservar junto con su practica.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total</span><strong>{materials.length}</strong></div>
          <div><span>Alertas de stock</span><strong>{stockAlertsCount}</strong></div>
          <div><span>Sin stock</span><strong>{outOfStockCount}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {loading ? (
        <p className="infra-empty">Cargando materiales...</p>
      ) : (
        <div className="infra-grid">
          <section className="infra-command-panel infra-card-full">
            <div className="infra-command-copy">
              <p className="infra-kicker">Centro de stock</p>
              <h3>Materiales listos para practicas</h3>
              <p>
                Controla reactivos, consumibles y materiales por laboratorio sin llenar la pantalla de formularios.
                Primero elige la accion y luego completa solo el flujo necesario.
              </p>
            </div>
            {canManage ? (
              <div className="infra-action-grid">
                <button type="button" className="infra-action-card is-primary" onClick={() => openMaterialModal()}>
                  <span>1</span>
                  <strong>Nuevo material</strong>
                  <small>Registra stock, unidad, categoria y laboratorio asignado.</small>
                </button>
                <button type="button" className="infra-action-card" onClick={() => openMovementModal()}>
                  <span>2</span>
                  <strong>Movimiento de stock</strong>
                  <small>Ingreso, devolucion o consumo con trazabilidad.</small>
                </button>
                <button type="button" className="infra-action-card" onClick={() => document.querySelector('.infra-materials-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <span>3</span>
                  <strong>Revisar catalogo</strong>
                  <small>Consulta existencias y edita cada material cuando lo necesites.</small>
                </button>
              </div>
            ) : null}
          </section>

          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Materiales y reactivos</h3>
                <p>Registra cada material con stock disponible y minimo.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleMaterialSubmit}>
              <div className="infra-form-section">
                <span className="infra-form-section-label">1 — Identificacion</span>
                <div className="infra-form-grid">
                  <label>
                    <span>Nombre del material</span>
                    <input value={materialForm.name} onChange={(e) => setMaterialForm((prev) => ({ ...prev, name: e.target.value }))} required disabled={!canManage} />
                  </label>
                  <label>
                    <span>Categoria</span>
                    <input value={materialForm.category} onChange={(e) => setMaterialForm((prev) => ({ ...prev, category: e.target.value }))} required disabled={!canManage} />
                  </label>
                </div>
                <label>
                  <span>Descripcion</span>
                  <textarea rows="3" value={materialForm.description} onChange={(e) => setMaterialForm((prev) => ({ ...prev, description: e.target.value }))} disabled={!canManage} />
                </label>
              </div>
              <div className="infra-form-section">
                <span className="infra-form-section-label">2 — Stock y asignacion</span>
                <div className="infra-form-grid">
                  <label>
                    <span>Unidad</span>
                    <input value={materialForm.unit} onChange={(e) => setMaterialForm((prev) => ({ ...prev, unit: e.target.value }))} required disabled={!canManage} />
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
                  <label>
                    <span>Stock disponible</span>
                    <input type="number" min="0" value={materialForm.quantity_available} onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity_available: e.target.value }))} required disabled={!canManage} />
                  </label>
                  <label>
                    <span>Stock minimo</span>
                    <input type="number" min="0" value={materialForm.minimum_stock} onChange={(e) => setMaterialForm((prev) => ({ ...prev, minimum_stock: e.target.value }))} required disabled={!canManage} />
                  </label>
                </div>
              </div>
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
                  <div className="infra-form-section">
                    <span className="infra-form-section-label">1 — Material y tipo</span>
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
                    </div>
                  </div>
                  <div className="infra-form-section">
                    <span className="infra-form-section-label">2 — Cantidad y observaciones</span>
                    <div className="infra-form-grid">
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
                  </div>
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

          <section className="infra-card infra-materials-catalog">
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
                  {materials.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        Todavia no hay materiales registrados. Usa el boton "Nuevo material" para crear el primer recurso del inventario.
                      </td>
                    </tr>
                  ) : (
                    materials.map((material) => (
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
                                <button type="button" className="infra-secondary" onClick={() => openMovementModal(material)}>
                                  Mover stock
                                </button>
                                <button
                                  type="button"
                                  className="infra-secondary"
                                  onClick={() => openMaterialModal(material)}
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
                    ))
                  )}
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
