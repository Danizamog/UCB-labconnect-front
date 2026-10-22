import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './WorkflowDialog.css'

export default function WorkflowDialog({ title, description, eyebrow, icon: Icon, children, footer, onClose, busy = false, wide = false }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return createPortal(<dialog ref={dialogRef} className={`workflow-dialog${wide ? ' workflow-dialog--wide' : ''}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    onClick={(event) => {
      if (event.target !== dialogRef.current || busy) return
      const bounds = dialogRef.current.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}>
    <div className="workflow-dialog-shell">
      <header className="workflow-dialog-header">
        {Icon ? <span className="workflow-dialog-icon"><Icon size={23} strokeWidth={1.8} /></span> : null}
        <div className="workflow-dialog-heading">{eyebrow ? <span className="workflow-dialog-eyebrow">{eyebrow}</span> : null}<h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div>
        <button type="button" className="workflow-dialog-close" onClick={onClose} disabled={busy} aria-label="Cerrar ventana"><X size={20} /></button>
      </header>
      <div className="workflow-dialog-body">{children}</div>
      {footer ? <footer className="workflow-dialog-footer">{footer}</footer> : null}
    </div>
  </dialog>, document.body)
}
