import { AlertTriangle } from 'lucide-react'
import WorkflowDialog from './WorkflowDialog'
import './ConfirmModal.css'

function ConfirmModal({ title = 'Confirmar accion', message, onConfirm, onCancel, confirmLabel = 'Eliminar' }) {
  return <WorkflowDialog title={title} eyebrow="Confirmar acción" icon={AlertTriangle} onClose={onCancel} footer={<>
          <button type="button" className="confirm-cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="confirm-ok" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>}><p className="workflow-confirm-message">{message}</p></WorkflowDialog>
}

export default ConfirmModal
