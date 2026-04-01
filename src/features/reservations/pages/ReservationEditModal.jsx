import './ReservationEditModal.css'

function ReservationEditModal({
  reservation,
  labs = [],
  form,
  onChange,
  onSubmit,
  onClose,
  isSubmitting = false,
}) {
  if (!reservation) {
    return null
  }

  return (
    <div className="reservation-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="reservation-modal" onClick={(event) => event.stopPropagation()}>
        <header className="reservation-modal-header">
          <div>
            <p className="reservation-modal-kicker">Modificar reserva</p>
            <h3>Ajustar fecha, horario o laboratorio</h3>
            <p>
              {reservation.status === 'approved'
                ? 'Si modificas una reserva aprobada, volvera a pendiente para una nueva revision.'
                : 'Los cambios se guardaran sobre tu solicitud actual.'}
            </p>
          </div>
          <button type="button" className="reservation-modal-close" onClick={onClose} aria-label="Cerrar modal">
            ×
          </button>
        </header>

        <form className="reservation-modal-form" onSubmit={onSubmit}>
          <div className="reservation-modal-grid">
            <label>
              <span>Laboratorio</span>
              <select
                value={form.laboratory_id}
                onChange={(event) => onChange('laboratory_id', event.target.value)}
                required
              >
                <option value="">Selecciona un laboratorio</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Fecha</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => onChange('date', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Hora de inicio</span>
              <input
                type="time"
                value={form.start_time}
                onChange={(event) => onChange('start_time', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Hora de fin</span>
              <input
                type="time"
                value={form.end_time}
                onChange={(event) => onChange('end_time', event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            <span>Motivo</span>
            <textarea
              rows="4"
              value={form.purpose}
              onChange={(event) => onChange('purpose', event.target.value)}
              required
            />
          </label>

          <div className="reservation-modal-actions">
            <button type="button" className="reservation-modal-secondary" onClick={onClose}>
              Cerrar
            </button>
            <button type="submit" className="reservation-modal-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ReservationEditModal
