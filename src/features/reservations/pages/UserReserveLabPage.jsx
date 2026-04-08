import { useEffect, useMemo, useState } from 'react'
import {
  createReservation,
  listAvailableLabs,
  listReservations,
  subscribeReservationsRealtime,
} from '../services/reservationsService'
import './ReservationsPages.css'

const defaultForm = {
  laboratory_id: '',
  date: new Date().toISOString().slice(0, 10),
  start_time: '08:00',
  end_time: '09:00',
  purpose: '',
}

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' }

function UserReserveLabPage({ user }) {
  const [labs, setLabs] = useState([])
  const [reservations, setReservations] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = async () => {
    try {
      const [labsData, reservationsData] = await Promise.all([
        listAvailableLabs(),
        listReservations(),
      ])
      setLabs(labsData)
      setReservations(reservationsData)
      if (!form.laboratory_id && labsData.length > 0) {
        setForm((prev) => ({ ...prev, laboratory_id: labsData[0].id }))
      }
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion para reservar.')
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

  const selectedLab = useMemo(
    () => labs.find((lab) => lab.id === form.laboratory_id) || null,
    [form.laboratory_id, labs],
  )

  const myReservations = useMemo(
    () => reservations.filter((item) => item.requested_by === (user?.user_id || '')).slice(-8).reverse(),
    [reservations, user],
  )

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      await createReservation(
        {
          ...form,
          laboratory_name: selectedLab?.name || '',
          area_id: selectedLab?.area_id || '',
          area_name: selectedLab?.area_name || '',
        },
        user,
      )
      setMessage('Reserva enviada correctamente. Queda pendiente de aprobacion.')
      setForm((prev) => ({ ...defaultForm, laboratory_id: prev.laboratory_id || defaultForm.laboratory_id }))
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo crear la reserva.')
    }
  }

  return (
    <section className="reservations-page" aria-label="Reservar laboratorio">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Solicitud de uso</p>
          <h2>Reservar laboratorio por horas</h2>
          <p>Completa los datos para registrar una solicitud en estado pendiente.</p>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel">
        <form className="reservations-form" onSubmit={handleSubmit}>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">1 — Laboratorio</span>
            <label>
              <span>Laboratorio</span>
              <select
                value={form.laboratory_id}
                onChange={(event) => setForm((prev) => ({ ...prev, laboratory_id: event.target.value }))}
                required
              >
                <option value="">Selecciona un laboratorio</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">2 — Fecha y Horario</span>
            <div className="reservations-form-grid">
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Hora de inicio</span>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Hora de fin</span>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
                  required
                />
              </label>
            </div>
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">3 — Motivo</span>
            <label>
              <span>Motivo de la reserva</span>
              <textarea
                rows="4"
                value={form.purpose}
                onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                placeholder="Ej. Práctica de laboratorio de redes, proyecto de tesis..."
                required
              />
            </label>
          </div>

          <div className="reservations-actions">
            <button type="submit" className="reservations-primary">Enviar solicitud</button>
          </div>
        </form>
      </section>

      <section className="reservations-panel">
        <h3>Mis ultimas reservas</h3>
        {myReservations.length === 0 ? (
          <p className="reservations-empty">Aun no tienes reservas registradas.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Laboratorio</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {myReservations.map((item) => (
                <tr key={item.id}>
                  <td>{item.laboratory_name || labNameById[String(item.laboratory_id)] || 'Laboratorio'}</td>
                  <td>{item.date}</td>
                  <td>{item.start_time} - {item.end_time}</td>
                  <td><span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  )
}

export default UserReserveLabPage
