import { useEffect, useMemo, useState } from 'react'
import {
  createClassTutorial,
  deleteClassTutorial,
  listClassTutorials,
  updateClassTutorial,
} from '../services/classTutorialService'
import { listAdminAreas, listAdminLabs } from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminClassTutorialsPage.css'

const defaultForm = {
  laboratory_id: '',
  session_type: 'class',
  date: '',
  start_time: '',
  end_time: '',
  title: '',
  facilitator_name: '',
  target_group: '',
  academic_unit: '',
  needs_support: false,
  support_topic: '',
  notes: '',
}

const defaultFilters = {
  areaId: '',
  laboratoryId: '',
  date: '',
  sessionType: '',
}

const sessionTypeLabels = {
  class: 'Clase',
  tutorial: 'Tutoria',
  guest: 'Invitado',
}

function AdminClassTutorialsPage({ user }) {
  const [areas, setAreas] = useState([])
  const [labs, setLabs] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [filters, setFilters] = useState(defaultFilters)

  const canManageTutorials = hasAnyPermission(user, ['gestionar_tutorias'])
  const canManageEnrollments = hasAnyPermission(user, ['gestionar_inscripciones_tutorias'])
  const canManageAttendance = hasAnyPermission(user, ['gestionar_asistencia_tutorias'])
  const canManageNotes = hasAnyPermission(user, ['gestionar_observaciones_tutorias'])
  const canManageNotifications = hasAnyPermission(user, ['gestionar_notificaciones'])

  const labMap = useMemo(
    () => Object.fromEntries(labs.map((lab) => [Number(lab.id), lab])),
    [labs],
  )

  const filteredLabs = useMemo(() => {
    if (!filters.areaId) {
      return labs
    }
    return labs.filter((lab) => String(lab.area_id) === String(filters.areaId))
  }, [filters.areaId, labs])

  const formLabs = useMemo(() => {
    if (!filters.areaId || editingId) {
      return labs
    }
    return filteredLabs
  }, [editingId, filteredLabs, filters.areaId, labs])

  const visibleItems = useMemo(() => (
    items.filter((item) => {
      if (filters.areaId) {
        const lab = labMap[Number(item.laboratory_id)]
        if (!lab || String(lab.area_id) !== String(filters.areaId)) {
          return false
        }
      }
      return true
    })
  ), [filters.areaId, items, labMap])

  const summary = useMemo(() => {
    const classes = visibleItems.filter((item) => item.session_type === 'class').length
    const tutorials = visibleItems.filter((item) => item.session_type === 'tutorial').length
    const guests = visibleItems.filter((item) => item.session_type === 'guest').length

    return { classes, tutorials, guests }
  }, [visibleItems])

  const loadData = async (currentFilters = filters) => {
    setLoading(true)
    try {
      const [areasData, labsData, itemsData] = await Promise.all([
        listAdminAreas(),
        listAdminLabs(),
        listClassTutorials({
          laboratoryId: currentFilters.laboratoryId || undefined,
          date: currentFilters.date || undefined,
          sessionType: currentFilters.sessionType || undefined,
        }),
      ])

      setAreas(areasData)
      setLabs(labsData)
      setItems(itemsData)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las clases y tutorias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(defaultFilters)
  }, [])

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(defaultForm)
  }

  const buildPayload = () => ({
    laboratory_id: Number(form.laboratory_id),
    session_type: form.session_type,
    date: form.date,
    start_time: form.start_time,
    end_time: form.end_time,
    title: form.title.trim(),
    facilitator_name: form.facilitator_name.trim(),
    target_group: form.target_group.trim(),
    academic_unit: form.academic_unit.trim(),
    needs_support: Boolean(form.needs_support),
    support_topic: form.support_topic.trim(),
    notes: form.notes.trim(),
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canManageTutorials) return
    resetFeedback()

    try {
      const payload = buildPayload()
      if (editingId) {
        await updateClassTutorial(editingId, payload)
        setMessage('Registro actualizado correctamente.')
      } else {
        await createClassTutorial(payload)
        setMessage('Registro creado correctamente.')
      }
      resetForm()
      await loadData(filters)
    } catch (err) {
      setError(err.message || 'No se pudo guardar el registro')
    }
  }

  const handleDelete = async (itemId) => {
    if (!canManageTutorials) return
    resetFeedback()
    if (!window.confirm('Deseas eliminar este registro de clase o tutoria?')) {
      return
    }

    try {
      await deleteClassTutorial(itemId)
      setMessage('Registro eliminado correctamente.')
      await loadData(filters)
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el registro')
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setForm({
      laboratory_id: String(item.laboratory_id),
      session_type: item.session_type,
      date: item.date,
      start_time: item.start_time.slice(0, 5),
      end_time: item.end_time.slice(0, 5),
      title: item.title || '',
      facilitator_name: item.facilitator_name || '',
      target_group: item.target_group || '',
      academic_unit: item.academic_unit || '',
      needs_support: item.needs_support || false,
      support_topic: item.support_topic || '',
      notes: item.notes || '',
    })
  }

  const applyFilters = async (event) => {
    event.preventDefault()
    resetFeedback()
    await loadData(filters)
  }

  return (
    <section className="tutorials-page" aria-label="Gestion de clases y tutorias">
      <header className="tutorials-header">
        <div>
          <p className="tutorials-kicker">Planeacion academica</p>
          <h2>Clases y tutorias por laboratorio</h2>
          <p>
            Registra sesiones academicas que bloquean disponibilidad real en el calendario del estudiante y del administrador.
          </p>
        </div>
        <div className="tutorials-summary">
          <div><span>Registros</span><strong>{visibleItems.length}</strong></div>
          <div><span>Clases</span><strong>{summary.classes}</strong></div>
          <div><span>Tutorias</span><strong>{summary.tutorials}</strong></div>
          <div><span>Invitados</span><strong>{summary.guests}</strong></div>
        </div>
      </header>

      {message ? <p className="tutorials-alert success">{message}</p> : null}
      {error ? <p className="tutorials-alert error">{error}</p> : null}
      {!canManageTutorials ? (
        <p className="tutorials-alert error">
          Tu rol puede revisar la agenda, pero no crear o editar sesiones porque no tiene <strong>gestionar_tutorias</strong>.
        </p>
      ) : null}
      {canManageEnrollments || canManageAttendance || canManageNotes || canManageNotifications ? (
        <p className="tutorials-alert success">
          Este rol tambien puede operar la agenda desde otras capacidades:
          {canManageEnrollments ? ' inscripciones,' : ''}
          {canManageAttendance ? ' asistencia,' : ''}
          {canManageNotes ? ' observaciones,' : ''}
          {canManageNotifications ? ' notificaciones.' : ''}
        </p>
      ) : null}

      <div className="tutorials-grid">
        <section className="tutorials-card">
          <div className="tutorials-card-head">
            <div>
              <h3>{editingId ? 'Editar clase o tutoria' : 'Registrar clase o tutoria'}</h3>
              <p>Usa este formulario para bloquear horarios academicos y coordinar apoyo tecnico.</p>
            </div>
          </div>

          <form className="tutorials-form" onSubmit={handleSubmit}>
            <div className="tutorials-form-grid">
              <label>
                <span>Laboratorio</span>
                <select
                  value={form.laboratory_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, laboratory_id: event.target.value }))}
                  required
                  disabled={!canManageTutorials}
                >
                  <option value="">Selecciona un laboratorio</option>
                  {formLabs.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tipo</span>
                <select value={form.session_type} onChange={(event) => setForm((prev) => ({ ...prev, session_type: event.target.value }))} disabled={!canManageTutorials}>
                  <option value="class">Clase</option>
                  <option value="tutorial">Tutoria</option>
                  <option value="guest">Invitado</option>
                </select>
              </label>
              <label>
                <span>Fecha</span>
                <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} required disabled={!canManageTutorials} />
              </label>
              <label>
                <span>Inicio</span>
                <input type="time" value={form.start_time} onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))} required disabled={!canManageTutorials} />
              </label>
              <label>
                <span>Fin</span>
                <input type="time" value={form.end_time} onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))} required disabled={!canManageTutorials} />
              </label>
              <label>
                <span>Titulo</span>
                <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Quimica Organica I" required disabled={!canManageTutorials} />
              </label>
              <label>
                <span>Responsable</span>
                <input value={form.facilitator_name} onChange={(event) => setForm((prev) => ({ ...prev, facilitator_name: event.target.value }))} placeholder="Docente o auxiliar" required disabled={!canManageTutorials} />
              </label>
              <label>
                <span>Grupo objetivo</span>
                <input value={form.target_group} onChange={(event) => setForm((prev) => ({ ...prev, target_group: event.target.value }))} placeholder="Bioquimica 2A" disabled={!canManageTutorials} />
              </label>
              <label>
                <span>Unidad academica</span>
                <input value={form.academic_unit} onChange={(event) => setForm((prev) => ({ ...prev, academic_unit: event.target.value }))} placeholder="Facultad de Ingenieria" disabled={!canManageTutorials} />
              </label>
            </div>

            <label className="tutorials-checkbox">
              <input type="checkbox" checked={form.needs_support} onChange={(event) => setForm((prev) => ({ ...prev, needs_support: event.target.checked }))} disabled={!canManageTutorials} />
              <span>Requiere apoyo tecnico o tutoria asistida</span>
            </label>

            <label>
              <span>Tema de apoyo</span>
              <input value={form.support_topic} onChange={(event) => setForm((prev) => ({ ...prev, support_topic: event.target.value }))} placeholder="Preparacion de reactivos o configuracion de equipos" disabled={!canManageTutorials} />
            </label>

            <label>
              <span>Notas</span>
              <textarea rows="4" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} disabled={!canManageTutorials} />
            </label>

            <div className="tutorials-actions">
              <button type="submit" className="tutorials-primary" disabled={!canManageTutorials}>
                {editingId ? 'Guardar cambios' : 'Registrar sesion'}
              </button>
              {editingId ? (
                <button type="button" className="tutorials-secondary" onClick={resetForm} disabled={!canManageTutorials}>
                  Cancelar edicion
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="tutorials-card">
          <div className="tutorials-card-head">
            <div>
              <h3>Agenda administrativa</h3>
              <p>Filtra por area, laboratorio o fecha para revisar que sesiones estan ocupando los espacios.</p>
            </div>
          </div>

          <form className="tutorials-filters" onSubmit={applyFilters}>
            <label>
              <span>Area</span>
              <select value={filters.areaId} onChange={(event) => setFilters((prev) => ({ ...prev, areaId: event.target.value, laboratoryId: '' }))}>
                <option value="">Todas las areas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Laboratorio</span>
              <select value={filters.laboratoryId} onChange={(event) => setFilters((prev) => ({ ...prev, laboratoryId: event.target.value }))}>
                <option value="">Todos los laboratorios</option>
                {filteredLabs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Fecha</span>
              <input type="date" value={filters.date} onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))} />
            </label>
            <label>
              <span>Tipo</span>
              <select value={filters.sessionType} onChange={(event) => setFilters((prev) => ({ ...prev, sessionType: event.target.value }))}>
                <option value="">Todos</option>
                <option value="class">Clase</option>
                <option value="tutorial">Tutoria</option>
                <option value="guest">Invitado</option>
              </select>
            </label>
            <button type="submit" className="tutorials-secondary">Aplicar filtros</button>
          </form>

          {loading ? (
            <p className="tutorials-empty">Cargando agenda...</p>
          ) : (
            <div className="tutorials-list">
              {visibleItems.map((item) => (
                <article key={item.id} className="tutorials-item">
                  <div className="tutorials-item-head">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.laboratory_name}</p>
                    </div>
                    <span className={`tutorials-badge ${item.session_type}`}>
                      {sessionTypeLabels[item.session_type] || item.session_type}
                    </span>
                  </div>

                  <div className="tutorials-meta">
                    <span>{item.date}</span>
                    <span>{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</span>
                    <span>{item.facilitator_name}</span>
                    <span>{item.target_group || 'Sin grupo'}</span>
                  </div>

                  <p className="tutorials-notes">{item.notes || 'Sin notas adicionales.'}</p>

                  <div className="tutorials-details">
                    <div><span>Apoyo</span><strong>{item.needs_support ? item.support_topic || 'Si, sin detalle' : 'No requerido'}</strong></div>
                    <div><span>Unidad</span><strong>{item.academic_unit || 'No registrada'}</strong></div>
                  </div>

                  <div className="tutorials-actions compact">
                    <button type="button" className="tutorials-secondary" onClick={() => handleEdit(item)} disabled={!canManageTutorials}>
                      Editar
                    </button>
                    <button type="button" className="tutorials-danger" onClick={() => handleDelete(item.id)} disabled={!canManageTutorials}>
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default AdminClassTutorialsPage
