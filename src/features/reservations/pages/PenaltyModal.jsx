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
  onApplyDuration,
  onChange,
  onSubmit,
  onClose,
  isSubmitting = false,
}) {
  if (!isOpen) {
    return null
  }

  const submitDisabled = isSubmitting || Boolean(validationMessage)

  return (
    <div className="reservation-modal-backdrop penalty-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="reservation-modal penalty-modal" onClick={(event) => event.stopPropagation()}>
        <header className="reservation-modal-header penalty-modal-hero">
          <div>
            <p className="reservation-modal-kicker">Penalizacion por danos</p>
            <h3>Registrar suspension documentada</h3>
            <p>
              Selecciona al responsable, adjunta la evidencia operativa y define una vigencia clara para bloquear nuevas reservas.
            </p>
          </div>
          <button type="button" className="reservation-modal-close" onClick={onClose} aria-label="Cerrar modal">
            x
          </button>
        </header>

        <form className="reservation-modal-form penalty-modal-form" onSubmit={onSubmit}>
          {validationMessage ? (
            <p className="penalty-modal-warning">{validationMessage}</p>
          ) : (
            <p className="penalty-modal-ready">Formulario listo para registrar una penalizacion disciplinaria.</p>
          )}

          <section className="penalty-form-section">
            <div className="penalty-section-heading">
              <span>1</span>
              <div>
                <h4>Responsable</h4>
                <p>Selecciona un perfil real del sistema. El registro se validara contra los usuarios activos antes de guardar.</p>
              </div>
            </div>

            <label className="penalty-field is-wide">
              <span>Buscar usuario registrado</span>
              <select
                value={form.user_selection}
                onChange={(event) => onChange('user_selection', event.target.value)}
              >
                <option value="">Selecciona un usuario del sistema</option>
                {userOptions.map((userOption) => (
                  <option key={userOption.value} value={userOption.value}>
                    {userOption.label}
                  </option>
                ))}
              </select>
              <small>Incluye perfiles creados por Google, perfiles manuales y usuarios detectados en reservas previas.</small>
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
                  placeholder="ID interno del usuario"
                  required
                />
                <FieldError message={validationErrors.user_id} />
              </label>
              <label className="penalty-field">
                <span>Nombre del usuario</span>
                <input
                  type="text"
                  value={form.user_name}
                  onChange={(event) => onChange('user_name', event.target.value)}
                  placeholder="Nombre visible para historial"
                />
              </label>
              <label className="penalty-field">
                <span>Correo del usuario</span>
                <input
                  type="email"
                  value={form.user_email}
                  onChange={(event) => onChange('user_email', event.target.value)}
                  placeholder="correo@ucb.edu.bo"
                  required
                />
                <FieldError message={validationErrors.user_email} />
              </label>
            </div>
          </section>

          <section className="penalty-form-section">
            <div className="penalty-section-heading">
              <span>2</span>
              <div>
                <h4>Incidente y evidencia</h4>
                <p>Registra el laboratorio, el bloque horario y si el dano afecto un equipo o el espacio fisico.</p>
              </div>
            </div>

            <div className="penalty-form-grid">
              <label className="penalty-field">
                <span>Laboratorio del incidente</span>
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
                <span>Fecha del incidente</span>
                <input
                  type="date"
                  value={form.incident_date}
                  onChange={(event) => onChange('incident_date', event.target.value)}
                  required
                />
              </label>
              <label className="penalty-field">
                <span>Alcance del dano</span>
                <select
                  value={form.incident_scope}
                  onChange={(event) => onChange('incident_scope', event.target.value)}
                >
                  <option value="asset">Dano a un equipo</option>
                  <option value="laboratory">Dano al laboratorio</option>
                </select>
              </label>
              <label className="penalty-field">
                <span>Inicio del bloque</span>
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
                <span>Fin del bloque</span>
                <input
                  type="time"
                  value={form.incident_end_time}
                  onChange={(event) => onChange('incident_end_time', event.target.value)}
                  step="900"
                  required
                />
              </label>
              <label className="penalty-field">
                <span>Tipo de evidencia</span>
                <select
                  value={form.evidence_type}
                  onChange={(event) => onChange('evidence_type', event.target.value)}
                >
                  <option value="damage_report">Reporte de dano</option>
                  <option value="maintenance_report">Reporte de mantenimiento</option>
                </select>
              </label>
              <label className="penalty-field">
                <span>Reporte tecnico vinculado</span>
                <select
                  value={form.evidence_ticket_id}
                  onChange={(event) => onChange('evidence_ticket_id', event.target.value)}
                  disabled={!form.incident_laboratory_id}
                >
                  <option value="">
                    {form.incident_laboratory_id
                      ? 'Selecciona un reporte tecnico existente'
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
                    ? 'Solo aparecen tickets reales compatibles con la seleccion actual.'
                    : 'No hay tickets tecnicos compatibles con el laboratorio, el equipo o el tipo de evidencia elegidos.'}
                </small>
                <FieldError message={validationErrors.evidence_ticket_id} />
              </label>
              <label className="penalty-field">
                <span>ID del reporte</span>
                <input
                  type="text"
                  value={form.evidence_report_id}
                  readOnly
                  placeholder="Se completa automaticamente"
                />
                <FieldError message={validationErrors.evidence_report_id} />
              </label>
            </div>

            {form.incident_scope === 'asset' ? (
              <label className="penalty-field">
                <span>Equipo afectado</span>
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
                <small>
                  {form.incident_laboratory_id && assetOptions.length === 0
                    ? 'No hay equipos registrados para este laboratorio. Puedes cambiar el alcance a dano al laboratorio.'
                    : 'El listado se filtra segun el laboratorio seleccionado.'}
                </small>
                <FieldError message={validationErrors.asset_id} />
              </label>
            ) : (
              <div className="penalty-evidence-card">
                <span>Alcance seleccionado</span>
                <strong>Dano al laboratorio</strong>
                <small>No se asociara un equipo especifico; el incidente quedara vinculado al espacio fisico.</small>
              </div>
            )}

            {selectedAsset ? (
              <div className="penalty-evidence-card">
                <span>Equipo seleccionado</span>
                <strong>{getAssetLabel(selectedAsset)}</strong>
                <small>{selectedAsset.status ? `Estado actual: ${selectedAsset.status}` : 'Sin estado adicional registrado'}</small>
              </div>
            ) : null}

            {selectedEvidence ? (
              <div className="penalty-evidence-card">
                <span>Reporte verificado</span>
                <strong>{selectedEvidence.evidence_report_id || selectedEvidence.id}</strong>
                <small>
                  {selectedEvidence.title}
                  {selectedEvidence.reported_at ? ` · Reportado ${String(selectedEvidence.reported_at).replace('T', ' ').slice(0, 16)}` : ''}
                </small>
              </div>
            ) : null}

            {selectedLab ? (
              <div className="penalty-evidence-card">
                <span>Laboratorio seleccionado</span>
                <strong>{selectedLab.name}</strong>
                <small>{form.incident_start_time && form.incident_end_time ? `Bloque del incidente: ${form.incident_start_time} - ${form.incident_end_time}` : 'Selecciona el bloque horario del incidente.'}</small>
              </div>
            ) : null}
          </section>

          <section className="penalty-form-section">
            <div className="penalty-section-heading">
              <span>3</span>
              <div>
                <h4>Vigencia</h4>
                <p>Define el periodo exacto durante el cual el usuario no podra crear nuevas reservas.</p>
              </div>
            </div>

            <div className="penalty-duration-pills" aria-label="Duraciones rapidas">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => onApplyDuration?.(preset.days)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="penalty-form-grid">
              <label className="penalty-field">
                <span>Inicio de la penalizacion</span>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => onChange('starts_at', event.target.value)}
                  required
                />
                <FieldError message={validationErrors.starts_at} />
              </label>
              <label className="penalty-field">
                <span>Fin de la penalizacion</span>
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
          </section>

          <section className="penalty-form-section">
            <div className="penalty-section-heading">
              <span>4</span>
              <div>
                <h4>Justificacion</h4>
                <p>Deja un motivo claro para auditoria y una nota interna si el caso necesita contexto adicional.</p>
              </div>
            </div>

            <label className="penalty-field">
              <span>Motivo de la suspension</span>
              <textarea
                rows="4"
                value={form.reason}
                onChange={(event) => onChange('reason', event.target.value)}
                placeholder="Describe el dano, la responsabilidad y la duracion del castigo."
                required
              />
              <FieldError message={validationErrors.reason} />
            </label>

            <label className="penalty-field">
              <span>Notas internas</span>
              <textarea
                rows="3"
                value={form.notes}
                onChange={(event) => onChange('notes', event.target.value)}
                placeholder="Observaciones adicionales para el encargado."
                maxLength={500}
              />
              <small>{String(form.notes || '').length}/500 caracteres</small>
              <FieldError message={validationErrors.notes} />
            </label>
          </section>

          <div className="reservation-modal-actions penalty-modal-actions">
            <button type="button" className="reservation-modal-secondary" onClick={onClose}>
              Cerrar
            </button>
            <button type="submit" className="reservation-modal-primary" disabled={submitDisabled}>
              {isSubmitting ? 'Guardando...' : 'Guardar penalizacion'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default PenaltyModal
