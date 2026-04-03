import { useEffect, useMemo, useState } from 'react'
import {
  listReservations,
  markReservationAbsent,
  markReservationCheckIn,
  markReservationCheckOut,
  subscribeReservationsRealtime,
  updateReservationStatus,
} from '../services/reservationsService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './ReservationsPages.css'

const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  in_progress: 'En curso',
  completed: 'Completada',
  absent: 'Ausente',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
}

function AdminReservationsPage({ user }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [reservations, setReservations] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])

  const loadData = async () => {
    try {
      const data = await listReservations()
      setReservations(data)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar el panel de reservas.')
    }
  }

  useEffect(() => {
    loadData()

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'lab_reservation') {
        loadData()
      }
    })

    return () => unsubscribe?.()
  }, [])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return reservations
    return reservations.filter((item) => item.status === statusFilter)
  }, [reservations, statusFilter])

  const pendingCount = reservations.filter((item) => item.status === 'pending').length
  const approvedCount = reservations.filter((item) => item.status === 'approved').length
  const inProgressCount = reservations.filter((item) => item.status === 'in_progress').length

  const handleUpdate = async (reservationId, status) => {
    if (!canManage) return
    setError('')
    setMessage('')
    try {
      await updateReservationStatus(reservationId, status, user?.username || user?.name || 'admin')
      setMessage('Estado actualizado correctamente.')
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva.')
    }
  }

  const handleCheckIn = async (reservationId) => {
    if (!canManage) return
    setError('')
    setMessage('')
    try {
      await markReservationCheckIn(reservationId)
      setMessage('Ingreso registrado correctamente.')
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el ingreso.')
    }
  }

  const handleCheckOut = async (reservationId) => {
    if (!canManage) return
    setError('')
    setMessage('')
    try {
      await markReservationCheckOut(reservationId)
      setMessage('Salida registrada correctamente.')
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo registrar la salida.')
    }
  }

  const handleAbsent = async (reservationId) => {
    if (!canManage) return
    setError('')
    setMessage('')
    try {
      await markReservationAbsent(reservationId)
      setMessage('Reserva marcada como ausente.')
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo marcar la reserva como ausente.')
    }
  }

  return (
    <section className="reservations-page" aria-label="Panel de reservas">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Gestion operativa</p>
          <h2>Reservas de laboratorios</h2>
          <p>Aprueba o rechaza solicitudes y revisa el historial por estado.</p>
        </div>
        <div className="reservations-summary">
          <div><span>Total</span><strong>{reservations.length}</strong></div>
          <div><span>Pendientes</span><strong>{pendingCount}</strong></div>
          <div><span>Aprobadas</span><strong>{approvedCount}</strong></div>
          <div><span>En curso</span><strong>{inProgressCount}</strong></div>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel">
        <div className="reservations-controls" style={{gridTemplateColumns: '240px'}}>
          <label>
            <span>Filtrar por estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="in_progress">En curso</option>
              <option value="completed">Completadas</option>
              <option value="absent">Ausentes</option>
              <option value="rejected">Rechazadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="reservations-empty">No hay reservas para este filtro.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Laboratorio</th>
                <th>Solicitante</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.laboratory_name || item.laboratory_id}</strong>
                    <div>{item.purpose || 'Sin motivo registrado'}</div>
                  </td>
                  <td>
                    <strong>{item.requested_by_name || item.requested_by || '-'}</strong>
                    <div>{item.requested_by_email || '-'}</div>
                  </td>
                  <td>{item.date}</td>
                  <td>{item.start_time} - {item.end_time}</td>
                  <td><span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span></td>
                  <td>
                    <div className="reservations-actions">
                      <button
                        type="button"
                        className="reservations-primary"
                        disabled={!canManage || item.status === 'approved'}
                        onClick={() => handleUpdate(item.id, 'approved')}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="reservations-danger"
                        disabled={!canManage || item.status === 'rejected'}
                        onClick={() => handleUpdate(item.id, 'rejected')}
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        className="reservations-primary"
                        disabled={!canManage || !['approved', 'in_progress'].includes(item.status)}
                        onClick={() => handleCheckIn(item.id)}
                      >
                        Ingreso
                      </button>
                      <button
                        type="button"
                        className="reservations-primary"
                        disabled={!canManage || item.status !== 'in_progress'}
                        onClick={() => handleCheckOut(item.id)}
                      >
                        Salida
                      </button>
                      <button
                        type="button"
                        className="reservations-danger"
                        disabled={!canManage || item.status !== 'approved'}
                        onClick={() => handleAbsent(item.id)}
                      >
                        Ausente
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  )
}

export default AdminReservationsPage
