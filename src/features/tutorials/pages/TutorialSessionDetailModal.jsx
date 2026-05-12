function TutorialSessionDetailModal({
  session,
  onClose,
  title = 'Detalle de tutoria',
  primaryActionLabel = '',
  onPrimaryAction = null,
  primaryActionDisabled = false,
  primaryActionHint = '',
  showEnrollmentDetails = false,
  enrollmentDownloadActions = null,
  observationDraft = '',
  onObservationDraftChange = null,
  onSaveObservation = null,
  isSavingObservation = false,
  observationHint = '',
}) {
  if (!session) {
    return null
  }

  const formatDate = (value) => {
    const date = new Date(value || '')
    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return new Intl.DateTimeFormat('es-BO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }

  const formatTime = (value) => {
    const date = new Date(value || '')
    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return new Intl.DateTimeFormat('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  }

  const enrolledStudents = Array.isArray(session.enrolled_students) ? session.enrolled_students : []

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
            {typeof onObservationDraftChange === 'function' ? (
              <div className="tutorial-detail-observation">
                <div className="tutorial-detail-observation-head">
                  <strong>Observacion del tutor</strong>
                  <span>Breve registro de avance o dificultades vistas en la sesion.</span>
                </div>
                <textarea
                  rows="4"
                  maxLength={1000}
                  value={observationDraft}
                  onChange={(event) => onObservationDraftChange(event.target.value)}
                  placeholder="Ej. El estudiante comprendio los ejercicios base, pero aun necesita refuerzo en recursion."
                />
                <div className="tutorial-detail-observation-actions">
                  {observationHint ? <p className="tutorial-detail-hint">{observationHint}</p> : null}
                  {typeof onSaveObservation === 'function' ? (
                    <button
                      type="button"
                      className="tutorials-primary tutorial-detail-primary"
                      disabled={isSavingObservation}
                      onClick={onSaveObservation}
                    >
                      {isSavingObservation ? 'Guardando observacion...' : 'Guardar observacion'}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : session.tutor_observation ? (
              <div className="tutorial-detail-observation is-readonly">
                <div className="tutorial-detail-observation-head">
                  <strong>Observacion del tutor</strong>
                </div>
                <p>{session.tutor_observation}</p>
              </div>
            ) : null}
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

        {showEnrollmentDetails ? (
          <div className="tutorial-detail-enrolled">
            <strong>Inscritos</strong>

            {enrolledStudents.length === 0 ? (
              <p className="tutorial-detail-enrolled-empty">Aun no hay estudiantes inscritos en esta tutoria.</p>
            ) : (
              <div className="tutorial-detail-enrolled-table-wrap">
                <table className="tutorial-detail-enrolled-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Estudiante</th>
                      <th>Correo</th>
                      <th>Fecha de inscripcion</th>
                      <th>Hora de inscripcion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolledStudents.map((student, index) => (
                      <tr key={`${session.id}-${student.student_id || index}`}>
                        <td>{index + 1}</td>
                        <td>{student.student_name || 'Estudiante'}</td>
                        <td>{student.student_email || '-'}</td>
                        <td>{formatDate(student.created_at)}</td>
                        <td>{formatTime(student.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          Array.isArray(session.enrolled_students) && session.enrolled_students.length > 0 ? (
            <div className="tutorial-detail-enrolled">
              <strong>Inscritos</strong>
              <div className="tutorial-detail-enrolled-list">
                {session.enrolled_students.map((student) => (
                  <span key={`${session.id}-${student.student_id}`}>{student.student_name}</span>
                ))}
              </div>
            </div>
          ) : null
        )}

        {primaryActionHint ? (
          <p className="tutorial-detail-hint">{primaryActionHint}</p>
        ) : null}

        <div className="tutorial-detail-actions">
          {showEnrollmentDetails && enrollmentDownloadActions?.onDownloadPdf ? (
            <button
              type="button"
              className="tutorials-secondary"
              onClick={enrollmentDownloadActions.onDownloadPdf}
            >
              Descargar PDF
            </button>
          ) : null}
          {showEnrollmentDetails && enrollmentDownloadActions?.onDownloadCsv ? (
            <button
              type="button"
              className="tutorials-secondary"
              onClick={enrollmentDownloadActions.onDownloadCsv}
            >
              Descargar CSV
            </button>
          ) : null}
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
