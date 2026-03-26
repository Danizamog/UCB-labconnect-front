import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  createArea,
  createAsset,
  createLab,
  createMaterial,
  createMaterialMovement,
  deleteArea,
  deleteAsset,
  deleteLab,
  deleteMaterial,
  listAdminAreas,
  listAdminLabs,
  listAssets,
  listAssetStatusHistory,
  listMaterialMovements,
  listMaterials,
  updateArea,
  updateAsset,
  updateAssetStatus,
  updateLab,
  updateMaterial,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminAssetsPage.css'

const defaultAreaForm = { name: '', description: '', is_active: true }
const defaultLabForm = { name: '', location: '', capacity: 20, description: '', area_id: '', is_active: true }
const defaultAssetForm = { name: '', category: '', location: '', description: '', serial_number: '', laboratory_id: '', status: 'available' }
const defaultMaterialForm = { name: '', category: '', unit: 'unidad', quantity_available: 0, minimum_stock: 0, laboratory_id: '', description: '' }
const defaultMovementForm = { stock_item_id: '', movement_type: 'entry', quantity: 1, notes: '' }

function normalizeLabId(value) {
  return value === '' ? null : Number(value)
}

function statusLabel(value) {
  if (value === 'available') return 'Disponible'
  if (value === 'loaned') return 'Prestado'
  if (value === 'maintenance') return 'Mantenimiento'
  if (value === 'damaged') return 'Danado'
  return value
}

function statusBadgeClass(value) {
  if (value === 'available') return 'available'
  if (value === 'loaned') return 'loaned'
  if (value === 'maintenance') return 'maintenance'
  if (value === 'damaged') return 'damaged'
  return 'neutral'
}

function formatAssetStatusDate(value) {
  if (!value) return 'Sin registro'
  return new Date(value).toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function movementTypeLabel(value) {
  if (value === 'entry') return 'Ingreso'
  if (value === 'return') return 'Devolucion'
  if (value === 'consumption') return 'Consumo'
  if (value === 'adjustment') return 'Ajuste manual'
  if (value === 'loan_issue') return 'Salida por prestamo'
  if (value === 'loan_return') return 'Retorno desde prestamo'
  return value
}

function formatMovementDate(value) {
  return new Date(value).toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminAssetsPage({ user }) {
  const [areas, setAreas] = useState([])
  const [labs, setLabs] = useState([])
  const [assets, setAssets] = useState([])
  const [materials, setMaterials] = useState([])
  const [materialMovements, setMaterialMovements] = useState([])
  const [assetStatusHistory, setAssetStatusHistory] = useState({})
  const [selectedAssetHistoryId, setSelectedAssetHistoryId] = useState(null)
  const [assetHistoryLoadingId, setAssetHistoryLoadingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingAreaId, setEditingAreaId] = useState(null)
  const [editingLabId, setEditingLabId] = useState(null)
  const [editingAssetId, setEditingAssetId] = useState(null)
  const [editingMaterialId, setEditingMaterialId] = useState(null)
  const [areaForm, setAreaForm] = useState(defaultAreaForm)
  const [labForm, setLabForm] = useState(defaultLabForm)
  const [assetForm, setAssetForm] = useState(defaultAssetForm)
  const [materialForm, setMaterialForm] = useState(defaultMaterialForm)
  const [movementForm, setMovementForm] = useState(defaultMovementForm)

  const canManageStructure = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])
  const canManageAssets = hasAnyPermission(user, ['gestionar_inventario'])
  const canManageAssetStatus = hasAnyPermission(user, ['gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageMaterials = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])
  const canAttachEvidence = hasAnyPermission(user, ['adjuntar_evidencia_inventario'])
  const showStructureSection = canManageStructure
  const showAssetsSection = canManageAssets || canManageAssetStatus
  const showMaterialsSection = canManageMaterials
  const hasVisibleInfrastructureSection = showStructureSection || showAssetsSection || showMaterialsSection

  const loadData = async () => {
    setLoading(true)
    try {
      const [areasResult, labsResult, assetsResult, materialsResult, movementsResult] = await Promise.allSettled([
        listAdminAreas(),
        listAdminLabs(),
        listAssets(),
        listMaterials(),
        listMaterialMovements(null, 25),
      ])

      const nextAreas = areasResult.status === 'fulfilled' ? areasResult.value : []
      const nextLabs = labsResult.status === 'fulfilled' ? labsResult.value : []
      const nextAssets = assetsResult.status === 'fulfilled' ? assetsResult.value : []
      const nextMaterials = materialsResult.status === 'fulfilled' ? materialsResult.value : []
      const issues = []
      const nextMovements = movementsResult.status === 'fulfilled' ? movementsResult.value : []

      if (areasResult.status === 'rejected' && showStructureSection) {
        issues.push(areasResult.reason?.message || 'No se pudieron cargar las areas')
      }
      if (labsResult.status === 'rejected' && (showStructureSection || showAssetsSection || showMaterialsSection)) {
        issues.push(labsResult.reason?.message || 'No se pudieron cargar los laboratorios')
      }
      if (assetsResult.status === 'rejected' && showAssetsSection) {
        issues.push(assetsResult.reason?.message || 'No se pudieron cargar los equipos')
      }
      if (materialsResult.status === 'rejected' && showMaterialsSection) {
        issues.push(materialsResult.reason?.message || 'No se pudieron cargar los materiales')
      }
      if (movementsResult.status === 'rejected' && showMaterialsSection) {
        issues.push(movementsResult.reason?.message || 'No se pudo cargar el historial de stock')
      }

      setAreas(nextAreas)
      setLabs(nextLabs)
      setAssets(nextAssets)
      setMaterials(nextMaterials)
      setMaterialMovements(nextMovements)
      setError(issues[0] || '')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la infraestructura')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!movementForm.stock_item_id && materials.length > 0) {
      setMovementForm((previous) => ({
        ...previous,
        stock_item_id: String(materials[0].id),
      }))
    }
  }, [materials, movementForm.stock_item_id])

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [Number(lab.id), lab.name])),
    [labs],
  )

  const areaNameById = useMemo(
    () => Object.fromEntries(areas.map((area) => [Number(area.id), area.name])),
    [areas],
  )
  const selectedMovementMaterial = useMemo(
    () => materials.find((material) => String(material.id) === String(movementForm.stock_item_id)) || null,
    [materials, movementForm.stock_item_id],
  )
  const lowStockMaterials = useMemo(
    () => materials.filter((material) => Number(material.quantity_available) <= Number(material.minimum_stock || 0)),
    [materials],
  )
  const movementWillExceedStock = useMemo(() => {
    if (!selectedMovementMaterial || movementForm.movement_type !== 'consumption') {
      return false
    }
    return Number(movementForm.quantity || 0) > Number(selectedMovementMaterial.quantity_available || 0)
  }, [movementForm.movement_type, movementForm.quantity, selectedMovementMaterial])
  const summaryCards = useMemo(() => {
    const cards = []
    if (showStructureSection) {
      cards.push({ label: 'Areas', value: areas.length })
      cards.push({ label: 'Laboratorios', value: labs.length })
    }
    if (showAssetsSection) {
      cards.push({ label: 'Equipos', value: assets.length })
    }
    if (showMaterialsSection) {
      cards.push({ label: 'Materiales', value: materials.length })
    }
    return cards
  }, [areas.length, assets.length, labs.length, materials.length, showAssetsSection, showMaterialsSection, showStructureSection])

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const resetAreaForm = () => {
    setEditingAreaId(null)
    setAreaForm(defaultAreaForm)
  }

  const resetLabForm = () => {
    setEditingLabId(null)
    setLabForm(defaultLabForm)
  }

  const resetAssetForm = () => {
    setEditingAssetId(null)
    setAssetForm(defaultAssetForm)
  }

  const resetMaterialForm = () => {
    setEditingMaterialId(null)
    setMaterialForm(defaultMaterialForm)
  }

  const resetMovementForm = () => {
    setMovementForm(defaultMovementForm)
  }

  const handleAreaSubmit = async (event) => {
    event.preventDefault()
    if (!canManageStructure) return
    resetFeedback()
    try {
      if (editingAreaId) {
        await updateArea(editingAreaId, areaForm)
        setMessage('Area actualizada correctamente.')
      } else {
        await createArea(areaForm)
        setMessage('Area creada correctamente.')
      }
      resetAreaForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el area')
    }
  }

  const handleLabSubmit = async (event) => {
    event.preventDefault()
    if (!canManageStructure) return
    resetFeedback()
    const payload = {
      ...labForm,
      area_id: Number(labForm.area_id),
      capacity: Number(labForm.capacity),
    }

    try {
      if (editingLabId) {
        await updateLab(editingLabId, payload)
        setMessage('Laboratorio actualizado correctamente.')
      } else {
        await createLab(payload)
        setMessage('Laboratorio creado correctamente.')
      }
      resetLabForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el laboratorio')
    }
  }

  const handleAssetSubmit = async (event) => {
    event.preventDefault()
    if (!canManageAssets) return
    resetFeedback()
    if (!assetForm.location.trim()) {
      setError('La ubicacion del equipo es obligatoria.')
      return
    }
    const payload = {
      ...assetForm,
      location: assetForm.location.trim(),
      laboratory_id: normalizeLabId(assetForm.laboratory_id),
    }

    try {
      if (editingAssetId) {
        await updateAsset(editingAssetId, payload)
        setMessage('Equipo actualizado correctamente.')
      } else {
        await createAsset(payload)
        setMessage('Equipo creado correctamente.')
      }
      resetAssetForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el equipo')
    }
  }

  const handleAssetStatusChange = async (assetId, status) => {
    if (!canManageAssetStatus) return
    resetFeedback()
    try {
      const updatedAsset = await updateAssetStatus(assetId, status)
      setAssets((previous) => previous.map((asset) => (asset.id === assetId ? updatedAsset : asset)))
      if (selectedAssetHistoryId === assetId) {
        const history = await listAssetStatusHistory(assetId)
        setAssetStatusHistory((previous) => ({ ...previous, [assetId]: history }))
      }
      setMessage('Estado del equipo actualizado correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado del equipo')
    }
  }

  const handleToggleAssetHistory = async (assetId) => {
    if (selectedAssetHistoryId === assetId) {
      setSelectedAssetHistoryId(null)
      return
    }

    setSelectedAssetHistoryId(assetId)
    if (assetStatusHistory[assetId]) {
      return
    }

    setAssetHistoryLoadingId(assetId)
    try {
      const history = await listAssetStatusHistory(assetId)
      setAssetStatusHistory((previous) => ({ ...previous, [assetId]: history }))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial del equipo')
    } finally {
      setAssetHistoryLoadingId(null)
    }
  }

  const handleMaterialSubmit = async (event) => {
    event.preventDefault()
    if (!canManageMaterials) return
    resetFeedback()
    const payload = {
      ...materialForm,
      quantity_available: Number(materialForm.quantity_available),
      minimum_stock: Number(materialForm.minimum_stock),
      laboratory_id: normalizeLabId(materialForm.laboratory_id),
    }

    try {
      if (editingMaterialId) {
        await updateMaterial(editingMaterialId, payload)
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

  const handleDelete = async (entityName, entityId, action) => {
    resetFeedback()
    if (!window.confirm(`Deseas eliminar este ${entityName}?`)) {
      return
    }

    try {
      await action(entityId)
      setMessage(`${entityName[0].toUpperCase()}${entityName.slice(1)} eliminado correctamente.`)
      await loadData()
    } catch (err) {
      setError(err.message || `No se pudo eliminar el ${entityName}`)
    }
  }

  const handleMovementSubmit = async (event) => {
    event.preventDefault()
    if (!canManageMaterials) return
    resetFeedback()

    if (!movementForm.stock_item_id) {
      setError('Selecciona un material para registrar el movimiento.')
      return
    }

    if (movementWillExceedStock) {
      setError('No puedes descontar mas unidades de las disponibles en stock.')
      return
    }

    try {
      await createMaterialMovement(Number(movementForm.stock_item_id), {
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity),
        notes: movementForm.notes.trim() || undefined,
      })
      setMessage('Movimiento de stock registrado y auditado correctamente.')
      setMovementForm((previous) => ({
        ...defaultMovementForm,
        stock_item_id: previous.stock_item_id,
      }))
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento de stock')
    }
  }

  return (
    <section className="infra-page" aria-label="Infraestructura academica">
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Administracion central</p>
          <h2>Areas, laboratorios, equipos y materiales</h2>
          <p>
            Mantiene ordenada la infraestructura para que los usuarios reserven practicas con datos reales.
          </p>
        </div>
        <div className="infra-summary">
          {summaryCards.length > 0 ? (
            summaryCards.map((item) => (
              <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
            ))
          ) : (
            <div><span>Modulos visibles</span><strong>0</strong></div>
          )}
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}
      {!hasVisibleInfrastructureSection ? (
        <p className="infra-alert infra-error">
          No tienes permisos para ver modulos operativos de infraestructura en esta pantalla.
        </p>
      ) : null}
      {canAttachEvidence ? (
        <p className="infra-alert infra-success">
          Tu rol incluye <strong>adjuntar_evidencia_inventario</strong>. La operacion de inventario ya queda preparada para anexar evidencia sin cambiar el RBAC.
        </p>
      ) : null}

      {loading ? (
        <p className="infra-empty">Cargando infraestructura...</p>
      ) : (
        <div className="infra-grid">
          {showStructureSection ? (
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Areas academicas</h3>
                <p>Crea agrupadores como Quimica, Fisica o Tecnologia.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleAreaSubmit}>
              <label>
                <span>Nombre del area</span>
                <input value={areaForm.name} onChange={(event) => setAreaForm((prev) => ({ ...prev, name: event.target.value }))} required disabled={!canManageStructure} />
              </label>
              <label>
                <span>Descripcion</span>
                <textarea rows="3" value={areaForm.description} onChange={(event) => setAreaForm((prev) => ({ ...prev, description: event.target.value }))} disabled={!canManageStructure} />
              </label>
              <label className="infra-checkbox">
                <input type="checkbox" checked={areaForm.is_active} onChange={(event) => setAreaForm((prev) => ({ ...prev, is_active: event.target.checked }))} disabled={!canManageStructure} />
                <span>Area activa para estudiantes</span>
              </label>
              <div className="infra-actions">
                <button type="submit" className="infra-primary" disabled={!canManageStructure}>
                  {editingAreaId ? 'Actualizar area' : 'Crear area'}
                </button>
                {editingAreaId ? (
                  <button type="button" className="infra-secondary" onClick={resetAreaForm} disabled={!canManageStructure}>
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
                      disabled={!canManageStructure}
                      onClick={() => {
                        setEditingAreaId(area.id)
                        setAreaForm({
                          name: area.name,
                          description: area.description || '',
                          is_active: area.is_active,
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="infra-danger" onClick={() => handleDelete('area', area.id, deleteArea)} disabled={!canManageStructure}>
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {showStructureSection ? (
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Laboratorios</h3>
                <p>Asocia cada laboratorio a un area y define capacidad y ubicacion.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleLabSubmit}>
              <div className="infra-form-grid">
                <label>
                  <span>Nombre</span>
                  <input value={labForm.name} onChange={(event) => setLabForm((prev) => ({ ...prev, name: event.target.value }))} required disabled={!canManageStructure} />
                </label>
                <label>
                  <span>Area</span>
                  <select value={labForm.area_id} onChange={(event) => setLabForm((prev) => ({ ...prev, area_id: event.target.value }))} required disabled={!canManageStructure}>
                    <option value="">Selecciona un area</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Ubicacion</span>
                  <input value={labForm.location} onChange={(event) => setLabForm((prev) => ({ ...prev, location: event.target.value }))} required disabled={!canManageStructure} />
                </label>
                <label>
                  <span>Capacidad</span>
                  <input type="number" min="1" value={labForm.capacity} onChange={(event) => setLabForm((prev) => ({ ...prev, capacity: event.target.value }))} required disabled={!canManageStructure} />
                </label>
              </div>
              <label>
                <span>Descripcion</span>
                <textarea rows="3" value={labForm.description} onChange={(event) => setLabForm((prev) => ({ ...prev, description: event.target.value }))} disabled={!canManageStructure} />
              </label>
              <label className="infra-checkbox">
                <input type="checkbox" checked={labForm.is_active} onChange={(event) => setLabForm((prev) => ({ ...prev, is_active: event.target.checked }))} disabled={!canManageStructure} />
                <span>Laboratorio activo para reservas</span>
              </label>
              <div className="infra-actions">
                <button type="submit" className="infra-primary" disabled={!canManageStructure}>
                  {editingLabId ? 'Actualizar laboratorio' : 'Crear laboratorio'}
                </button>
                {editingLabId ? (
                  <button type="button" className="infra-secondary" onClick={resetLabForm} disabled={!canManageStructure}>
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
                    <p>{lab.location} - Capacidad {lab.capacity}</p>
                    <small>{lab.area_name || areaNameById[lab.area_id] || 'Sin area'}</small>
                  </div>
                  <div className="infra-actions compact">
                    <button
                      type="button"
                      className="infra-secondary"
                      disabled={!canManageStructure}
                      onClick={() => {
                        setEditingLabId(lab.id)
                        setLabForm({
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
                    <button type="button" className="infra-danger" onClick={() => handleDelete('laboratorio', lab.id, deleteLab)} disabled={!canManageStructure}>
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {showAssetsSection ? (
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Equipos</h3>
                <p>Gestiona hardware y equipos vinculados a cada espacio.</p>
              </div>
            </div>

            {canManageAssets ? (
              <form className="infra-form" onSubmit={handleAssetSubmit}>
                <div className="infra-form-grid">
                  <label>
                    <span>Nombre del equipo</span>
                    <input value={assetForm.name} onChange={(event) => setAssetForm((prev) => ({ ...prev, name: event.target.value }))} required />
                  </label>
                  <label>
                    <span>Categoria</span>
                    <input value={assetForm.category} onChange={(event) => setAssetForm((prev) => ({ ...prev, category: event.target.value }))} required />
                  </label>
                  <label>
                    <span>Numero de serie</span>
                    <input value={assetForm.serial_number} onChange={(event) => setAssetForm((prev) => ({ ...prev, serial_number: event.target.value }))} />
                  </label>
                  <label>
                    <span>Ubicacion</span>
                    <input
                      value={assetForm.location}
                      onChange={(event) => setAssetForm((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="Mesa 4, gabinete 2 o estante A"
                      required
                    />
                  </label>
                  <label>
                    <span>Laboratorio</span>
                    <select value={assetForm.laboratory_id} onChange={(event) => setAssetForm((prev) => ({ ...prev, laboratory_id: event.target.value }))}>
                      <option value="">Sin laboratorio fijo</option>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>{lab.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Estado</span>
                    <select value={assetForm.status} onChange={(event) => setAssetForm((prev) => ({ ...prev, status: event.target.value }))}>
                      <option value="available">Disponible</option>
                      <option value="loaned">Prestado</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="damaged">Danado</option>
                    </select>
                  </label>
                </div>
                <label>
                  <span>Descripcion</span>
                  <textarea rows="3" value={assetForm.description} onChange={(event) => setAssetForm((prev) => ({ ...prev, description: event.target.value }))} />
                </label>
                <div className="infra-actions">
                  <button type="submit" className="infra-primary">
                    {editingAssetId ? 'Actualizar equipo' : 'Crear equipo'}
                  </button>
                  {editingAssetId ? (
                    <button type="button" className="infra-secondary" onClick={resetAssetForm}>
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
                        <td>{asset.laboratory_id ? labNameById[Number(asset.laboratory_id)] || `Lab ${asset.laboratory_id}` : 'General'}</td>
                        <td>
                          <div className="infra-status-cell">
                            <span className={`infra-status-badge ${statusBadgeClass(asset.status)}`}>
                              {statusLabel(asset.status)}
                            </span>
                            <small>
                              {asset.status_updated_by
                                ? `Ultimo cambio: ${asset.status_updated_by} · ${formatAssetStatusDate(asset.status_updated_at)}`
                                : 'Sin cambios registrados'}
                            </small>
                            {canManageAssetStatus ? (
                              <select value={asset.status} onChange={(event) => handleAssetStatusChange(asset.id, event.target.value)}>
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
                            <button
                              type="button"
                              className="infra-secondary"
                              onClick={() => handleToggleAssetHistory(asset.id)}
                            >
                              {selectedAssetHistoryId === asset.id ? 'Ocultar historial' : 'Ver historial'}
                            </button>
                            {canManageAssets ? (
                              <>
                                <button
                                  type="button"
                                  className="infra-secondary"
                                  onClick={() => {
                                    setEditingAssetId(asset.id)
                                    setAssetForm({
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
                                <button type="button" className="infra-danger" onClick={() => handleDelete('equipo', asset.id, deleteAsset)}>
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
                                <p className="infra-empty">Cargando historial del equipo...</p>
                              ) : (assetStatusHistory[asset.id] || []).length === 0 ? (
                                <p className="infra-empty">Aun no hay cambios de estado registrados para este equipo.</p>
                              ) : (
                                <div className="infra-history-list">
                                  {(assetStatusHistory[asset.id] || []).map((entry) => (
                                    <article key={entry.id} className="infra-history-item">
                                      <div>
                                        <span className={`infra-status-badge ${statusBadgeClass(entry.next_status)}`}>
                                          {entry.previous_status ? `${statusLabel(entry.previous_status)} -> ${statusLabel(entry.next_status)}` : statusLabel(entry.next_status)}
                                        </span>
                                        <small>{formatAssetStatusDate(entry.changed_at)}</small>
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
          ) : null}

          {showMaterialsSection ? (
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Materiales y reactivos</h3>
                <p>Estos materiales son los que luego el usuario puede reservar junto con su practica.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleMaterialSubmit}>
              <div className="infra-form-grid">
                <label>
                  <span>Nombre del material</span>
                  <input value={materialForm.name} onChange={(event) => setMaterialForm((prev) => ({ ...prev, name: event.target.value }))} required disabled={!canManageMaterials} />
                </label>
                <label>
                  <span>Categoria</span>
                  <input value={materialForm.category} onChange={(event) => setMaterialForm((prev) => ({ ...prev, category: event.target.value }))} required disabled={!canManageMaterials} />
                </label>
                <label>
                  <span>Unidad</span>
                  <input value={materialForm.unit} onChange={(event) => setMaterialForm((prev) => ({ ...prev, unit: event.target.value }))} required disabled={!canManageMaterials} />
                </label>
                <label>
                  <span>Stock disponible</span>
                  <input type="number" min="0" value={materialForm.quantity_available} onChange={(event) => setMaterialForm((prev) => ({ ...prev, quantity_available: event.target.value }))} required disabled={!canManageMaterials} />
                </label>
                <label>
                  <span>Stock minimo</span>
                  <input type="number" min="0" value={materialForm.minimum_stock} onChange={(event) => setMaterialForm((prev) => ({ ...prev, minimum_stock: event.target.value }))} required disabled={!canManageMaterials} />
                </label>
                <label>
                  <span>Laboratorio</span>
                  <select value={materialForm.laboratory_id} onChange={(event) => setMaterialForm((prev) => ({ ...prev, laboratory_id: event.target.value }))} disabled={!canManageMaterials}>
                    <option value="">Disponible para cualquier laboratorio</option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Descripcion</span>
                <textarea rows="3" value={materialForm.description} onChange={(event) => setMaterialForm((prev) => ({ ...prev, description: event.target.value }))} disabled={!canManageMaterials} />
              </label>
              {canManageMaterials ? (
                <div className="infra-actions">
                  <button type="submit" className="infra-primary">
                    {editingMaterialId ? 'Actualizar material' : 'Crear material'}
                  </button>
                  {editingMaterialId ? (
                    <button type="button" className="infra-secondary" onClick={resetMaterialForm}>
                      Cancelar edicion
                    </button>
                  ) : null}
                </div>
              ) : null}
            </form>

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
                      <select
                        value={movementForm.stock_item_id}
                        onChange={(event) => setMovementForm((prev) => ({ ...prev, stock_item_id: event.target.value }))}
                        disabled={!canManageMaterials}
                        required
                      >
                        <option value="">Selecciona un material</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.quantity_available} {material.unit})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Tipo de movimiento</span>
                      <select
                        value={movementForm.movement_type}
                        onChange={(event) => setMovementForm((prev) => ({ ...prev, movement_type: event.target.value }))}
                        disabled={!canManageMaterials}
                      >
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
                        onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))}
                        disabled={!canManageMaterials}
                        required
                      />
                    </label>
                    <label>
                      <span>Stock actual</span>
                      <input
                        value={selectedMovementMaterial ? `${selectedMovementMaterial.quantity_available} ${selectedMovementMaterial.unit}` : 'Selecciona un material'}
                        disabled
                      />
                    </label>
                  </div>
                  <label>
                    <span>Motivo u observaciones</span>
                    <textarea
                      rows="3"
                      value={movementForm.notes}
                      onChange={(event) => setMovementForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Ej. consumo en practica de quimica, compra semestral o devolucion del grupo 2"
                      disabled={!canManageMaterials}
                    />
                  </label>
                  {movementWillExceedStock ? (
                    <p className="infra-inline-error">
                      La cantidad a descontar supera el stock disponible del material seleccionado.
                    </p>
                  ) : null}
                  <div className="infra-actions">
                    <button
                      type="submit"
                      className="infra-primary"
                      disabled={!canManageMaterials || movementWillExceedStock || !movementForm.stock_item_id}
                    >
                      Registrar movimiento
                    </button>
                    <button type="button" className="infra-secondary" onClick={resetMovementForm} disabled={!canManageMaterials}>
                      Limpiar movimiento
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
                    {lowStockMaterials.map((material) => (
                      <span key={material.id} className="infra-chip danger">
                        {material.name}: {material.quantity_available}/{material.minimum_stock} {material.unit}
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
                        <tr>
                          <td colSpan="6">Todavia no hay movimientos registrados.</td>
                        </tr>
                      ) : (
                        materialMovements.map((movement) => (
                          <tr key={movement.id}>
                            <td>{formatMovementDate(movement.created_at)}</td>
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
                          {canManageMaterials ? (
                            <>
                              <button
                                type="button"
                                className="infra-secondary"
                                onClick={() => setMovementForm((prev) => ({
                                  ...prev,
                                  stock_item_id: String(material.id),
                                }))}
                              >
                                Mover stock
                              </button>
                              <button
                                type="button"
                                className="infra-secondary"
                                onClick={() => {
                                  setEditingMaterialId(material.id)
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
                              <button type="button" className="infra-danger" onClick={() => handleDelete('material', material.id, deleteMaterial)}>
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
          ) : null}
        </div>
      )}
    </section>
  )
}

export default AdminAssetsPage
