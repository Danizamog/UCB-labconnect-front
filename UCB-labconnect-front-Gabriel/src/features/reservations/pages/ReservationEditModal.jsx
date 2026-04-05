import './ReservationEditModal.css'

function ReservationEditModal({
  reservation,
  labs = [],
  form,
  slots = [],
  selectedSlotKey = '',
  isLoadingSlots = false,
  minDate = '',
  maxDate = '',
  validationMessage = '',
  onSelectSlot,
  getSlotKey,
  getSlotTone,
  getSlotLabel,
  isSlotSelectable,
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
              Esta reserva aprobada solo puede modificarse una vez. Actualiza la fecha, el horario o el laboratorio y confirma los cambios.
            </p>
          </div>
          <button type="button" className="reservation-modal-close" onClick={onClose} aria-label="Cerrar modal">
            x
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
                min={minDate}
                max={maxDate}
                onChange={(event) => onChange('date', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Hora de inicio</span>
              <input
                type="text"
                value={form.start_time}
                readOnly
                placeholder="Selecciona un bloque"
              />
            </label>
            <label>
              <span>Hora de fin</span>
              <input
                type="text"
                value={form.end_time}
                readOnly
                placeholder="Selecciona un bloque"
              />
            </label>
          </div>

          <div className="reservation-slot-panel is-compact">
            <div className="reservation-slot-header">
              <div>
                <strong>Bloques disponibles para reprogramar</strong>
                <p>Solo puedes guardar horarios que coincidan con un bloque valido del laboratorio.</p>
              </div>
              <div className="reservation-slot-legend">
                <span className="cal-legend-item cal-legend--available">
                  <span className="cal-legend-dot" /> Disponible
                </span>
                <span className="cal-legend-item cal-legend--busy">
                  <span className="cal-legend-dot" /> Ocupado
                </span>
                <span className="reservation-slot-legend-item maintenance">
                  <span className="reservation-slot-legend-dot" /> Mantenimiento
                </span>
                <span className="reservation-slot-legend-item blocked-other">
                  <span className="reservation-slot-legend-dot" /> Bloqueado
                </span>
                <span className="reservation-slot-legend-item past">
                  <span className="reservation-slot-legend-dot" /> Hora pasada
                </span>
              </div>
            </div>

            {isLoadingSlots ? (
              <p className="reservations-empty">Cargando bloques del dia...</p>
            ) : slots.length === 0 ? (
              <p className="reservations-empty">No hay bloques configurados para esta fecha.</p>
            ) : (
              <div className="reservation-slot-grid">
                {slots.map((slot) => {
                  const slotKey = getSlotKey(slot)
                  const selectable = isSlotSelectable(slot)
                  const isSelected = selectedSlotKey === slotKey
                  return (
                    <button
                      key={slotKey}
                      type="button"
                      className={`reservations-slot ${getSlotTone(slot)}${isSelected ? ' is-selected' : ''}`}
                      disabled={!selectable}
                      onClick={() => onSelectSlot(slot)}
                    >
                      <strong>{slot.start_time} - {slot.end_time}</strong>
                      <span>{getSlotLabel(slot)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {validationMessage ? <p className="reservation-inline-hint">{validationMessage}</p> : null}

          <label>
            <span>Motivo</span>
            <textarea
              rows="4"
              value={form.purpose}
              maxLength={250}
              onChange={(event) => onChange('purpose', event.target.value)}
              required
            />
          </label>

          <p className="reservation-inline-hint">
            El sistema valida bloques exactos del laboratorio. Horas parciales como 14:45 - 15:00 no son aceptables.
          </p>

          <div className="reservation-modal-actions">
            <button type="button" className="reservation-modal-secondary" onClick={onClose}>
              Cerrar
            </button>
            <button type="submit" className="reservation-modal-primary" disabled={isSubmitting || Boolean(validationMessage)}>
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ReservationEditModal
