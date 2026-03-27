import { useEffect, useMemo, useState } from 'react'
import {
  getMyNotifications,
  getMyPracticePlannings,
  markNotificationAsRead,
  subscribeReservationsRealtime,
} from '../api/reservationsApi'
import './UserReservationCenterPage.css'

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatStatus(status) {
  if (status === 'approved') return 'Aprobada'
  if (status === 'pending') return 'Pendiente'
  if (status === 'rejected') return 'Rechazada'
  if (status === 'cancelled') return 'Cancelada'
  if (status === 'active') return 'Activo'
  if (status === 'overdue') return 'Vencido'
  if (status === 'returned') return 'Devuelto'
  return status
}

function formatTrackingStatus(status) {
  if (!status) return 'Sin seguimiento de materiales'
  return status
}

function statusClass(status) {
  if (status === 'approved') return 'approved'
  if (status === 'pending') return 'pending'
  if (status === 'rejected' || status === 'cancelled') return 'rejected'
  return 'neutral'
}

function UserReservationCenterPage() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token') || ''
  const [reservations, setReservations] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [reservationsData, notificationsData] = await Promise.all([
        getMyPracticePlannings(token),
        getMyNotifications(token),
      ])
      setReservations(
        [...reservationsData].sort(
          (left, right) =>
            new Date(`${right.date}T${right.start_time}`).getTime() -
            new Date(`${left.date}T${left.start_time}`).getTime(),
        ),
      )
      setNotifications(notificationsData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus reservas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
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
        loadData()
      },
    })
  }, [token])

  const unreadNotifications = notifications.filter((item) => !item.read)
  const activeReservations = reservations.filter((item) => ['pending', 'approved'].includes(item.status))
  const historyReservations = reservations.filter((item) => ['rejected', 'cancelled'].includes(item.status))

  const groupedReservations = useMemo(
    () => [
      {
        key: 'active',
        title: 'Solicitudes activas',
        description: 'Reservas todavia en curso o en revision.',
        items: activeReservations,
      },
      {
        key: 'history',
        title: 'Historial',
        description: 'Solicitudes que ya fueron cerradas o rechazadas.',
        items: historyReservations,
      },
    ],
    [activeReservations, historyReservations],
  )

  const handleMarkAll = async () => {
    setMarkingAll(true)
    setError('')
    setMessage('')

    try {
      await Promise.all(unreadNotifications.map((item) => markNotificationAsRead(item.id, token)))
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true })))
      setMessage('Tus notificaciones fueron actualizadas.')
    } catch (err) {
      setError(err.message || 'No se pudieron actualizar las notificaciones')
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <section className="user-reservations-page" aria-label="Mis reservas">
      <header className="user-reservations-hero">
        <div>
          <p className="user-reservations-kicker">Seguimiento personal</p>
          <h2>Revisa tus reservas y notificaciones</h2>
          <p>
            Aqui ves el estado de tus solicitudes y las respuestas del administrador sobre cada practica.
          </p>
        </div>
        <div className="user-reservations-stats">
          <div><span>Solicitudes</span><strong>{reservations.length}</strong></div>
          <div><span>Pendientes</span><strong>{activeReservations.filter((item) => item.status === 'pending').length}</strong></div>
          <div><span>Notificaciones</span><strong>{unreadNotifications.length}</strong></div>
        </div>
      </header>

      {message ? <p className="user-reservations-alert success">{message}</p> : null}
      {error ? <p className="user-reservations-alert error">{error}</p> : null}

      {loading ? (
        <p className="user-reservations-empty">Cargando tus solicitudes...</p>
      ) : (
        <div className="user-reservations-grid">
          <section className="user-reservations-card">
            <div className="user-reservations-section-head">
              <div>
                <h3>Notificaciones</h3>
                <p>Cuando el administrador revise tu solicitud, la respuesta aparecera aqui.</p>
              </div>
              <button type="button" onClick={handleMarkAll} disabled={markingAll || unreadNotifications.length === 0}>
                {markingAll ? 'Actualizando...' : 'Marcar todo como leido'}
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="user-reservations-empty">Todavia no tienes notificaciones.</p>
            ) : (
              <div className="user-notification-list">
                {notifications.map((item) => (
                  <article key={item.id} className={`user-notification-card ${item.read ? 'read' : 'unread'}`}>
                    <div className="user-notification-head">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.message}</p>
                      </div>
                      {!item.read ? <span>Nueva</span> : null}
                    </div>
                    <div className="user-notification-meta">
                      <span>{item.laboratory_name}</span>
                      <span>{formatDate(item.date)}</span>
                      <span>{item.start_time} - {item.end_time}</span>
                    </div>
                    <small>{item.review_comment || 'Sin comentario adicional.'}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="user-reservations-card">
            <div className="user-reservations-section-head">
              <div>
                <h3>Mis reservas</h3>
                <p>Consulta el estado, laboratorio, horario y materiales de cada solicitud.</p>
              </div>
            </div>

            <div className="user-reservation-groups">
              {groupedReservations.map((group) => (
                <div key={group.key} className="user-reservation-group">
                  <div className="user-reservation-group-head">
                    <h4>{group.title}</h4>
                    <p>{group.description}</p>
                  </div>
                  {group.items.length === 0 ? (
                    <p className="user-reservations-empty">No hay solicitudes en esta seccion.</p>
                  ) : (
                    <div className="user-reservation-list">
                      {group.items.map((reservation) => (
                        <article key={reservation.id} className="user-reservation-card">
                          <div className="user-reservation-head">
                            <div>
                              <strong>{reservation.subject_name || reservation.laboratory_name}</strong>
                              <p>{formatDate(reservation.date)} · {reservation.start_time} - {reservation.end_time}</p>
                            </div>
                            <span className={`user-reservation-status ${statusClass(reservation.status)}`}>
                              {formatStatus(reservation.status)}
                            </span>
                          </div>
                          <p className="user-reservation-notes">
                            {reservation.notes || 'Sin observaciones registradas.'}
                          </p>
                          <div className="user-reservation-meta">
                            <span>Materia: {reservation.subject_name || 'Sin materia registrada'}</span>
                            <span>
                              {reservation.materials.length > 0
                                ? reservation.materials.map((material) => `${material.material_name} x${material.quantity}`).join(', ')
                                : 'Sin materiales'}
                            </span>
                            <span>{reservation.needs_support ? reservation.support_topic || 'Con apoyo tecnico' : 'Sin apoyo tecnico'}</span>
                            {reservation.materials.length > 0 ? (
                              <span>{formatTrackingStatus(reservation.material_tracking_status)}</span>
                            ) : null}
                          </div>
                          {reservation.material_loans?.length ? (
                            <div className="user-reservation-meta">
                              {reservation.material_loans.map((loan) => (
                                <span key={loan.loan_id}>
                                  {loan.material_name}: {formatStatus(loan.status)}
                                  {loan.return_condition === 'ok' ? ' · sin novedades' : ''}
                                  {loan.return_condition === 'issues' ? ' · con observaciones' : ''}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {reservation.review_comment ? (
                            <small className="user-reservation-comment">Comentario admin: {reservation.review_comment}</small>
                          ) : null}
                          {reservation.material_loans?.some((loan) => loan.return_notes || loan.incident_notes) ? (
                            <small className="user-reservation-comment">
                              {reservation.material_loans
                                .filter((loan) => loan.return_notes || loan.incident_notes)
                                .map((loan) => `${loan.material_name}: ${loan.incident_notes || loan.return_notes}`)
                                .join(' · ')}
                            </small>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default UserReservationCenterPage
