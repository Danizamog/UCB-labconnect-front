import { jsPDF } from 'jspdf'

function formatDisplayDate(dateValue) {
  if (!dateValue) {
    return 'Fecha no disponible'
  }

  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatEnrollmentDate(dateValue) {
  if (!dateValue) {
    return 'Fecha no disponible'
  }

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return 'ES'
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

function sanitizeFileName(value) {
  return String(value || 'tutoria-inscritos')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'tutoria-inscritos'
}

function downloadTextFile(content, fileName, type) {
  const blob = new Blob([content], { type })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function toCsvValue(value) {
  const normalized = String(value ?? '').replace(/"/g, '""')
  return `"${normalized}"`
}

function buildSessionFileBaseName(session) {
  return sanitizeFileName(`${session?.topic || 'tutoria'}-${session?.session_date || 'sin-fecha'}-inscritos`)
}

function exportStudentsToCsv(session, students) {
  const rows = [
    ['Tema', session.topic || ''],
    ['Tutor', session.tutor_name || ''],
    ['Laboratorio', session.location || ''],
    ['Fecha', session.session_date || ''],
    ['Horario', `${session.start_time || ''} - ${session.end_time || ''}`.trim()],
    ['Inscritos', String(students.length)],
    [],
    ['Nombre', 'Correo', 'Fecha de inscripcion'],
    ...students.map((student) => [
      student.student_name || 'Estudiante',
      student.student_email || 'Sin correo visible',
      formatEnrollmentDate(student.created_at),
    ]),
  ]

  const content = `\uFEFF${rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n')}`
  downloadTextFile(content, `${buildSessionFileBaseName(session)}.csv`, 'text/csv;charset=utf-8;')
}

function exportStudentsToPdf(session, students) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 40
  let cursorY = 54

  const ensureSpace = (requiredHeight = 24) => {
    if (cursorY + requiredHeight <= pageHeight - margin) {
      return
    }
    pdf.addPage()
    cursorY = margin
  }

  pdf.setFillColor(10, 53, 89)
  pdf.roundedRect(margin, 32, pageWidth - margin * 2, 96, 18, 18, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Listado de estudiantes inscritos', margin + 18, cursorY)
  cursorY += 24
  pdf.setFontSize(15)
  pdf.text(String(session.topic || 'Tutoria'), margin + 18, cursorY)
  cursorY += 18
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`Tutor: ${session.tutor_name || 'Tutor'}   Laboratorio: ${session.location || 'Por definir'}`, margin + 18, cursorY)
  cursorY += 14
  pdf.text(`Fecha: ${formatDisplayDate(session.session_date)}   Horario: ${session.start_time || ''} - ${session.end_time || ''}`, margin + 18, cursorY)
  cursorY = 150

  pdf.setTextColor(41, 55, 79)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(`Total inscritos: ${students.length}`, margin, cursorY)
  cursorY += 18

  if (students.length === 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.text('Todavia no hay estudiantes inscritos en esta tutoria.', margin, cursorY)
  } else {
    students.forEach((student, index) => {
      ensureSpace(78)

      pdf.setDrawColor(221, 229, 238)
      pdf.setFillColor(248, 250, 252)
      pdf.roundedRect(margin, cursorY, pageWidth - margin * 2, 62, 12, 12, 'FD')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(15, 23, 42)
      pdf.text(`${index + 1}. ${student.student_name || 'Estudiante'}`, margin + 14, cursorY + 20)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(71, 85, 105)
      pdf.text(`Correo: ${student.student_email || 'Sin correo visible'}`, margin + 14, cursorY + 38)
      pdf.text(`Inscripcion: ${formatEnrollmentDate(student.created_at)}`, margin + 14, cursorY + 54)

      cursorY += 74
    })
  }

  pdf.save(`${buildSessionFileBaseName(session)}.pdf`)
}

function TutorialSessionDetailModal({
  session,
  onClose,
  title = 'Detalle de tutoria',
  primaryActionLabel = '',
  onPrimaryAction = null,
  primaryActionDisabled = false,
  primaryActionHint = '',
  enrolledSectionTitle = 'Inscritos',
  allowStudentExports = false,
}) {
  if (!session) {
    return null
  }

  const enrolledStudents = Array.isArray(session.enrolled_students) ? session.enrolled_students : []
  const occupancyPercentage = session.max_students > 0
    ? Math.min((session.enrolled_count / session.max_students) * 100, 100)
    : 0

  const handleExportCsv = () => {
    exportStudentsToCsv(session, enrolledStudents)
  }

  const handleExportPdf = () => {
    exportStudentsToPdf(session, enrolledStudents)
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
              <div className="tutorial-detail-hero-tags">
                <span className="tutorial-detail-tag">Tutor: {session.tutor_name || 'Tutor'}</span>
                <span className="tutorial-detail-tag muted">{enrolledStudents.length > 0 ? 'Con estudiantes inscritos' : 'Aun sin inscritos'}</span>
              </div>
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
            <strong>{formatDisplayDate(session.session_date)}</strong>
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

        <section className="tutorial-detail-capacity-panel" aria-label="Estado de cupos">
          <div className="tutorial-detail-capacity-copy">
            <span>Ocupacion actual</span>
            <strong>{session.enrolled_count} de {session.max_students} cupos tomados</strong>
          </div>
          <div className="tutorial-detail-capacity-bar" aria-hidden="true">
            <span style={{ width: `${occupancyPercentage}%` }} />
          </div>
        </section>

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

        {enrolledStudents.length > 0 ? (
          <div className="tutorial-detail-enrolled">
            <div className="tutorial-detail-enrolled-header">
              <div className="tutorial-detail-enrolled-header-copy">
                <strong>{enrolledSectionTitle}</strong>
                <span>{enrolledStudents.length} registrado(s)</span>
              </div>
              {allowStudentExports ? (
                <div className="tutorial-detail-export-actions">
                  <button type="button" className="tutorials-secondary tutorial-detail-export-button" onClick={handleExportCsv}>
                    Descargar CSV
                  </button>
                  <button type="button" className="tutorials-primary tutorial-detail-export-button" onClick={handleExportPdf}>
                    Descargar PDF
                  </button>
                </div>
              ) : null}
            </div>
            <div className="tutorial-detail-enrolled-list detailed">
              {enrolledStudents.map((student) => (
                <article key={`${session.id}-${student.student_id}`} className="tutorial-detail-enrolled-card">
                  <div className="tutorial-detail-student-head">
                    <span className="tutorial-detail-student-avatar">{getInitials(student.student_name)}</span>
                    <div>
                      <strong>{student.student_name}</strong>
                      <small>{student.student_email || 'Sin correo visible'}</small>
                    </div>
                  </div>
                  <div className="tutorial-detail-student-meta">
                    <span className="tutorial-detail-student-chip">Inscrito: {formatEnrollmentDate(student.created_at)}</span>
                    <span className="tutorial-detail-student-chip subtle">Asistencia prevista</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="tutorial-detail-enrolled empty">
            <div className="tutorial-detail-enrolled-header">
              <div className="tutorial-detail-enrolled-header-copy">
                <strong>{enrolledSectionTitle}</strong>
                <span>0 registrado(s)</span>
              </div>
            </div>
            <p className="tutorial-detail-empty-copy">Todavia no hay estudiantes inscritos en esta tutoria.</p>
          </div>
        )}

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
