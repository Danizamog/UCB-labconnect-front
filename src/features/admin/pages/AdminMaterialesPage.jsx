import { useEffect, useMemo, useState } from 'react'
import {
  createMaterial,
  createMaterialMovement,
  deleteMaterial,
  getStockItemsReport,
  getUsageReport,
  listAdminLabs,
  listMaterialMovements,
  listMaterials,
  updateMaterial,
} from '../services/infrastructureService'
import { listUserProfiles } from '../services/profileService'
import {
  createSupplyReservation,
  listSupplyReservations,
  updateSupplyReservationStatus,
} from '../../reservations/services/reservationsService'
import { hasAnyPermission, isAdminUser } from '../../../shared/lib/permissions'
import { formatDateTime, movementTypeLabel } from '../../../shared/utils/formatters'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import './AdminAssetsPage.css'

const SUPPLY_STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
}

const defaultMaterialForm = { name: '', category: '', unit: 'unidad', quantity_available: 0, minimum_stock: 0, laboratory_id: '', description: '' }
const defaultMovementForm = { stock_item_id: '', movement_type: 'entry', quantity: 1, notes: '' }
const defaultReportFilters = { laboratory_id: '', status_filter: '', search: '', only_low_or_out: true, include_general: true }
const defaultUsageReportFilters = { borrower_id: '', practice: '', date_from: '', date_to: '' }

const reportStatusMeta = {
  out_of_stock: { label: 'Sin stock', chipClass: 'danger' },
  low_stock: { label: 'Stock bajo', chipClass: 'warning' },
  ok: { label: 'Stock suficiente', chipClass: '' },
}

function normalizeLabId(value) {
  return value === '' ? '' : String(value)
}

function AdminMaterialesPage({ user }) {
  const [labs, setLabs] = useState([])
  const [materials, setMaterials] = useState([])
  const [stockReport, setStockReport] = useState(null)
  const [reportFilters, setReportFilters] = useState(defaultReportFilters)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [usageReport, setUsageReport] = useState(null)
  const [usageReportFilters, setUsageReportFilters] = useState(defaultUsageReportFilters)
  const [usageReportLoading, setUsageReportLoading] = useState(false)
  const [usageReportError, setUsageReportError] = useState('')
  const [materialMovements, setMaterialMovements] = useState([])
  const [borrowerQuery, setBorrowerQuery] = useState('')
  const [borrowerResults, setBorrowerResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [materialForm, setMaterialForm] = useState(defaultMaterialForm)
  const [movementForm, setMovementForm] = useState(defaultMovementForm)
  const [activeModal, setActiveModal] = useState(null)
  const [activeTab, setActiveTab] = useState('catalog')
  const [supplyReservations, setSupplyReservations] = useState([])
  const [supplyLoading, setSupplyLoading] = useState(false)
  const [supplyActionId, setSupplyActionId] = useState('')
  const [supplyStatusFilter, setSupplyStatusFilter] = useState('pending')
  const [supplyCreateForm, setSupplyCreateForm] = useState({
    laboratory_id: '',
    stock_item_id: '',
    quantity: 1,
    requested_for: '',
    notes: '',
  })
  const [isCreatingSupply, setIsCreatingSupply] = useState(false)
  const [showSupplyCreateForm, setShowSupplyCreateForm] = useState(false)

  const [confirmModal, setConfirmModal] = useState(null)

  const canManageMaterials = hasAnyPermission(user, ['gestionar_reactivos_quimicos'])
  const canMoveStock = hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos'])
  const canManage = canManageMaterials || canMoveStock
  const isAdmin = isAdminUser(user)

  const fetchReportData = async () => {
    setReportLoading(true)
    try {
      const reportData = await getStockItemsReport({ onlyLowOrOut: true })
      setStockReport(reportData)
      setReportError('')
      return reportData
    } catch (err) {
      setStockReport(null)
      setReportError(err.message || 'No se pudo cargar el reporte de insumos')
      return null
    } finally {
      setReportLoading(false)
    }
  }

  const fetchUsageReportData = async (filters = usageReportFilters) => {
    setUsageReportLoading(true)
    try {
      const reportData = await getUsageReport({
        borrowerId: filters.borrower_id,
        practice: filters.practice,
        dateFrom: filters.date_from,
        dateTo: filters.date_to,
      })
      setUsageReport(reportData)
      setUsageReportError('')
      return reportData
    } catch (err) {
      setUsageReport(null)
      setUsageReportError(err.message || 'No se pudo cargar el reporte de uso')
      return null
    } finally {
      setUsageReportLoading(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [labsData, materialsData] = await Promise.all([
        listAdminLabs(),
        listMaterials(),
      ])
      setLabs(labsData)
      setMaterials(materialsData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos iniciales')
    } finally {
      setLoading(false)
    }

    await fetchReportData()
    await fetchUsageReportData()

    try {
      const movementsData = await listMaterialMovements(null, 25)
      setMaterialMovements(movementsData)
    } catch {
      // historial de movimientos no critico
    }

    await fetchSupplyReservations(supplyStatusFilter)
  }

  const fetchSupplyReservations = async (statusFilter = supplyStatusFilter) => {
    setSupplyLoading(true)
    try {
      const data = await listSupplyReservations({
        status: statusFilter || undefined,
        skipCache: true,
      })
      setSupplyReservations(Array.isArray(data) ? data : [])
    } catch (err) {
      setMessage('')
      setError(err.message || 'No se pudieron cargar las solicitudes de reactivos.')
    } finally {
      setSupplyLoading(false)
    }
  }

  const handleCreateSupplyReservation = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!supplyCreateForm.laboratory_id || !supplyCreateForm.stock_item_id) {
      setError('Selecciona laboratorio y material para crear la solicitud.')
      return
    }

    const quantity = Number(supplyCreateForm.quantity || 0)
    if (quantity <= 0) {
      setError('La cantidad debe ser mayor a cero.')
      return
    }

    setIsCreatingSupply(true)
    try {
      await createSupplyReservation({
        stock_item_id: supplyCreateForm.stock_item_id,
        quantity,
        requested_for: supplyCreateForm.requested_for || 'Solicitud creada por administrador',
        notes: supplyCreateForm.notes || '',
        laboratory_id: supplyCreateForm.laboratory_id,
      })
      setMessage('Solicitud manual creada. Queda pendiente y puedes aprobarla desde la tabla.')
      setSupplyCreateForm({
        laboratory_id: '',
        stock_item_id: '',
        quantity: 1,
        requested_for: '',
        notes: '',
      })
      setShowSupplyCreateForm(false)
      await fetchSupplyReservations(supplyStatusFilter)
    } catch (err) {
      setError(err.message || 'No se pudo crear la solicitud manual.')
    } finally {
      setIsCreatingSupply(false)
    }
  }

  const supplyCreateAvailableMaterials = useMemo(() => {
    const labId = String(supplyCreateForm.laboratory_id || '')
    if (!labId) return []
    return materials.filter((material) => String(material.laboratory_id || '') === labId)
  }, [materials, supplyCreateForm.laboratory_id])

  const handleUpdateSupplyStatus = async (reservationId, nextStatus) => {
    setSupplyActionId(reservationId)
    setMessage('')
    setError('')
    try {
      await updateSupplyReservationStatus(reservationId, nextStatus)
      setMessage(
        nextStatus === 'approved'
          ? 'Reserva aprobada y stock descontado.'
          : nextStatus === 'cancelled'
          ? 'Reserva rechazada.'
          : 'Reserva actualizada.',
      )
      await Promise.all([
        fetchSupplyReservations(supplyStatusFilter),
        fetchReportData(),
      ])
      const refreshed = await listMaterials()
      setMaterials(refreshed)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva de reactivo.')
    } finally {
      setSupplyActionId('')
    }
  }

  const managedLabIds = useMemo(() => {
    const currentUserId = String(user?.user_id || '')
    if (!currentUserId) return []
    return labs
      .filter((lab) => String(lab?.manager || '') === currentUserId)
      .map((lab) => String(lab.id))
  }, [labs, user?.user_id])
  const restrictToManagedLabs = !isAdmin
  const visibleLabs = useMemo(() => {
    if (!restrictToManagedLabs) return labs
    return labs.filter((lab) => managedLabIds.includes(String(lab.id)))
  }, [labs, managedLabIds, restrictToManagedLabs])
  const visibleMaterials = useMemo(() => {
    if (isAdmin) return materials
    if (managedLabIds.length === 0) {
      return materials.filter((material) => !String(material.laboratory_id || ''))
    }
    return materials.filter((material) => {
      const labId = String(material.laboratory_id || '')
      return !labId || managedLabIds.includes(labId)
    })
  }, [isAdmin, managedLabIds, materials])
  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!movementForm.stock_item_id && visibleMaterials.length > 0) {
      setMovementForm((prev) => ({ ...prev, stock_item_id: String(visibleMaterials[0].id) }))
    }
  }, [visibleMaterials, movementForm.stock_item_id])

  useEffect(() => {
    const query = String(borrowerQuery || '').trim().toLowerCase()
    if (query.length < 2) {
      setBorrowerResults([])
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const profiles = await listUserProfiles()
        if (cancelled) return
        const matches = (Array.isArray(profiles) ? profiles : [])
          .filter((profile) => {
            const haystack = [profile?.name, profile?.email, profile?.username, profile?.student_code]
              .map((v) => String(v || '').toLowerCase())
              .join(' ')
            return haystack.includes(query)
          })
          .slice(0, 8)
        setBorrowerResults(matches)
      } catch {
        if (!cancelled) setBorrowerResults([])
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [borrowerQuery])

  const selectedMovementMaterial = useMemo(
    () => materials.find((m) => String(m.id) === String(movementForm.stock_item_id)) || null,
    [materials, movementForm.stock_item_id],
  )

  const lowStockMaterials = useMemo(
    () => visibleMaterials.filter((m) => {
      const qty = Number(m.quantity_available)
      const min = Number(m.minimum_stock || 0)
      return min > 0 && qty <= min
    }),
    [visibleMaterials],
  )

  const movementWillExceedStock = useMemo(() => {
    if (!selectedMovementMaterial || movementForm.movement_type !== 'consumption') return false
    return Number(movementForm.quantity || 0) > Number(selectedMovementMaterial.quantity_available || 0)
  }, [movementForm.movement_type, movementForm.quantity, selectedMovementMaterial])

  const handleRefreshData = async () => {
    setError('')
    await loadData()
  }

  const outOfStockCount = useMemo(
    () => visibleMaterials.filter((m) => Number(m.quantity_available) <= 0).length,
    [visibleMaterials],
  )

  const stockAlertsCount = useMemo(
    () => lowStockMaterials.length,
    [lowStockMaterials.length],
  )

  const reportItems = useMemo(() => (Array.isArray(stockReport?.items) ? stockReport.items : []), [stockReport])

  const filteredReportItems = useMemo(() => {
    const selectedLaboratory = String(reportFilters.laboratory_id || '').trim()
    const selectedStatus = String(reportFilters.status_filter || '').trim()
    const normalizedSearch = String(reportFilters.search || '').trim().toLowerCase()
    const includeGeneral = Boolean(reportFilters.include_general)

    return reportItems.filter((item) => {
      const itemLaboratoryId = String(item.laboratory_id || '').trim()
      const isGeneralItem = !itemLaboratoryId

      if (!isAdmin) {
        if (itemLaboratoryId && !managedLabIds.includes(itemLaboratoryId)) {
          return false
        }
      }

      if (selectedLaboratory) {
        if (selectedLaboratory === '__GENERAL__') {
          if (!isGeneralItem) {
            return false
          }
        } else if (itemLaboratoryId !== selectedLaboratory && !(includeGeneral && isGeneralItem)) {
          return false
        }
      }

      if (selectedStatus && item.status !== selectedStatus) {
        return false
      }

      if (reportFilters.only_low_or_out && item.status === 'ok') {
        return false
      }

      if (normalizedSearch) {
        const searchableValues = [
          String(item.name || ''),
          String(item.category || ''),
          String(item.laboratory_name || ''),
          isGeneralItem ? 'general' : '',
        ].join(' ').toLowerCase()

        if (!searchableValues.includes(normalizedSearch)) {
          return false
        }
      }

      return true
    })
  }, [isAdmin, managedLabIds, reportFilters, reportItems])

  const reportSummary = useMemo(() => {
    const outOfStock = filteredReportItems.filter((item) => item.status === 'out_of_stock').length
    const lowStock = filteredReportItems.filter((item) => item.status === 'low_stock').length
    return {
      total: filteredReportItems.length,
      outOfStock,
      lowStock,
    }
  }, [filteredReportItems])

  const lowStockReportItems = useMemo(
    () => filteredReportItems.filter((item) => item.status === 'out_of_stock' || item.status === 'low_stock'),
    [filteredReportItems],
  )

  const handleReportFilterChange = (key, value) => {
    const nextValue = key === 'laboratory_id' && value === '__GENERAL__' ? false : reportFilters.include_general
    setReportFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'laboratory_id' ? { include_general: nextValue } : {}),
    }))
  }

  const handleReportSubmit = async (event) => {
    event.preventDefault()
    await fetchReportData()
  }

  const handleReportReset = async () => {
    setReportFilters(defaultReportFilters)
    await fetchReportData()
  }

  const handleUsageReportFilterChange = (key, value) => {
    setUsageReportFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleUsageReportSubmit = async (event) => {
    event.preventDefault()
    await fetchUsageReportData()
  }

  const handleUsageReportReset = async () => {
    setUsageReportFilters(defaultUsageReportFilters)
    await fetchUsageReportData(defaultUsageReportFilters)
  }

  const usageReportItems = useMemo(() => (Array.isArray(usageReport?.items) ? usageReport.items : []), [usageReport])

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
      stock_item_id: material?.id ? String(material.id) : prev.stock_item_id || (visibleMaterials[0]?.id ? String(visibleMaterials[0].id) : ''),
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
    if (!canManageMaterials) return
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
    if (!canManageMaterials) return
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
    if (!canMoveStock) return
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
                        disabled={!canManageMaterials}
                      />
                    </label>
                    <label>
                      <span>Categoria</span>
                      <input
                        value={materialForm.category}
                        onChange={(e) => setMaterialForm((prev) => ({ ...prev, category: e.target.value }))}
                        placeholder="Reactivo, electronica, redes, limpieza"
                        required
                        disabled={!canManageMaterials}
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
                      disabled={!canManageMaterials}
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
                        disabled={!canManageMaterials}
                      />
                    </label>
                    <label>
                      <span>Laboratorio</span>
                      <select value={materialForm.laboratory_id} onChange={(e) => setMaterialForm((prev) => ({ ...prev, laboratory_id: e.target.value }))} disabled={!canManageMaterials}>
                        <option value="">Disponible para cualquier laboratorio</option>
                        {visibleLabs.map((lab) => (
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
                        disabled={!canManageMaterials}
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
                        disabled={!canManageMaterials}
                      />
                    </label>
                  </div>
                </div>

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={closeWorkflowModal}>
                    Cerrar
                  </button>
                  <button type="submit" className="infra-primary" disabled={!canManageMaterials}>
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
                      <select value={movementForm.stock_item_id} onChange={(e) => setMovementForm((prev) => ({ ...prev, stock_item_id: e.target.value }))} disabled={!canMoveStock} required>
                        <option value="">Selecciona un material</option>
                        {visibleMaterials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.quantity_available} {m.unit})</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Tipo de movimiento</span>
                      <select value={movementForm.movement_type} onChange={(e) => setMovementForm((prev) => ({ ...prev, movement_type: e.target.value }))} disabled={!canMoveStock}>
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
                        disabled={!canMoveStock}
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
                      disabled={!canMoveStock}
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
                  <button type="submit" className="infra-primary" disabled={!canMoveStock || movementWillExceedStock || !movementForm.stock_item_id}>
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
          <h2>Materiales y stock</h2>
          <p>Gestiona materiales, reactivos y alertas de stock para que las practicas tengan insumos disponibles.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total</span><strong>{visibleMaterials.length}</strong></div>
          <div><span>Alertas de stock</span><strong>{stockAlertsCount}</strong></div>
          <div><span>Sin stock</span><strong>{outOfStockCount}</strong></div>
        </div>
      </header>

      <nav className="infra-tabs" role="tablist" aria-label="Secciones de materiales">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'catalog'}
          className={`infra-tab-button ${activeTab === 'catalog' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <span>Catálogo</span>
          <span className="infra-tab-count">{visibleMaterials.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'movements'}
          className={`infra-tab-button ${activeTab === 'movements' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          <span>Movimientos de stock</span>
          <span className="infra-tab-count">{materialMovements.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reports'}
          className={`infra-tab-button ${activeTab === 'reports' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <span>Reportes</span>
          <span className="infra-tab-count">{stockAlertsCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'requests'}
          className={`infra-tab-button ${activeTab === 'requests' ? 'is-active' : ''}`}
          onClick={() => {
            setActiveTab('requests')
            fetchSupplyReservations(supplyStatusFilter)
          }}
        >
          <span>Solicitudes</span>
          <span className="infra-tab-count">
            {supplyReservations.filter((reservation) => reservation.status === 'pending').length}
          </span>
        </button>
      </nav>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {loading ? (
        <p className="infra-empty">Cargando materiales...</p>
      ) : (
        <div className="infra-grid">
          {activeTab === 'catalog' ? (
            <>
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
                {canManageMaterials ? (
                  <button type="button" className="infra-action-card is-primary" onClick={() => openMaterialModal()}>
                    <span>1</span>
                    <strong>Nuevo material</strong>
                    <small>Registra stock, unidad, categoria y laboratorio asignado.</small>
                  </button>
                ) : null}
                {canMoveStock ? (
                  <button type="button" className="infra-action-card" onClick={() => openMovementModal()}>
                    <span>2</span>
                    <strong>Movimiento de stock</strong>
                    <small>Ingreso, devolucion o consumo con trazabilidad.</small>
                  </button>
                ) : null}
                <button type="button" className="infra-action-card" onClick={() => document.querySelector('.infra-materials-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <span>3</span>
                  <strong>Revisar catalogo</strong>
                  <small>Consulta existencias y edita cada material cuando lo necesites.</small>
                </button>
              </div>
            ) : null}
          </section>

          {canManageMaterials ? (
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
                    <input value={materialForm.name} onChange={(e) => setMaterialForm((prev) => ({ ...prev, name: e.target.value }))} required />
                  </label>
                  <label>
                    <span>Categoria</span>
                    <input value={materialForm.category} onChange={(e) => setMaterialForm((prev) => ({ ...prev, category: e.target.value }))} required />
                  </label>
                </div>
                <label>
                  <span>Descripcion</span>
                  <textarea rows="3" value={materialForm.description} onChange={(e) => setMaterialForm((prev) => ({ ...prev, description: e.target.value }))} />
                </label>
              </div>
              <div className="infra-form-section">
                <span className="infra-form-section-label">2 — Stock y asignacion</span>
                <div className="infra-form-grid">
                  <label>
                    <span>Unidad</span>
                    <input value={materialForm.unit} onChange={(e) => setMaterialForm((prev) => ({ ...prev, unit: e.target.value }))} required />
                  </label>
                  <label>
                    <span>Laboratorio</span>
                    <select value={materialForm.laboratory_id} onChange={(e) => setMaterialForm((prev) => ({ ...prev, laboratory_id: e.target.value }))}>
                      <option value="">Disponible para cualquier laboratorio</option>
                      {visibleLabs.map((lab) => (
                        <option key={lab.id} value={lab.id}>{lab.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Stock disponible</span>
                    <input type="number" min="0" value={materialForm.quantity_available} onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity_available: e.target.value }))} required />
                  </label>
                  <label>
                    <span>Stock minimo</span>
                    <input type="number" min="0" value={materialForm.minimum_stock} onChange={(e) => setMaterialForm((prev) => ({ ...prev, minimum_stock: e.target.value }))} required />
                  </label>
                </div>
              </div>
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
            </form>
          </section>
          ) : null}
            </>
          ) : null}

          {activeTab === 'movements' ? (
          <section className="infra-card">
            <section className="infra-stock-ops">
              {canMoveStock ? (
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
                        <select value={movementForm.stock_item_id} onChange={(e) => setMovementForm((prev) => ({ ...prev, stock_item_id: e.target.value }))} required>
                          <option value="">Selecciona un material</option>
                          {visibleMaterials.map((m) => (
                            <option key={m.id} value={m.id}>{m.name} ({m.quantity_available} {m.unit})</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Tipo de movimiento</span>
                        <select value={movementForm.movement_type} onChange={(e) => setMovementForm((prev) => ({ ...prev, movement_type: e.target.value }))}>
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
                      <textarea rows="3" value={movementForm.notes} onChange={(e) => setMovementForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Ej. consumo en practica de quimica, compra semestral o devolucion del grupo 2" />
                    </label>
                  </div>
                  {movementWillExceedStock ? (
                    <p className="infra-inline-error">La cantidad a descontar supera el stock disponible del material seleccionado.</p>
                  ) : null}
                  <div className="infra-actions">
                    <button type="submit" className="infra-primary" disabled={movementWillExceedStock || !movementForm.stock_item_id}>
                      Registrar movimiento
                    </button>
                    <button type="button" className="infra-secondary" onClick={() => setMovementForm(defaultMovementForm)}>
                      Limpiar
                    </button>
                  </div>
                </form>
              </div>
              ) : null}

              <div className="infra-stock-panel">
                <div className="infra-section-head">
                  <div>
                    <h3>Historial reciente</h3>
                    <p>Cada ajuste guarda correo, fecha, cantidad y saldo resultante.</p>
                  </div>
                  <div className="infra-stock-alert-count">
                    <span>Alertas de stock</span>
                    <strong>{lowStockMaterials.length}</strong>
                    <button type="button" className="infra-secondary" onClick={handleRefreshData} disabled={loading}>
                      Actualizar datos
                    </button>
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
          ) : null}

          {activeTab === 'reports' ? (
          <>
          <section className="infra-card infra-low-stock-report">
            <div className="infra-section-head">
              <div>
                <p className="infra-kicker">Compras y reposiciones</p>
                <h3>Materiales con stock bajo</h3>
                <p>Solo aparecen materiales cuyo stock actual llego al umbral minimo configurado o esta por debajo.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleReportSubmit}>
              <div className="infra-form-grid">
                <label>
                  <span>Laboratorio</span>
                  <select
                    value={reportFilters.laboratory_id}
                    onChange={(e) => handleReportFilterChange('laboratory_id', e.target.value)}
                  >
                    <option value="">Todos los laboratorios</option>
                    <option value="__GENERAL__">Solo General</option>
                    {visibleLabs.map((lab) => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Estado</span>
                  <select
                    value={reportFilters.status_filter}
                    onChange={(e) => handleReportFilterChange('status_filter', e.target.value)}
                  >
                    <option value="">Todas las alertas</option>
                    <option value="out_of_stock">Sin stock</option>
                    <option value="low_stock">Stock bajo</option>
                  </select>
                </label>

                <label>
                  <span>Buscar</span>
                  <input
                    value={reportFilters.search}
                    onChange={(e) => handleReportFilterChange('search', e.target.value)}
                    placeholder="Nombre, categoria o laboratorio"
                  />
                </label>
              </div>

              {reportFilters.laboratory_id && reportFilters.laboratory_id !== '__GENERAL__' ? (
                <label className="infra-checkbox">
                  <input
                    type="checkbox"
                    checked={reportFilters.include_general}
                    onChange={(e) => handleReportFilterChange('include_general', e.target.checked)}
                  />
                  <span>Incluir tambien insumos generales</span>
                </label>
              ) : null}

              <div className="infra-actions">
                <button type="submit" className="infra-primary" disabled={reportLoading}>
                  {reportLoading ? 'Consultando...' : 'Actualizar reporte'}
                </button>
                <button type="button" className="infra-secondary" onClick={handleReportReset} disabled={reportLoading}>
                  Limpiar filtros
                </button>
              </div>
            </form>

            {reportError ? <p className="infra-alert infra-error">{reportError}</p> : null}

            <div className="infra-summary" style={{ marginTop: '8px', justifyContent: 'flex-start' }}>
              <div><span>Total reporte</span><strong>{reportSummary.total}</strong></div>
              <div><span>Sin stock</span><strong>{reportSummary.outOfStock}</strong></div>
              <div><span>Stock bajo</span><strong>{reportSummary.lowStock}</strong></div>
              <div>
                <span>Generado</span>
                <strong style={{ fontSize: '0.95rem', marginTop: '8px' }}>
                  {stockReport?.generated_at ? formatDateTime(stockReport.generated_at) : '--'}
                </strong>
              </div>
            </div>

            <div className="infra-table-wrap infra-low-stock-table-wrap">
              <table className="infra-table infra-low-stock-table">
                <thead>
                  <tr>
                    <th>Nombre del material</th>
                    <th>Laboratorio</th>
                    <th>Cantidad actual</th>
                    <th>Umbral minimo</th>
                    <th>Faltante</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockReportItems.length === 0 ? (
                    <tr><td colSpan="6">No hay materiales con stock bajo para los filtros aplicados.</td></tr>
                  ) : (
                    lowStockReportItems.map((item) => {
                      const statusMeta = reportStatusMeta[item.status] || { label: item.status, chipClass: '' }
                      const stockGap = Number(item.stock_gap ?? Math.max(0, Number(item.minimum_stock || 0) - Number(item.quantity_available || 0)))
                      return (
                        <tr key={item.item_id}>
                          <td>{item.name}</td>
                          <td>{item.laboratory_name || 'General'}</td>
                          <td>{item.quantity_available} {item.unit}</td>
                          <td>{item.minimum_stock}</td>
                          <td><span className="infra-stock-gap">-{stockGap} {item.unit}</span></td>
                          <td>
                            <span className={`infra-chip ${statusMeta.chipClass}`.trim()}>{statusMeta.label}</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Reporte de uso de insumos</h3>
                <p>Analiza el consumo de materiales agrupado por prácticas y usuarios.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleUsageReportSubmit}>
              <div className="infra-form-grid">
                <label>
                  <span>Usuario</span>
                  <input
                    type="search"
                    value={borrowerQuery}
                    onChange={(e) => {
                      setBorrowerQuery(e.target.value)
                      if (!e.target.value.trim()) {
                        handleUsageReportFilterChange('borrower_id', '')
                      }
                    }}
                    placeholder="Busca por nombre, correo o codigo"
                  />
                  {borrowerQuery.trim().length >= 2 && borrowerResults.length > 0 ? (
                    <ul className="infra-search-suggestions">
                      {borrowerResults.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            className={usageReportFilters.borrower_id === u.id ? 'is-active' : ''}
                            onClick={() => {
                              handleUsageReportFilterChange('borrower_id', u.id)
                              setBorrowerQuery(u.name ? `${u.name} (${u.email || u.username || ''})` : u.email || u.username || '')
                              setBorrowerResults([])
                            }}
                          >
                            <strong>{u.name || u.username || u.email}</strong>
                            <small>{u.email || u.username}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {usageReportFilters.borrower_id ? (
                    <button
                      type="button"
                      className="infra-secondary"
                      onClick={() => {
                        handleUsageReportFilterChange('borrower_id', '')
                        setBorrowerQuery('')
                        setBorrowerResults([])
                      }}
                    >
                      Quitar filtro de usuario
                    </button>
                  ) : null}
                </label>
                <label>
                  <span>Práctica</span>
                  <input
                    value={usageReportFilters.practice}
                    onChange={(e) => handleUsageReportFilterChange('practice', e.target.value)}
                    placeholder="Ej. Química, Física..."
                  />
                </label>
                <label>
                  <span>Fecha desde</span>
                  <input
                    type="date"
                    value={usageReportFilters.date_from}
                    onChange={(e) => handleUsageReportFilterChange('date_from', e.target.value)}
                  />
                </label>
                <label>
                  <span>Fecha hasta</span>
                  <input
                    type="date"
                    value={usageReportFilters.date_to}
                    onChange={(e) => handleUsageReportFilterChange('date_to', e.target.value)}
                  />
                </label>
              </div>
              <div className="infra-actions">
                <button type="submit" className="infra-primary" disabled={usageReportLoading}>
                  {usageReportLoading ? 'Consultando...' : 'Actualizar reporte'}
                </button>
                <button type="button" className="infra-secondary" onClick={handleUsageReportReset} disabled={usageReportLoading}>
                  Limpiar filtros
                </button>
              </div>
            </form>

            {usageReportError ? <p className="infra-alert infra-error">{usageReportError}</p> : null}

            <div className="infra-summary" style={{ marginTop: '8px', justifyContent: 'flex-start' }}>
              <div><span>Total registros</span><strong>{usageReport?.total_records || 0}</strong></div>
              <div>
                <span>Generado</span>
                <strong style={{ fontSize: '0.95rem', marginTop: '8px' }}>
                  {usageReport?.generated_at ? formatDateTime(usageReport.generated_at) : '--'}
                </strong>
              </div>
            </div>

            <div className="infra-table-wrap">
              <table className="infra-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Material</th>
                    <th>Usuario</th>
                    <th>Práctica</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {usageReportItems.length === 0 ? (
                    <tr><td colSpan="5">No hay resultados para los filtros aplicados.</td></tr>
                  ) : (
                    usageReportItems.map((item, index) => (
                      <tr key={index}>
                        <td>{item.loaned_at ? formatDateTime(item.loaned_at) : '--'}</td>
                        <td>{item.asset_name}</td>
                        <td>{item.borrower_name}</td>
                        <td>{item.practice || '--'}</td>
                        <td>{item.quantity}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          </>
          ) : null}

          {activeTab === 'requests' ? (
          <section className="infra-card infra-card-full">
            <div className="infra-section-head">
              <div>
                <h3>Solicitudes de reactivos</h3>
                <p>
                  Aprueba o rechaza pedidos de materiales. Al aprobar, el sistema descuenta el stock y genera un movimiento.
                  Si rechazas una reserva ya aprobada, el stock se repone automaticamente.
                </p>
              </div>
              <div className="infra-actions">
                <select
                  value={supplyStatusFilter}
                  onChange={(event) => {
                    const value = event.target.value
                    setSupplyStatusFilter(value)
                    fetchSupplyReservations(value)
                  }}
                >
                  <option value="pending">Pendientes</option>
                  <option value="approved">Aprobadas</option>
                  <option value="delivered">Entregadas</option>
                  <option value="cancelled">Canceladas</option>
                  <option value="">Todas</option>
                </select>
                <button
                  type="button"
                  className="infra-secondary"
                  onClick={() => fetchSupplyReservations(supplyStatusFilter)}
                  disabled={supplyLoading}
                >
                  {supplyLoading ? 'Cargando...' : 'Refrescar'}
                </button>
                <button
                  type="button"
                  className="infra-primary"
                  onClick={() => setShowSupplyCreateForm((prev) => !prev)}
                >
                  {showSupplyCreateForm ? 'Cancelar' : 'Crear solicitud manual'}
                </button>
              </div>
            </div>

            {showSupplyCreateForm ? (
              <form className="infra-form" onSubmit={handleCreateSupplyReservation} style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                <div className="infra-form-grid">
                  <label>
                    <span>Laboratorio</span>
                    <select
                      value={supplyCreateForm.laboratory_id}
                      onChange={(event) => setSupplyCreateForm((prev) => ({
                        ...prev,
                        laboratory_id: event.target.value,
                        stock_item_id: '',
                      }))}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {visibleLabs.map((lab) => (
                        <option key={lab.id} value={lab.id}>{lab.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Material</span>
                    <select
                      value={supplyCreateForm.stock_item_id}
                      onChange={(event) => setSupplyCreateForm((prev) => ({ ...prev, stock_item_id: event.target.value }))}
                      disabled={!supplyCreateForm.laboratory_id}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {supplyCreateAvailableMaterials.map((material) => {
                        const stock = Number(material.quantity_available || 0)
                        const out = stock <= 0
                        return (
                          <option key={material.id} value={material.id} disabled={out}>
                            {material.name}{out ? ' (Agotado)' : ` - ${stock} ${material.unit || ''}`}
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  <label>
                    <span>Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      value={supplyCreateForm.quantity}
                      onChange={(event) => setSupplyCreateForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    <span>Solicitante / Proposito</span>
                    <input
                      value={supplyCreateForm.requested_for}
                      onChange={(event) => setSupplyCreateForm((prev) => ({ ...prev, requested_for: event.target.value }))}
                      placeholder="Ej: Walk-in estudiante Juan Perez"
                    />
                  </label>
                </div>

                <label>
                  <span>Notas</span>
                  <textarea
                    rows="2"
                    value={supplyCreateForm.notes}
                    onChange={(event) => setSupplyCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>

                <div className="infra-actions">
                  <button type="submit" className="infra-primary" disabled={isCreatingSupply}>
                    {isCreatingSupply ? 'Creando...' : 'Crear solicitud'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="infra-table-wrap">
              <table className="infra-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Laboratorio</th>
                    <th>Cantidad</th>
                    <th>Stock actual</th>
                    <th>Solicitante</th>
                    <th>Origen</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {supplyReservations.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        {supplyLoading ? 'Cargando solicitudes...' : 'No hay solicitudes con ese filtro.'}
                      </td>
                    </tr>
                  ) : (
                    supplyReservations.map((reservation) => {
                      const insufficient = reservation.status === 'pending'
                        && Number(reservation.quantity_available || 0) < Number(reservation.quantity || 0)
                      const isProcessing = supplyActionId === reservation.id
                      return (
                        <tr key={reservation.id}>
                          <td>
                            <strong>{reservation.stock_item_name || reservation.stock_item_id}</strong>
                            {reservation.notes ? <small>{reservation.notes}</small> : null}
                          </td>
                          <td>{reservation.laboratory_name || reservation.laboratory_id || '-'}</td>
                          <td>{reservation.quantity}</td>
                          <td>
                            {reservation.quantity_available}
                            {insufficient ? (
                              <small className="infra-alert infra-error" style={{ marginTop: 4 }}>Stock insuficiente</small>
                            ) : null}
                          </td>
                          <td>
                            {reservation.requested_by || '-'}
                            {reservation.requested_for ? <small>{reservation.requested_for}</small> : null}
                          </td>
                          <td>{reservation.tutorial_session_id ? 'Tutoria' : 'Reserva directa'}</td>
                          <td>
                            <span className={`reservations-status ${reservation.status}`}>
                              {SUPPLY_STATUS_LABELS[reservation.status] || reservation.status}
                            </span>
                          </td>
                          <td>
                            <div className="infra-actions compact">
                              {reservation.status === 'pending' ? (
                                <>
                                  <button
                                    type="button"
                                    className="infra-secondary"
                                    disabled={isProcessing || insufficient}
                                    title={insufficient ? 'No hay stock suficiente para aprobar' : ''}
                                    onClick={() => handleUpdateSupplyStatus(reservation.id, 'approved')}
                                  >
                                    {isProcessing ? 'Aprobando...' : 'Aprobar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="infra-danger"
                                    disabled={isProcessing}
                                    onClick={() => handleUpdateSupplyStatus(reservation.id, 'cancelled')}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              ) : reservation.status === 'approved' ? (
                                <>
                                  <button
                                    type="button"
                                    className="infra-secondary"
                                    disabled={isProcessing}
                                    onClick={() => handleUpdateSupplyStatus(reservation.id, 'delivered')}
                                  >
                                    Marcar entregada
                                  </button>
                                  <button
                                    type="button"
                                    className="infra-danger"
                                    disabled={isProcessing}
                                    onClick={() => handleUpdateSupplyStatus(reservation.id, 'cancelled')}
                                  >
                                    Cancelar (repone stock)
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
          ) : null}

          {activeTab === 'catalog' ? (
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
                  {visibleMaterials.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        Todavia no hay materiales registrados. Usa el boton "Nuevo material" para crear el primer recurso del inventario.
                      </td>
                    </tr>
                  ) : (
                    visibleMaterials.map((material) => (
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
                            {canMoveStock ? (
                              <button type="button" className="infra-secondary" onClick={() => openMovementModal(material)}>
                                Mover stock
                              </button>
                            ) : null}
                            {canManageMaterials ? (
                              <>
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
          ) : null}
        </div>
      )}
    </section>
  )
}

export default AdminMaterialesPage
