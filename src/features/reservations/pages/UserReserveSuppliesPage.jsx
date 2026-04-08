import { useEffect, useMemo, useState } from 'react'
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

function normalizeLabId(value) {
  return value === null || value === undefined || value === '' ? '' : String(value)
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
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [labsData, materialsData, reservationsData] = await Promise.all([
        listAvailableLabs(user),
        listMaterials(),
        listSupplyReservations({}, user),
      ])

      setLabs(Array.isArray(labsData) ? labsData : [])
      setMaterials(Array.isArray(materialsData) ? materialsData : [])
      setMyReservations(Array.isArray(reservationsData) ? reservationsData : [])
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion de reactivos.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const availableMaterials = useMemo(() => {
    return materials.filter((material) => {
      if (Number(material?.quantity_available || 0) <= 0) {
        return false
      }

      const selectedLabId = normalizeLabId(form.laboratory_id)
      const materialLabId = normalizeLabId(material?.laboratory_id)

      if (!selectedLabId) {
        return true
      }

      return materialLabId === '' || materialLabId === selectedLabId
    })
  }, [form.laboratory_id, materials])

  useEffect(() => {
    if (availableMaterials.length === 0) {
      if (form.stock_item_id) {
        setForm((previous) => ({ ...previous, stock_item_id: '' }))
      }
      return
    }

    const hasSelected = availableMaterials.some((material) => String(material.id) === String(form.stock_item_id))
    if (!hasSelected) {
      setForm((previous) => ({ ...previous, stock_item_id: String(availableMaterials[0].id) }))
    }
  }, [availableMaterials, form.stock_item_id])

  const selectedMaterial = useMemo(
    () => availableMaterials.find((material) => String(material.id) === String(form.stock_item_id)) || null,
    [availableMaterials, form.stock_item_id],
  )

  const pendingCount = useMemo(
    () => myReservations.filter((reservation) => reservation.status === 'pending').length,
    [myReservations],
  )

  const materialById = useMemo(
    () => Object.fromEntries(materials.map((material) => [String(material.id), material])),
    [materials],
  )

  const totalAvailableUnits = useMemo(
    () => availableMaterials.reduce((sum, material) => sum + Number(material.quantity_available || 0), 0),
    [availableMaterials],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!form.stock_item_id) {
      setError('Selecciona un reactivo para continuar.')
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
      })

      setMessage('Reserva de reactivo creada correctamente.')
      setForm((previous) => ({
        ...previous,
        quantity: 1,
        requested_for: '',
        notes: '',
      }))

      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo crear la reserva del reactivo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="reservations-page" aria-label="Reservar reactivos">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Laboratorio</p>
          <h2>Reservar reactivos</h2>
          <p>Solicita los reactivos disponibles y registra el uso esperado para tu practica.</p>
        </div>
        <div className="reservations-summary">
          <div>
            <span>Reactivos</span>
            <strong>{availableMaterials.length}</strong>
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
          <p className="reservations-panel-subtitle">El stock se descuenta al crear la solicitud y queda pendiente de validacion.</p>
        </div>

        {isLoading ? (
          <p className="infra-empty">Cargando reactivos...</p>
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
                    }))
                  }}
                >
                  <option value="">Todos los laboratorios</option>
                  {labs.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Reactivo</span>
                <select
                  value={form.stock_item_id}
                  onChange={(event) => setForm((previous) => ({ ...previous, stock_item_id: event.target.value }))}
                  required
                >
                  {availableMaterials.length === 0 ? <option value="">Sin stock disponible</option> : null}
                  {availableMaterials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name} ({material.quantity_available} {material.unit})
                    </option>
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
                disabled={isSubmitting || availableMaterials.length === 0}
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
                      <small>
                        {materialById[String(reservation.stock_item_id)]
                          ? `${materialById[String(reservation.stock_item_id)].quantity_available} ${materialById[String(reservation.stock_item_id)].unit} disponibles ahora`
                          : ''}
                      </small>
                    </td>
                    <td>{reservation.quantity}</td>
                    <td>
                      <span className={`reservations-status ${reservation.status}`}>
                        {STATUS_LABELS[reservation.status] || reservation.status}
                      </span>
                    </td>
                    <td>{reservation.requested_for || '-'}</td>
                    <td>
                      {formatDateTime(reservation.created)}
                      <small>
                        {reservation.notes || 'Sin observaciones'}
                      </small>
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
