import './PenaltyModal.css'

function PenaltyModal({
  isOpen = false,
  form,
  userOptions = [],
  assetOptions = [],
  onChange,
  onSubmit,
  onClose,
  isSubmitting = false,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="reservation-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="reservation-modal penalty-modal" onClick={(event) => event.stopPropagation()}>
        <header className="reservation-modal-header">
          <div>
            <p className="reservation-modal-kicker">Penalizacion por danos</p>
            <h3>Registrar o documentar una suspension</h3>
            <p>
              Vincula al usuario responsable, el reporte de evidencia y la duracion del bloqueo para impedir nuevas reservas.
            </p>
          </div>
          <button type="button" className="reservation-modal-close" onClick={onClose} aria-label="Cerrar modal">
            x
          </button>
        </header>

        <form className="reservation-modal-form" onSubmit={onSubmit}>
          <div className="reservation-modal-grid">
            <label>
              <span>Usuario desde reservas previas</span>
              <select
                value={form.user_selection}
                onChange={(event) => onChange('user_selection', event.target.value)}
              >
                <option value="">Selecciona un usuario conocido</option>
                {userOptions.map((userOption) => (
                  <option key={userOption.value} value={userOption.value}>
                    {userOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>ID del usuario</span>
              <input
                type="text"
                value={form.user_id}
                onChange={(event) => onChange('user_id', event.target.value)}
                placeholder="ID interno del usuario"
                required
              />
            </label>
            <label>
              <span>Nombre del usuario</span>
              <input
                type="text"
                value={form.user_name}
                onChange={(event) => onChange('user_name', event.target.value)}
                placeholder="Nombre visible para historial"
              />
            </label>
            <label>
              <span>Correo del usuario</span>
              <input
                type="email"
                value={form.user_email}
                onChange={(event) => onChange('user_email', event.target.value)}
                placeholder="correo@ucb.edu.bo"
                required
              />
            </label>
            <label>
              <span>Tipo de evidencia</span>
              <select
                value={form.evidence_type}
                onChange={(event) => onChange('evidence_type', event.target.value)}
              >
                <option value="damage_report">Reporte de dano</option>
                <option value="maintenance_report">Reporte de mantenimiento</option>
              </select>
            </label>
            <label>
              <span>ID del reporte</span>
              <input
                type="text"
                value={form.evidence_report_id}
                onChange={(event) => onChange('evidence_report_id', event.target.value)}
                placeholder="Ej. REP-1042"
              />
            </label>
            <label>
              <span>Equipo afectado</span>
              <select
                value={form.asset_id}
                onChange={(event) => onChange('asset_id', event.target.value)}
              >
                <option value="">Sin equipo especifico</option>
                {assetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name || asset.code || asset.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Inicio de la penalizacion</span>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(event) => onChange('starts_at', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Fin de la penalizacion</span>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(event) => onChange('ends_at', event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            <span>Motivo de la suspension</span>
            <textarea
              rows="4"
              value={form.reason}
              onChange={(event) => onChange('reason', event.target.value)}
              placeholder="Describe el dano, la responsabilidad y la duracion del castigo."
              required
            />
          </label>

          <label>
            <span>Notas internas</span>
            <textarea
              rows="3"
              value={form.notes}
              onChange={(event) => onChange('notes', event.target.value)}
              placeholder="Observaciones adicionales para el encargado."
            />
          </label>

          <div className="reservation-modal-actions">
            <button type="button" className="reservation-modal-secondary" onClick={onClose}>
              Cerrar
            </button>
            <button type="submit" className="reservation-modal-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar penalizacion'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default PenaltyModal
