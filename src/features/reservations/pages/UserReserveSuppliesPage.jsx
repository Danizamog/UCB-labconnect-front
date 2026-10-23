import { useCallback, useEffect, useMemo, useState } from 'react'
import { listMaterials } from '../../admin/services/infrastructureService'
import {
  createSupplyReservation,
  listAvailableLabs,
  listSupplyReservations,
} from '../services/reservationsService'
import './ReservationsPages.css'
import './UserReserveSuppliesPage.css'

const initialForm = {
  laboratory_id: '',
  stock_item_id: '',
  quantity: 1,
  requested_for: '',
  notes: '',
}

const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const normalized = String(value).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function UserReserveSuppliesPage({ user }) {
  const [labs, setLabs] = useState([])
  const [materials, setMaterials] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [form, setForm] = useState(initialForm)
  const [isLoadingLabs, setIsLoadingLabs] = useState(true)
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadLabsAndReservations = useCallback(async () => {
    setIsLoadingLabs(true)
    try {
      const [labsData, reservationsData] = await Promise.all([
        listAvailableLabs(user),
        listSupplyReservations({ skipCache: true }),
      ])
      setLabs(Array.isArray(labsData) ? labsData : [])
      setMyReservations(Array.isArray(reservationsData) ? reservationsData : [])
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion de reactivos.')
    } finally {
      setIsLoadingLabs(false)
    }
  }, [user])

  const loadMaterials = useCallback(async (laboratoryId) => {
    if (!laboratoryId) {
      setMaterials([])
      return
    }

    setIsLoadingMaterials(true)
    try {
      const data = await listMaterials(laboratoryId)
      setMaterials(Array.isArray(data) ? data : [])
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar el catalogo de reactivos del laboratorio.')
      setMaterials([])
    } finally {
      setIsLoadingMaterials(false)
    }
  }, [])

  useEffect(() => {
    loadLabsAndReservations()
  }, [loadLabsAndReservations])

  useEffect(() => {
    loadMaterials(form.laboratory_id)
    setForm((previous) => ({ ...previous, stock_item_id: '' }))
  }, [form.laboratory_id, loadMaterials])

  const selectedMaterial = useMemo(
    () => materials.find((material) => String(material.id) === String(form.stock_item_id)) || null,
    [materials, form.stock_item_id],
  )

  const inStockMaterials = useMemo(
    () => materials.filter((material) => Number(material?.quantity_available || 0) > 0),
    [materials],
  )

  const totalAvailableUnits = useMemo(
    () => inStockMaterials.reduce((sum, material) => sum + Number(material.quantity_available || 0), 0),
    [inStockMaterials],
  )

  const pendingCount = useMemo(
    () => myReservations.filter((reservation) => reservation.status === 'pending').length,
    [myReservations],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!form.laboratory_id) {
      setError('Selecciona un laboratorio para continuar.')
      return
    }

    if (!form.stock_item_id) {
      setError('Selecciona un reactivo disponible para continuar.')
      return
    }

    const requestedQuantity = Number(form.quantity || 0)
    const currentAvailable = Number(selectedMaterial?.quantity_available || 0)

    if (requestedQuantity <= 0) {
      setError('La cantidad debe ser mayor a cero.')
      return
    }

    if (requestedQuantity > currentAvailable) {
      setError('La cantidad solicitada supera el stock disponible.')
      return
    }

    setIsSubmitting(true)
    try {
      await createSupplyReservation({
        stock_item_id: form.stock_item_id,
        quantity: requestedQuantity,
        requested_for: form.requested_for,
        notes: form.notes,
        laboratory_id: form.laboratory_id,
      })

      setMessage('Solicitud de reserva creada. El stock se descontara cuando el encargado apruebe.')
      setForm((previous) => ({
        ...previous,
        stock_item_id: '',
        quantity: 1,
        requested_for: '',
        notes: '',
      }))

      await Promise.all([
        loadMaterials(form.laboratory_id),
        loadLabsAndReservations(),
      ])
    } catch (err) {
      setError(err.message || 'No se pudo crear la reserva del reactivo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderMaterialsArea = () => {
    if (!form.laboratory_id) {
      return (
        <p className="infra-empty">Selecciona un laboratorio para ver los reactivos disponibles.</p>
      )
    }

    if (isLoadingMaterials) {
      return <p className="infra-empty">Cargando reactivos del laboratorio...</p>
    }

    if (materials.length === 0) {
      return <p className="infra-empty">Este laboratorio no tiene reactivos registrados.</p>
    }

    return (
      <div className="materials-grid" role="radiogroup" aria-label="Reactivos disponibles">
        {materials.map((material) => {
          const stock = Number(material.quantity_available || 0)
          const isOutOfStock = stock <= 0
          const isSelected = String(form.stock_item_id) === String(material.id)
          const cardClass = [
            'material-card',
            isOutOfStock ? 'out-of-stock' : '',
            isSelected ? 'selected' : '',
          ].filter(Boolean).join(' ')

          return (
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isOutOfStock}
              disabled={isOutOfStock}
              key={material.id}
              className={cardClass}
              onClick={() => {
                if (isOutOfStock) return
                setForm((previous) => ({ ...previous, stock_item_id: String(material.id) }))
              }}
            >
              <div className="material-card-header">
                <strong>{material.name}</strong>
                {isOutOfStock ? (
                  <span className="material-badge agotado">Agotado</span>
                ) : (
                  <span className="material-badge disponible">{stock} {material.unit}</span>
                )}
              </div>
              {material.category ? (
                <span className="material-card-category">{material.category}</span>
              ) : null}
              {material.description ? (
                <p className="material-card-description">{material.description}</p>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <section className="reservations-page" aria-label="Reservar reactivos">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Laboratorio</p>
          <h2>Reservar reactivos</h2>
          <p>Solicita los reactivos disponibles del laboratorio elegido y registra el uso esperado para tu practica.</p>
        </div>
        <div className="reservations-summary">
          <div>
            <span>Reactivos</span>
            <strong>{materials.length}</strong>
          </div>
          <div>
            <span>Unidades</span>
            <strong>{totalAvailableUnits}</strong>
          </div>
          <div>
            <span>Pendientes</span>
            <strong>{pendingCount}</strong>
          </div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Nueva solicitud</h3>
          <p className="reservations-panel-subtitle">
            Los materiales quedan reservados al solicitar y se descuentan del inventario al ser aprobados por el encargado.
          </p>
        </div>

        {isLoadingLabs ? (
          <p className="infra-empty">Cargando laboratorios...</p>
        ) : (
          <form className="reservations-form" onSubmit={handleSubmit}>
            <div className="reservations-form-grid">
              <label>
                <span>Laboratorio</span>
                <select
                  value={form.laboratory_id}
                  onChange={(event) => {
                    setForm((previous) => ({
                      ...previous,
                      laboratory_id: event.target.value,
                      stock_item_id: '',
                    }))
                  }}
                  required
                >
                  <option value="">Selecciona un laboratorio</option>
                  {labs.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  max={Math.max(Number(selectedMaterial?.quantity_available || 1), 1)}
                  value={form.quantity}
                  onChange={(event) => setForm((previous) => ({ ...previous, quantity: event.target.value }))}
                  disabled={!selectedMaterial}
                  required
                />
              </label>

              <label>
                <span>Solicitado para</span>
                <input
                  value={form.requested_for}
                  onChange={(event) => setForm((previous) => ({ ...previous, requested_for: event.target.value }))}
                  placeholder="Ej.: Practica de quimica organica"
                />
              </label>
            </div>

            <div className="materials-picker">
              <span className="materials-picker-label">Reactivos del laboratorio</span>
              {renderMaterialsArea()}
            </div>

            <label>
              <span>Notas</span>
              <textarea
                rows="3"
                value={form.notes}
                onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                placeholder="Detalle adicional de uso o concentracion requerida"
              />
            </label>

            <div className="reservations-actions">
              <button
                type="submit"
                className="reservations-primary"
                disabled={isSubmitting || !form.stock_item_id}
              >
                {isSubmitting ? 'Reservando...' : 'Reservar reactivo'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Mis solicitudes</h3>
          <p className="reservations-panel-subtitle">Historial de reservas de reactivos que realizaste.</p>
        </div>

        {myReservations.length === 0 ? (
          <p className="infra-empty">Aun no realizaste reservas de reactivos.</p>
        ) : (
          <div className="supplies-table-wrap">
            <table className="supplies-table">
              <thead>
                <tr>
                  <th>Reactivo</th>
                  <th>Laboratorio</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Solicitado para</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {myReservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>
                      <strong>{reservation.stock_item_name || reservation.stock_item_id}</strong>
                    </td>
                    <td>{reservation.laboratory_name || '-'}</td>
                    <td>{reservation.quantity}</td>
                    <td>
                      <span className={`reservations-status ${reservation.status}`}>
                        {STATUS_LABELS[reservation.status] || reservation.status}
                      </span>
                    </td>
                    <td>{reservation.requested_for || '-'}</td>
                    <td>
                      {formatDateTime(reservation.created)}
                      <small>{reservation.notes || 'Sin observaciones'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

export default UserReserveSuppliesPage
