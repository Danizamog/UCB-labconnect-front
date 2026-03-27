import './ConfirmModal.css'

function ConfirmModal({ title = 'Confirmar accion', message, onConfirm, onCancel, confirmLabel = 'Eliminar' }) {
  return (
    <div className="confirm-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon" aria-hidden="true">!</div>
        <h3 className="confirm-title">{title}</h3>
        {message ? <p className="confirm-message">{message}</p> : null}
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="confirm-ok" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
