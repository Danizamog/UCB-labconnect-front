import { useState } from 'react'
import './PenaltyModal.css'

const DURATION_PRESETS = [
  { label: '24 h', days: 1 },
  { label: '3 dias', days: 3 },
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
]

function FieldError({ message }) {
  if (!message) {
    return null
  }

  return <small className="penalty-field-error">{message}</small>
}

function getAssetLabel(asset) {
  if (!asset) {
    return ''
  }

  return asset.name || asset.code || asset.serial_number || asset.id || ''
}

function PenaltyModal({
  isOpen = false,
  form,
  userOptions = [],
  assetOptions = [],
  evidenceOptions = [],
  labOptions = [],
  selectedUser = null,
  selectedAsset = null,
  selectedLab = null,
  selectedEvidence = null,
  validationErrors = {},
  validationMessage = '',
  userReservations = [],
  onApplyDuration,
  onChange,
  onSubmit,
  onClose,
  isSubmitting = false,
}) {
  const [currentStep, setCurrentStep] = useState(1)

  if (!isOpen) {
    return null
  }

  const submitDisabled = isSubmitting || Boolean(validationMessage)
  const isStep1Complete = form.user_selection && form.user_id && form.user_email
  const isStep2Complete = form.incident_laboratory_id && form.incident_date && form.incident_start_time && form.incident_end_time && form.evidence_ticket_id
  const isStep3Complete = form.starts_at && form.ends_at
  const isStep4Complete = form.reason && form.reason.length >= 10

  return (
    <div className="reservation-modal-backdrop penalty-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="reservation-modal penalty-modal penalty-modal-wizard" onClick={(event) => event.stopPropagation()}>
        <header className="reservation-modal-header penalty-modal-hero">
          <div>
            <p className="reservation-modal-kicker">Penalizacion por danos</p>
            <h3>Registrar suspension documentada (Paso {currentStep} de 4)</h3>
            <p>Completa cada sección para registrar una penalizacion disciplinaria.</p>
          </div>
          <button type="button" className="reservation-modal-close" onClick={onClose} aria-label="Cerrar modal">
            x
          </button>
        </header>

        {/* Progress Bar */}
        <div className="penalty-progress-bar">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className={`penalty-progress-step ${step === currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}>
              <span>{step}</span>
              <label>
                {step === 1 && 'Responsable'}
                {step === 2 && 'Incidente'}
                {step === 3 && 'Vigencia'}
                {step === 4 && 'Justificación'}
              </label>
            </div>
          ))}
        </div>

        <form className="reservation-modal-form penalty-modal-form penalty-form-wizard" onSubmit={onSubmit}>
          {validationMessage ? (
            <p className="penalty-modal-warning">{validationMessage}</p>
          ) : (
            <p className="penalty-modal-ready">Paso {currentStep} de 4 - Completa la información requerida.</p>
          )}

          {/* PASO 1: RESPONSABLE */}
          {currentStep === 1 && (
            <section className="penalty-form-section penalty-form-step">
              <div className="penalty-section-heading">
                <div>
                  <h4>Selecciona el Responsable</h4>
                  <p>Busca y selecciona al usuario que será penalizado. El sistema validará que sea un usuario activo.</p>
                </div>
              </div>

              <label className="penalty-field is-wide">
                <span>Buscar usuario registrado</span>
                <select
                  value={form.user_selection}
                  onChange={(event) => onChange('user_selection', event.target.value)}
                  required
                >
                  <option value="">Selecciona un usuario del sistema</option>
                  {userOptions.map((userOption) => (
                    <option key={userOption.value} value={userOption.value}>
                      {userOption.label}
                    </option>
                  ))}
                </select>
                <small>Incluye perfiles creados por Google, perfiles manuales y usuarios detectados en reservas previas.</small>
                <FieldError message={validationErrors.user_selection} />
              </label>

              {selectedUser ? (
                <div className="penalty-selected-user">
                  <div>
                    <strong>{selectedUser.user_name}</strong>
                    <span>{selectedUser.user_email || 'Sin correo registrado'}</span>
                  </div>
                  <span>{selectedUser.role || selectedUser.source || 'Usuario'}</span>
                </div>
              ) : null}

              <div className="penalty-form-grid">
                <label className="penalty-field">
                  <span>ID del usuario</span>
                  <input
                    type="text"
                    value={form.user_id}
                    onChange={(event) => onChange('user_id', event.target.value)}
                    placeholder="ID interno"
                    required
                    disabled
                  />
                </label>
                <label className="penalty-field">
                  <span>Nombre</span>
                  <input
                    type="text"
                    value={form.user_name}
                    onChange={(event) => onChange('user_name', event.target.value)}
                    placeholder="Nombre del usuario"
                    disabled
                  />
                </label>
                <label className="penalty-field">
                  <span>Correo Institucional</span>
                  <input
                    type="email"
                    value={form.user_email}
                    onChange={(event) => onChange('user_email', event.target.value)}
                    placeholder="usuario@ucb.edu.bo"
                    required
                    disabled
                  />
                </label>
              </div>
            </section>
          )}

          {/* PASO 2: INCIDENTE Y EVIDENCIA */}
          {currentStep === 2 && (
            <section className="penalty-form-section penalty-form-step">
              <div className="penalty-section-heading">
                <div>
                  <h4>Registra el Incidente</h4>
                  <p>Especifica dónde ocurrió el daño, cuándo, y qué tipo de daño fue.</p>
                </div>
              </div>

              {/* Mostrar historial de reservas del usuario */}
              {selectedUser && userReservations && userReservations.length > 0 && (
                <div className="penalty-user-history">
                  <h5>Historial de reservas del usuario</h5>
                  <div className="penalty-reservations-list">
                    {userReservations.slice(0, 5).map((reservation) => (
                      <div key={reservation.id} className="penalty-reservation-item">
                        <strong>{reservation.laboratory_name}</strong>
                        <div>
                          <span className="penalty-date-label">
                            {new Date(reservation.date).toLocaleDateString('es-BO')}
                          </span>
                          <span className="penalty-time-label">
                            {reservation.start_time} - {reservation.end_time}
                          </span>
                        </div>
                        <small>{reservation.status}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="penalty-form-grid">
                <label className="penalty-field">
                  <span>Laboratorio del incidente *</span>
                  <select
                    value={form.incident_laboratory_id}
                    onChange={(event) => onChange('incident_laboratory_id', event.target.value)}
                    required
                  >
                    <option value="">Selecciona laboratorio</option>
                    {labOptions.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={validationErrors.incident_laboratory_id} />
                </label>

                <label className="penalty-field">
                  <span>Fecha del incidente *</span>
                  <input
                    type="date"
                    value={form.incident_date}
                    onChange={(event) => onChange('incident_date', event.target.value)}
                    required
                  />
                </label>

                <label className="penalty-field">
                  <span>Inicio del bloque *</span>
                  <input
                    type="time"
                    value={form.incident_start_time}
                    onChange={(event) => onChange('incident_start_time', event.target.value)}
                    step="900"
                    required
                  />
                  <FieldError message={validationErrors.incident_time} />
                </label>

                <label className="penalty-field">
                  <span>Fin del bloque *</span>
                  <input
                    type="time"
                    value={form.incident_end_time}
                    onChange={(event) => onChange('incident_end_time', event.target.value)}
                    step="900"
                    required
                  />
                </label>

                <label className="penalty-field">
                  <span>Alcance del daño *</span>
                  <select
                    value={form.incident_scope}
                    onChange={(event) => onChange('incident_scope', event.target.value)}
                  >
                    <option value="asset">Daño a un equipo</option>
                    <option value="laboratory">Daño al laboratorio</option>
                  </select>
                </label>

                <label className="penalty-field">
                  <span>Tipo de evidencia *</span>
                  <select
                    value={form.evidence_type}
                    onChange={(event) => onChange('evidence_type', event.target.value)}
                  >
                    <option value="damage_report">Reporte de daño</option>
                    <option value="maintenance_report">Reporte de mantenimiento</option>
                  </select>
                </label>
              </div>

              {form.incident_scope === 'asset' && (
                <label className="penalty-field is-wide">
                  <span>Equipo afectado *</span>
                  <select
                    value={form.asset_id}
                    onChange={(event) => onChange('asset_id', event.target.value)}
                    disabled={!form.incident_laboratory_id}
                    required
                  >
                    <option value="">
                      {form.incident_laboratory_id ? 'Selecciona equipo del laboratorio' : 'Primero selecciona laboratorio'}
                    </option>
                    {assetOptions.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {getAssetLabel(asset)}
                      </option>
                    ))}
                  </select>
                  <FieldError message={validationErrors.asset_id} />
                </label>
              )}

              <label className="penalty-field is-wide">
                <span>Reporte técnico como evidencia *</span>
                <select
                  value={form.evidence_ticket_id}
                  onChange={(event) => onChange('evidence_ticket_id', event.target.value)}
                  disabled={!form.incident_laboratory_id}
                  required
                >
                  <option value="">
                    {form.incident_laboratory_id
                      ? 'Selecciona un reporte técnico existente'
                      : 'Primero selecciona laboratorio'}
                  </option>
                  {evidenceOptions.map((ticket) => {
                    const reportLabel = ticket.evidence_report_id || ticket.id
                    const assetLabel = ticket.asset_name || getAssetLabel(assetOptions.find((asset) => String(asset.id) === String(ticket.asset_id)))
                    return (
                      <option key={ticket.id} value={ticket.id}>
                        {`${reportLabel} - ${ticket.title}${assetLabel ? ` - ${assetLabel}` : ''}`}
                      </option>
                    )
                  })}
                </select>
                <small>
                  {evidenceOptions.length > 0
                    ? 'Solo aparecen tickets compatibles con la selección actual.'
                    : 'No hay tickets técnicos disponibles para este laboratorio.'}
                </small>
                <FieldError message={validationErrors.evidence_ticket_id} />
              </label>

              {selectedLab && (
                <div className="penalty-evidence-card">
                  <span>Laboratorio y bloque</span>
                  <strong>{selectedLab.name}</strong>
                  <small>
                    {form.incident_start_time && form.incident_end_time
                      ? `${form.incident_date} de ${form.incident_start_time} a ${form.incident_end_time}`
                      : 'Completa el bloque horario'}
                  </small>
                </div>
              )}
            </section>
          )}

          {/* PASO 3: VIGENCIA */}
          {currentStep === 3 && (
            <section className="penalty-form-section penalty-form-step">
              <div className="penalty-section-heading">
                <div>
                  <h4>Define la Vigencia</h4>
                  <p>Especifica por cuánto tiempo el usuario no podrá crear nuevas reservas.</p>
                </div>
              </div>

              <p className="penalty-duration-info">Selecciona una duración rápida o configura fechas personalizadas:</p>

              <div className="penalty-duration-pills" aria-label="Duraciones rápidas">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => onApplyDuration?.(preset.days)}
                    className={form.ends_at === preset.label ? 'active' : ''}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="penalty-form-grid">
                <label className="penalty-field">
                  <span>Inicio de la penalización *</span>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(event) => onChange('starts_at', event.target.value)}
                    required
                  />
                  <FieldError message={validationErrors.starts_at} />
                </label>
                <label className="penalty-field">
                  <span>Fin de la penalización *</span>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    min={form.starts_at}
                    onChange={(event) => onChange('ends_at', event.target.value)}
                    required
                  />
                  <FieldError message={validationErrors.ends_at} />
                </label>
              </div>

              {form.starts_at && form.ends_at && (
                <div className="penalty-evidence-card">
                  <span>Duración de penalización</span>
                  <strong>
                    {Math.ceil(
                      (new Date(form.ends_at).getTime() - new Date(form.starts_at).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}{' '}
                    días
                  </strong>
                  <small>
                    Desde {new Date(form.starts_at).toLocaleString('es-BO')} hasta{' '}
                    {new Date(form.ends_at).toLocaleString('es-BO')}
                  </small>
                </div>
              )}
            </section>
          )}

          {/* PASO 4: JUSTIFICACIÓN */}
          {currentStep === 4 && (
            <section className="penalty-form-section penalty-form-step">
              <div className="penalty-section-heading">
                <div>
                  <h4>Justificación y Notas</h4>
                  <p>Registra el motivo de la penalización para auditoría y notas internas adicionales si es necesario.</p>
                </div>
              </div>

              <label className="penalty-field is-wide">
                <span>Motivo de la suspensión *</span>
                <textarea
                  rows="5"
                  value={form.reason}
                  onChange={(event) => onChange('reason', event.target.value)}
                  placeholder="Describe detalladamente el daño, responsabilidades y duración de la sanción..."
                  required
                />
                <small>{String(form.reason || '').length}/500 caracteres</small>
                <FieldError message={validationErrors.reason} />
              </label>

              <label className="penalty-field is-wide">
                <span>Notas internas (opcional)</span>
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(event) => onChange('notes', event.target.value)}
                  placeholder="Observaciones adicionales para contexto..."
                  maxLength={500}
                />
                <small>{String(form.notes || '').length}/500 caracteres</small>
                <FieldError message={validationErrors.notes} />
              </label>

              {/* Resumen */}
              <div className="penalty-summary">
                <h5>Resumen de la penalización</h5>
                <div className="penalty-summary-item">
                  <strong>Usuario:</strong> {selectedUser?.user_name || form.user_name}
                </div>
                <div className="penalty-summary-item">
                  <strong>Laboratorio:</strong> {selectedLab?.name || form.incident_laboratory_id}
                </div>
                <div className="penalty-summary-item">
                  <strong>Período:</strong> {Math.ceil(
                    (new Date(form.ends_at).getTime() - new Date(form.starts_at).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  días
                </div>
              </div>
            </section>
          )}

          {/* Botones de navegación */}
          <div className="reservation-modal-actions penalty-modal-actions penalty-wizard-nav">
            <button
              type="button"
              className="reservation-modal-secondary"
              onClick={() => (currentStep === 1 ? onClose() : setCurrentStep(currentStep - 1))}
            >
              {currentStep === 1 ? 'Cancelar' : 'Atrás'}
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                className="reservation-modal-primary"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  (currentStep === 1 && !isStep1Complete) ||
                  (currentStep === 2 && !isStep2Complete) ||
                  (currentStep === 3 && !isStep3Complete)
                }
              >
                Siguiente
              </button>
            ) : (
              <button type="submit" className="reservation-modal-primary" disabled={submitDisabled || !isStep4Complete}>
                {isSubmitting ? 'Guardando...' : 'Guardar penalización'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}

export default PenaltyModal
