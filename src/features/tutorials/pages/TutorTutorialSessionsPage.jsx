import { useEffect, useMemo, useState } from 'react'
import {
  createTutorialSession,
  deleteTutorialSession,
  listMyTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../services/tutorialSessionsService'
import './TutorialPages.css'

const defaultForm = {
  topic: '',
  description: '',
  location: '',
  session_date: new Date().toISOString().slice(0, 10),
  start_time: '10:00',
  end_time: '11:00',
  max_students: 8,
}

function TutorTutorialSessionsPage() {
  const [form, setForm] = useState(defaultForm)
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const loadSessions = async () => {
    try {
      const data = await listMyTutorialSessions()
      setSessions(data)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar tus tutorias.')
    }
  }

  useEffect(() => {
    loadSessions()

    const unsubscribe = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic === 'tutorial_session') {
        loadSessions()
      }
    })

    return () => unsubscribe?.()
  }, [])

  const totalSeats = useMemo(
    () => sessions.reduce((sum, session) => sum + session.max_students, 0),
    [sessions],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      await createTutorialSession(form)
      setMessage('Tutoria publicada correctamente. Ya esta visible para los estudiantes.')
      setForm((previous) => ({ ...defaultForm, session_date: previous.session_date }))
      await loadSessions()
    } catch (err) {
      setError(err.message || 'No se pudo publicar la tutoria.')
    }
  }

  const handleDelete = async (session) => {
    setDeletingId(session.id)
    setError('')
    setMessage('')

    try {
      await deleteTutorialSession(session.id)
      setMessage(
        session.enrolled_count > 0
          ? 'Tutoria eliminada. Las inscripciones se cancelaron y los estudiantes fueron notificados.'
          : 'Bloque de tutoria eliminado correctamente.',
      )
      await loadSessions()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la tutoria.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="tutorials-page" aria-label="Gestion de tutorias">
      <header className="tutorials-header">
        <div>
          <p className="tutorials-kicker">Soporte academico</p>
          <h2>Publicar horarios de tutorias</h2>
          <p>Configura bloques con dias, horas y cupos. El sistema evita conflictos con tus propias reservas de laboratorio.</p>
        </div>
        <div className="tutorials-summary">
          <div><span>Sesiones</span><strong>{sessions.length}</strong></div>
          <div><span>Cupos</span><strong>{totalSeats}</strong></div>
        </div>
      </header>

      {message ? <p className="tutorials-message success">{message}</p> : null}
      {error ? <p className="tutorials-message error">{error}</p> : null}

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Nuevo bloque</h3>
          <p className="tutorials-panel-subtitle">
            Publica una sesion visible de inmediato para estudiantes y auxiliares.
          </p>
        </div>

        <form className="tutorials-form" onSubmit={handleSubmit}>
          <div className="tutorials-form-grid">
            <label>
              <span>Tema</span>
              <input
                type="text"
                value={form.topic}
                onChange={(event) => setForm((previous) => ({ ...previous, topic: event.target.value }))}
                placeholder="Ej. Refuerzo de algoritmos"
                required
              />
            </label>
            <label>
              <span>Ubicacion</span>
              <input
                type="text"
                value={form.location}
                onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
                placeholder="Lab 2 - Sistemas"
              />
            </label>
            <label>
              <span>Fecha</span>
              <input
                type="date"
                value={form.session_date}
                onChange={(event) => setForm((previous) => ({ ...previous, session_date: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Hora de inicio</span>
              <input
                type="time"
                value={form.start_time}
                onChange={(event) => setForm((previous) => ({ ...previous, start_time: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Hora de fin</span>
              <input
                type="time"
                value={form.end_time}
                onChange={(event) => setForm((previous) => ({ ...previous, end_time: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Cupo maximo</span>
              <input
                type="number"
                min="1"
                max="100"
                value={form.max_students}
                onChange={(event) => setForm((previous) => ({ ...previous, max_students: event.target.value }))}
                required
              />
            </label>
          </div>

          <label>
            <span>Descripcion</span>
            <textarea
              rows="4"
              value={form.description}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
              placeholder="Explica para que temas o estudiantes esta orientada la tutoria."
            />
          </label>

          <div className="tutorials-actions">
            <button type="submit" className="tutorials-primary">Publicar tutoria</button>
          </div>
        </form>
      </section>

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Mis tutorias publicadas</h3>
          <p className="tutorials-panel-subtitle">
            Si eliminas una sesion con inscritos, el sistema cancela las inscripciones y notifica a los estudiantes afectados.
          </p>
        </div>

        {sessions.length === 0 ? (
          <p className="tutorials-empty">Todavia no publicaste tutorias.</p>
        ) : (
          <div className="tutorials-grid">
            {sessions.map((session) => (
              <article key={session.id} className="tutorial-card tutor-card">
                <div className="tutorial-card-head">
                  <div>
                    <span className="tutorial-badge">Publicada</span>
                    <h4>{session.topic}</h4>
                  </div>
                  <strong className="tutorial-seats">{session.enrolled_count}/{session.max_students}</strong>
                </div>

                <p className="tutorial-copy">{session.description || 'Sin descripcion adicional.'}</p>

                <div className="tutorial-meta">
                  <span>{session.session_date}</span>
                  <span>{session.start_time} - {session.end_time}</span>
                  <span>{session.location || 'Ubicacion por definir'}</span>
                </div>

                <div className="tutorial-enrolled-list">
                  <strong>Inscritos</strong>
                  {session.enrolled_students.length === 0 ? (
                    <p>Aun no hay estudiantes registrados.</p>
                  ) : (
                    session.enrolled_students.map((student) => (
                      <span key={`${session.id}-${student.student_id}`}>{student.student_name}</span>
                    ))
                  )}
                </div>

                <div className="tutorials-actions">
                  <button
                    type="button"
                    className="tutorials-danger"
                    disabled={deletingId === session.id}
                    onClick={() => handleDelete(session)}
                  >
                    {deletingId === session.id ? 'Eliminando...' : 'Eliminar bloque'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default TutorTutorialSessionsPage
