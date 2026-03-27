import { useEffect, useMemo, useState } from 'react'
import { getAllPracticePlannings, subscribeReservationsRealtime, updatePracticeStatus } from '../api/reservationsApi'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import { formatDate, formatStatus, statusClass } from '../../../shared/utils/formatters'
import { getAuthToken } from '../../../shared/utils/storage'
import './AdminReservationsPage.css'

function formatTrackingStatus(status) {
  if (!status) return 'Sin seguimiento'
  return status
}

function AdminReservationsPage({ user }) {
  const token = getAuthToken()
  const [reservations, setReservations] = useState([])
  const [reviewComments, setReviewComments] = useState({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadReservations = async () => {
    setLoading(true)
    try {
      const data = await getAllPracticePlannings(token)
      setReservations(data)
      setReviewComments(
        Object.fromEntries(data.map((item) => [item.id, item.review_comment || ''])),
      )
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las reservas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReservations()
  }, [])

  useEffect(() => {
    if (!token) {
      return undefined
    }

    return subscribeReservationsRealtime(token, {
      onMessage: (message) => {
        if (!message || message.entity !== 'practice_request') {
          return
        }
        loadReservations()
      },
    })
  }, [token])

  const filteredReservations = useMemo(() => {
    return reservations.filter((item) => {
      const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter
      const haystack = `${item.username} ${item.subject_name || ''} ${item.laboratory_name} ${item.notes || ''}`.toLowerCase()
      const matchesSearch = haystack.includes(search.trim().toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [reservations, search, statusFilter])

  const pendingCount = reservations.filter((item) => item.status === 'pending').length
  const approvedCount = reservations.filter((item) => item.status === 'approved').length
  const canManageReservations = hasAnyPermission(user, ['gestionar_reservas'])
  const canManageMaterials = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reservas_materiales'])
  const canManageRules = hasAnyPermission(user, ['gestionar_reglas_reserva'])

  const handleUpdateStatus = async (reservationId, nextStatus) => {
    setSavingId(reservationId)
    setError('')
    setMessage('')

    try {
      const updated = await updatePracticeStatus(
        reservationId,
        nextStatus,
        token,
        reviewComments[reservationId] || undefined,
      )

      setReservations((previous) =>
        previous.map((item) => (item.id === reservationId ? updated : item)),
      )
      setReviewComments((previous) => ({
        ...previous,
        [reservationId]: updated.review_comment || previous[reservationId] || '',
      }))
      setMessage(
        nextStatus === 'approved' && updated.materials?.length
          ? 'La reserva fue aprobada y sus materiales ya entraron automaticamente al seguimiento de prestamos.'
          : 'La reserva fue actualizada y el usuario ya puede verla en sus notificaciones.',
      )
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="admin-reservations-page" aria-label="Gestion de reservas">
      <header className="admin-reservations-hero">
        <div>
          <p className="admin-reservations-kicker">Revision operativa</p>
          <h2>Gestiona solicitudes de practicas</h2>
          <p>
            Aprueba, rechaza o cancela reservas completas con espacio, materiales y apoyo tecnico.
          </p>
        </div>
        <div className="admin-reservations-stats">
          <div><span>Total</span><strong>{reservations.length}</strong></div>
          <div><span>Pendientes</span><strong>{pendingCount}</strong></div>
          <div><span>Aprobadas</span><strong>{approvedCount}</strong></div>
        </div>
      </header>

      {message ? <p className="admin-reservations-alert success">{message}</p> : null}
      {error ? <p className="admin-reservations-alert error">{error}</p> : null}
      {!canManageReservations ? (
        <p className="admin-reservations-alert error">
          Tu rol puede revisar esta bandeja, pero no aprobar o rechazar reservas porque no tiene el permiso <strong>gestionar_reservas</strong>.
        </p>
      ) : null}
      {canManageRules ? (
        <p className="admin-reservations-alert success">
          Tu rol incluye <strong>gestionar_reglas_reserva</strong>. Puedes usar esta vista como referencia operativa mientras definimos el módulo dedicado de reglas.
        </p>
      ) : null}

      <section className="admin-reservations-toolbar-card">
        <div className="admin-reservations-toolbar">
          <label>
            <span>Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </label>

          <label className="search">
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Usuario, materia, laboratorio o nota"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
      </section>

      {loading ? (
        <p className="admin-reservations-empty">Cargando reservas...</p>
      ) : filteredReservations.length === 0 ? (
        <p className="admin-reservations-empty">No hay reservas para este filtro.</p>
      ) : (
        <div className="admin-reservations-list">
          {filteredReservations.map((reservation) => (
            <article key={reservation.id} className="admin-reservation-card">
              <div className="admin-reservation-head">
                <div>
                  <h3>{reservation.subject_name || 'Practica de laboratorio'}</h3>
                  <p>
                    {reservation.username} · {formatDate(reservation.date)} · {reservation.start_time} - {reservation.end_time}
                  </p>
                </div>
                <span className={`admin-reservation-status ${statusClass(reservation.status)}`}>
                  {formatStatus(reservation.status)}
                </span>
              </div>

              <div className="admin-reservation-grid">
                <div className="admin-reservation-block">
                  <span>Materia o asignatura</span>
                  <strong>{reservation.subject_name || 'Sin materia registrada'}</strong>
                </div>
                <div className="admin-reservation-block">
                  <span>Apoyo tecnico</span>
                  <strong>{reservation.needs_support ? reservation.support_topic || 'Solicitado' : 'No requerido'}</strong>
                </div>
                <div className="admin-reservation-block">
                  <span>Materiales</span>
                  <strong>
                    {canManageMaterials && reservation.materials.length > 0
                      ? reservation.materials.map((material) => `${material.material_name} x${material.quantity}`).join(', ')
                      : canManageMaterials ? 'Sin materiales' : 'Materiales protegidos por permisos'}
                  </strong>
                </div>
                <div className="admin-reservation-block">
                  <span>Seguimiento de materiales</span>
                  <strong>{formatTrackingStatus(reservation.material_tracking_status)}</strong>
                </div>
              </div>

              <p className="admin-reservation-notes">
                {reservation.notes || 'Sin observaciones adicionales.'}
              </p>

              {reservation.material_loans?.length ? (
                <div className="admin-reservation-grid">
                  {reservation.material_loans.map((loan) => (
                    <div key={loan.loan_id} className="admin-reservation-block">
                      <span>{loan.material_name}</span>
                      <strong>
                        {loan.quantity} unidad(es) · {formatStatus(loan.status)}
                      </strong>
                      {loan.return_condition ? (
                        <small>
                          {loan.return_condition === 'ok'
                            ? 'Devuelto sin novedades'
                            : loan.return_condition === 'issues'
                              ? 'Devuelto con observaciones'
                              : 'Seguimiento cancelado'}
                        </small>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <label className="admin-reservation-comment">
                <span>Comentario para el usuario</span>
                <textarea
                  rows="3"
                  value={reviewComments[reservation.id] || ''}
                  onChange={(event) =>
                    setReviewComments((previous) => ({
                      ...previous,
                      [reservation.id]: event.target.value,
                    }))
                  }
                  placeholder="Ej. aprobada para el grupo 1, llevar guia impresa"
                />
              </label>

              <div className="admin-reservation-actions">
                <button
                  type="button"
                  className="approve"
                  disabled={savingId === reservation.id || !canManageReservations}
                  onClick={() => handleUpdateStatus(reservation.id, 'approved')}
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  className="reject"
                  disabled={savingId === reservation.id || !canManageReservations}
                  onClick={() => handleUpdateStatus(reservation.id, 'rejected')}
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  className="neutral"
                  disabled={savingId === reservation.id || !canManageReservations}
                  onClick={() => handleUpdateStatus(reservation.id, 'cancelled')}
                >
                  Cancelar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AdminReservationsPage
