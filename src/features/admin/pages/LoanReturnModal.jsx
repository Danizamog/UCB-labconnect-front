import './LoanReturnModal.css'

function LoanReturnModal({ loan, onCancel, onSubmit, submitting = false }) {
  if (!loan) {
    return null
  }

  return (
    <div className="loan-return-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="loan-return-modal" onClick={(event) => event.stopPropagation()}>
        <div className="loan-return-head">
          <div>
            <p className="loan-return-kicker">Registrar devolucion</p>
            <h3>{loan.asset_name}</h3>
            <p>
              {loan.borrower_name || loan.borrower_id}
              {loan.asset_serial_number ? ` · Serie ${loan.asset_serial_number}` : ''}
            </p>
          </div>
          <button type="button" className="loan-return-close" onClick={onCancel} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form className="loan-return-form" onSubmit={onSubmit}>
          <label>
            <span>Estado de devolucion</span>
            <select name="return_condition" defaultValue="ok" disabled={submitting}>
              <option value="ok">Devuelto sin daños</option>
              <option value="damaged">Devuelto con daños</option>
            </select>
          </label>

          <label>
            <span>Observaciones de cierre</span>
            <textarea
              name="return_notes"
              rows="3"
              placeholder="Ej. Se verifico funcionamiento general, cargador completo."
              disabled={submitting}
            />
          </label>

          <label>
            <span>Descripcion del problema si hubo daños</span>
            <textarea
              name="incident_notes"
              rows="4"
              placeholder="Obligatorio si marcas la opcion Devuelto con daños."
              disabled={submitting}
            />
          </label>

          <div className="loan-return-actions">
            <button type="button" className="loan-return-secondary" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="loan-return-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Confirmar devolucion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoanReturnModal
