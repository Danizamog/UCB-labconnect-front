import { useEffect, useMemo, useState } from 'react'
import {
  getLabAvailability,
  listAvailableLabs,
  subscribeReservationsRealtime,
} from '../services/reservationsService'
import './ReservationsPages.css'

function UserAvailabilityCalendarPage() {
  const [labs, setLabs] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedLab, setSelectedLab] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const labsData = await listAvailableLabs()
      setLabs(labsData)
      if (!selectedLab && labsData.length > 0) {
        setSelectedLab(labsData[0].id)
      }
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la disponibilidad.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    let mounted = true
    const loadAvailability = async () => {
      if (!selectedLab || !selectedDate) {
        if (mounted) setSlots([])
        return
      }

      try {
        const payload = await getLabAvailability(selectedLab, selectedDate)
        if (mounted) {
          setSlots(Array.isArray(payload?.slots) ? payload.slots : [])
          setError('')
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'No se pudo cargar la disponibilidad del laboratorio.')
          setSlots([])
        }
      }
    }

    loadAvailability()

    return () => {
      mounted = false
    }
  }, [selectedDate, selectedLab])

  useEffect(() => {
    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (!event?.topic || event.topic !== 'lab_reservation') {
        return
      }
      if (selectedLab && selectedDate) {
        getLabAvailability(selectedLab, selectedDate)
          .then((payload) => setSlots(Array.isArray(payload?.slots) ? payload.slots : []))
          .catch(() => {})
      }
    })

    return () => unsubscribe?.()
  }, [selectedDate, selectedLab])

  const mappedSlots = useMemo(() => {
    return slots.map((slot) => ({
      ...slot,
      busyBy: slot.state === 'occupied' || slot.state === 'blocked',
    }))
  }, [slots])

  return (
    <section className="reservations-page" aria-label="Calendario de disponibilidad">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Reserva de laboratorios</p>
          <h2>Calendario de disponibilidad</h2>
          <p>Selecciona laboratorio y fecha para revisar horarios libres y ocupados.</p>
        </div>
      </header>

      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel">
        <div className="reservations-controls">
          <label>
            <span>Laboratorio</span>
            <select value={selectedLab} onChange={(event) => setSelectedLab(event.target.value)}>
              <option value="">Selecciona un laboratorio</option>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Fecha</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        </div>

        {!selectedLab ? (
          <p className="reservations-empty">Selecciona un laboratorio para ver disponibilidad.</p>
        ) : (
          <div className="reservations-slots">
            {mappedSlots.map((slot) => (
              <article key={slot.start} className={`reservations-slot ${slot.busyBy ? 'busy' : 'available'}`}>
                <strong>{slot.start_time} - {slot.end_time}</strong>
                {slot.busyBy ? (
                  <span>
                    {slot.state === 'blocked' ? 'Bloqueado' : 'Ocupado'} {slot.status ? `(${slot.status})` : ''}
                  </span>
                ) : (
                  <span>Disponible</span>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default UserAvailabilityCalendarPage
