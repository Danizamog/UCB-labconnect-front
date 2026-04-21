function TutorialSessionDetailModal({
  session,
  onClose,
  title = 'Detalle de tutoria',
  primaryActionLabel = '',
  onPrimaryAction = null,
  primaryActionDisabled = false,
  primaryActionHint = '',
}) {
  if (!session) {
    return null
  }

  return (
    <div className="tutorial-detail-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="tutorial-detail-modal" onClick={(event) => event.stopPropagation()}>
        <header className="tutorial-detail-header">
          <div className="tutorial-detail-hero">
            <div className="tutorial-detail-hero-copy">
              <p className="tutorial-detail-kicker">{title}</p>
              <h3>{session.topic}</h3>
              <p>{session.description || 'Sesion academica abierta para reforzar contenidos y resolver dudas puntuales.'}</p>
            </div>
            <div className="tutorial-detail-hero-badges">
              <span className="tutorial-detail-badge">{session.location || 'Laboratorio por definir'}</span>
              <span className="tutorial-detail-badge subtle">{session.start_time} - {session.end_time}</span>
            </div>
          </div>
          <button type="button" className="tutorial-detail-close" onClick={onClose} aria-label="Cerrar detalle">
            x
          </button>
        </header>

        <div className="tutorial-detail-grid">
          <div className="tutorial-detail-card">
            <span>Tutor</span>
            <strong>{session.tutor_name || 'Tutor'}</strong>
          </div>
          <div className="tutorial-detail-card">
            <span>Laboratorio</span>
            <strong>{session.location || 'Por definir'}</strong>
          </div>
          <div className="tutorial-detail-card">
            <span>Fecha</span>
            <strong>{session.session_date}</strong>
          </div>
          <div className="tutorial-detail-card">
            <span>Horario</span>
            <strong>{session.start_time} - {session.end_time}</strong>
          </div>
          <div className="tutorial-detail-card emphasis">
            <span>Cupos</span>
            <strong>{session.enrolled_count} / {session.max_students}</strong>
          </div>
          <div className="tutorial-detail-card emphasis">
            <span>Disponibles</span>
            <strong>{session.seats_left}</strong>
          </div>
        </div>

        <div className="tutorial-detail-story">
          <div className="tutorial-detail-story-card">
            <span>Descripcion</span>
            <p>{session.description || 'El tutor todavia no agrego una descripcion extendida para esta sesion.'}</p>
          </div>
          <div className="tutorial-detail-story-card">
            <span>Recomendacion</span>
            <p>Llega con tus dudas, materiales o ejercicios preparados para aprovechar mejor el tiempo de apoyo academico.</p>
          </div>
        </div>

        {Array.isArray(session.enrolled_students) && session.enrolled_students.length > 0 ? (
          <div className="tutorial-detail-enrolled">
            <strong>Inscritos</strong>
            <div className="tutorial-detail-enrolled-list">
              {session.enrolled_students.map((student) => (
                <span key={`${session.id}-${student.student_id}`}>{student.student_name}</span>
              ))}
            </div>
          </div>
        ) : null}

        {primaryActionHint ? (
          <p className="tutorial-detail-hint">{primaryActionHint}</p>
        ) : null}

        <div className="tutorial-detail-actions">
          {primaryActionLabel && typeof onPrimaryAction === 'function' ? (
            <button
              type="button"
              className="tutorials-primary tutorial-detail-primary"
              disabled={primaryActionDisabled}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </button>
          ) : null}
          <button type="button" className="tutorials-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  )
}

export default TutorialSessionDetailModal
