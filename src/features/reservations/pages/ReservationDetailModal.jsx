import './ReservationEditModal.css'

function ReservationDetailModal({
  reservation,
  actionState,
  isLoading = false,
  laboratoryName = 'Laboratorio',
  onClose,
  onEdit,
  onCancel,
}) {
  const statusLabel = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
    in_progress: 'En curso',
    completed: 'Completada',
    absent: 'Ausente',
  }

  if (!reservation && !isLoading) {
    return null
  }

  return (
    <div className="reservation-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="reservation-modal" onClick={(event) => event.stopPropagation()}>
        <header className="reservation-modal-header">
          <div>
            <p className="reservation-modal-kicker">Detalle de reserva</p>
            <h3>Informacion completa de tu solicitud</h3>
            <p>
              Revisa el estado actual de la reserva y, si todavia aplica, modifica o cancela desde aqui.
            </p>
          </div>
          <button type="button" className="reservation-modal-close" onClick={onClose} aria-label="Cerrar modal">
            x
          </button>
        </header>

        {isLoading ? (
          <p className="reservations-empty">Cargando detalle actualizado...</p>
        ) : reservation ? (
          <>
            <div className="reservation-focus-grid">
              <div className="reservation-focus-card">
                <span>Laboratorio</span>
                <strong>{laboratoryName}</strong>
              </div>
              <div className="reservation-focus-card">
                <span>Fecha</span>
                <strong>{reservation.date}</strong>
              </div>
              <div className="reservation-focus-card">
                <span>Horario</span>
                <strong>{reservation.start_time} - {reservation.end_time}</strong>
              </div>
              <div className="reservation-focus-card">
                <span>Estado</span>
                <strong className={`reservation-focus-status ${reservation.status}`}>
                  {statusLabel[reservation.status] || reservation.status}
                </strong>
              </div>
            </div>

            <div className="reservation-focus-copy">
              <p><strong>Motivo:</strong> {reservation.purpose || 'Sin motivo registrado'}</p>
              {reservation.notes ? <p><strong>Notas:</strong> {reservation.notes}</p> : null}
              {reservation.cancel_reason ? <p><strong>Motivo de rechazo:</strong> {reservation.cancel_reason}</p> : null}
            </div>

            {actionState?.hasStarted ? (
              <p className="reservation-inline-hint">
                Esta reserva ya transcurrio. Las acciones de modificar y cancelar ya no estan disponibles.
              </p>
            ) : null}

            {!actionState?.hasStarted && actionState?.withinTwoHours ? (
              <p className="reservation-inline-hint">
                Faltan menos de 2 horas para el inicio, por eso la opcion de modificar esta bloqueada.
              </p>
            ) : null}

            <div className="reservations-actions">
              {actionState?.canModify ? (
                <button type="button" className="reservations-secondary" onClick={onEdit}>
                  Modificar reserva
                </button>
              ) : null}
              {actionState?.canCancel ? (
                <button type="button" className="reservations-danger" onClick={onCancel}>
                  Cancelar reserva
                </button>
              ) : null}
              <button type="button" className="reservations-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <p className="reservations-empty">No se pudo cargar el detalle de esta reserva.</p>
        )}
      </section>
    </div>
  )
}

export default ReservationDetailModal
