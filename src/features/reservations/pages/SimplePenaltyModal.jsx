import { useState, useMemo } from 'react'
import './PenaltyModal.css'

const DURATION_PRESETS = [
  { label: '24 h', days: 1 },
  { label: '3 dias', days: 3 },
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
]

function SimplepenaltyModal({
  isOpen = false,
  form,
  userOptions = [],
  labOptions = [],
  selectedUser = null,
  userReservations = [],
  validationErrors = {},
  validationMessage = '',
  onApplyDuration,
  onChange,
  onSelectReservation,
  onSubmit,
  onClose,
  isSubmitting = false,
}) {
  const [selectedReservationId, setSelectedReservationId] = useState(null)

  if (!isOpen) {
    return null
  }

  const selectedReservation = userReservations.find((r) => r.id === selectedReservationId)
  const submitDisabled = isSubmitting || Boolean(validationMessage)

  return (
    <div className="reservation-modal-backdrop penalty-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="reservation-modal penalty-modal" onClick={(event) => event.stopPropagation()}>
        <header className="reservation-modal-header penalty-modal-hero">
          <div>
            <p className="reservation-modal-kicker">Penalizacion por Danos</p>
            <h3>Registrar Suspensión Documentada</h3>
            <p>Selecciona un usuario, elige una reserva previa, especifica el daño y define la duración.</p>
          </div>
          <button type="button" className="reservation-modal-close" onClick={onClose} aria-label="Cerrar modal">
            x
          </button>
        </header>

        <form className="reservation-modal-form penalty-modal-form penalty-simple-form" onSubmit={onSubmit}>
          {validationMessage ? (
            <p className="penalty-modal-warning">{validationMessage}</p>
          ) : (
            <p className="penalty-modal-ready">Completa los siguientes pasos para registrar una penalización.</p>
          )}

          {/* PASO 1: SELECCIONAR USUARIO */}
          <section className="penalty-form-section">
            <div className="penalty-section-heading">
              <span>1</span>
              <div>
                <h4>¿Quién fue penalizado?</h4>
                <p>Selecciona al usuario responsable del daño.</p>
              </div>
            </div>

            <label className="penalty-field is-wide">
              <span>Usuario *</span>
              <select
                value={form.user_selection}
                onChange={(event) => onChange('user_selection', event.target.value)}
                required
              >
                <option value="">Selecciona un usuario</option>
                {userOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedUser && (
              <div className="penalty-user-card">
                <div>
                  <strong>{selectedUser.user_name}</strong>
                  <span>{selectedUser.user_email}</span>
                </div>
                <span className="penalty-user-role">{selectedUser.role || 'Usuario'}</span>
              </div>
            )}
          </section>

          {/* PASO 2: SELECCIONAR RESERVA */}
          {selectedUser && userReservations.length > 0 && (
            <section className="penalty-form-section">
              <div className="penalty-section-heading">
                <span>2</span>
                <div>
                  <h4>¿En cuál reserva ocurrió el daño?</h4>
                  <p>Haz clic en una reserva para auto-llenar los datos del incidente.</p>
                </div>
              </div>

              <div className="penalty-reservations-grid">
                {userReservations.map((reservation) => (
                  <button
                    key={reservation.id}
                    type="button"
                    onClick={() => {
                      setSelectedReservationId(reservation.id)
                      onSelectReservation?.(reservation)
                    }}
                    className={`penalty-reservation-card ${selectedReservationId === reservation.id ? 'active' : ''}`}
                  >
                    <div className="reservation-header">
                      <strong>{reservation.laboratory_name}</strong>
                      <span className="status-badge">{reservation.status}</span>
                    </div>
                    <div className="reservation-details">
                      <span className="date-label">{new Date(reservation.date).toLocaleDateString('es-BO')}</span>
                      <span className="time-label">
                        {reservation.start_time} - {reservation.end_time}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* PASO 3: DETALLES DEL DAÑO */}
          <section className="penalty-form-section">
            <div className="penalty-section-heading">
              <span>{selectedUser && userReservations.length > 0 ? '3' : '2'}</span>
              <div>
                <h4>¿Qué causó el daño?</h4>
                <p>Especifica el tipo y lugar del daño.</p>
              </div>
            </div>

            <div className="penalty-form-grid">
              {selectedReservation && (
                <>
                  <label className="penalty-field">
                    <span>Laboratorio</span>
                    <input
                      type="text"
                      value={selectedReservation.laboratory_name}
                      readOnly
                      className="readonly-field"
                    />
                  </label>
                  <label className="penalty-field">
                    <span>Fecha</span>
                    <input type="text" value={selectedReservation.date} readOnly className="readonly-field" />
                  </label>
                  <label className="penalty-field">
                    <span>Horario</span>
                    <input
                      type="text"
                      value={`${selectedReservation.start_time} - ${selectedReservation.end_time}`}
                      readOnly
                      className="readonly-field"
                    />
                  </label>
                </>
              )}

              <label className="penalty-field is-wide">
                <span>Tipo de daño *</span>
                <select value={form.incident_scope} onChange={(event) => onChange('incident_scope', event.target.value)}>
                  <option value="asset">Daño a un equipo</option>
                  <option value="laboratory">Daño al laboratorio</option>
                </select>
              </label>

              <label className="penalty-field is-wide">
                <span>Motivo de la penalización *</span>
                <textarea
                  rows="3"
                  value={form.reason}
                  onChange={(event) => onChange('reason', event.target.value)}
                  placeholder="Describe el daño, responsabilidad y sanción..."
                  required
                />
                <small>{String(form.reason || '').length}/500 caracteres</small>
              </label>
            </div>
          </section>

          {/* PASO 4: DURACIÓN */}
          <section className="penalty-form-section">
            <div className="penalty-section-heading">
              <span>{selectedUser && userReservations.length > 0 ? '4' : '3'}</span>
              <div>
                <h4>¿Por cuánto tiempo?</h4>
                <p>Define la duración de la penalización.</p>
              </div>
            </div>

            <div className="penalty-duration-pills" aria-label="Duraciones rápidas">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => onApplyDuration?.(preset.days)}
                  className="duration-pill"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="penalty-form-grid">
              <label className="penalty-field">
                <span>Inicio *</span>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => onChange('starts_at', event.target.value)}
                  required
                />
              </label>
              <label className="penalty-field">
                <span>Fin *</span>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  min={form.starts_at}
                  onChange={(event) => onChange('ends_at', event.target.value)}
                  required
                />
              </label>
            </div>

            {form.starts_at && form.ends_at && (
              <div className="penalty-duration-summary">
                <div className="summary-item">
                  <strong>
                    {Math.ceil(
                      (new Date(form.ends_at).getTime() - new Date(form.starts_at).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}
                    días
                  </strong>
                  <small>De penalización</small>
                </div>
              </div>
            )}
          </section>

          {/* Notas internas */}
          <section className="penalty-form-section">
            <label className="penalty-field is-wide">
              <span>Notas internas (opcional)</span>
              <textarea
                rows="2"
                value={form.notes}
                onChange={(event) => onChange('notes', event.target.value)}
                placeholder="Notas adicionales..."
                maxLength={500}
              />
              <small>{String(form.notes || '').length}/500 caracteres</small>
            </label>
          </section>

          <div className="reservation-modal-actions">
            <button type="button" className="reservation-modal-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="reservation-modal-primary" disabled={submitDisabled}>
              {isSubmitting ? 'Guardando...' : 'Guardar Penalización'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default SimplepenaltyModal
