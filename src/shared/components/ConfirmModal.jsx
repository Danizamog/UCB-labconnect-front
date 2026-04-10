import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmModal.css'

function ConfirmModal({ title = 'Confirmar accion', message, onConfirm, onCancel, confirmLabel = 'Eliminar' }) {
  useEffect(() => {
    document.body.classList.add('confirm-modal-open')
    return () => {
      document.body.classList.remove('confirm-modal-open')
    }
  }, [])

  return createPortal(
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
    </div>,
    document.body,
  )
}

export default ConfirmModal
