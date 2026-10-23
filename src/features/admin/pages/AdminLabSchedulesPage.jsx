import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { listAdminLabs } from '../services/infrastructureService'
import {
  ACADEMIC_BLOCKS,
  WEEKDAYS,
  createLabSchedule,
  deleteLabSchedule,
  listLabSchedules,
  updateLabSchedule,
} from '../services/labSchedulesService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import { listUserProfiles } from '../services/profileService'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import './AdminAssetsPage.css'
import './AdminLabSchedulesPage.css'

const BLOCK_STARTS = ACADEMIC_BLOCKS.map((block) => block.start_time)
const BLOCK_ENDS = ACADEMIC_BLOCKS.map((block) => block.end_time)
const REQUIRED_PERMISSIONS = ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio']

const emptyForm = {
  weekday: 0,
  start_time: '',
  end_time: '',
  subject: '',
  description: '',
  teacher_id: '',
  teacher_name: '',
}

function isTeacherProfile(profile) {
  const role = String(profile?.role || profile?.profile_type || '').toLowerCase()
  return role.includes('docente')
}

function resolveProfileName(profile) {
  return profile?.name || profile?.username || profile?.email || 'Docente'
}

function buildScheduleIndex(schedules) {
  const map = new Map()
  for (const schedule of schedules) {
    const key = String(schedule.weekday)
    const list = map.get(key) || []
    list.push(schedule)
    map.set(key, list)
  }
  return map
}

function findScheduleCoveringBlock(daySchedules, block) {
  return daySchedules.find(
    (schedule) => schedule.start_time <= block.start_time && schedule.end_time >= block.end_time,
  ) || null
}

function isFirstBlockOfSchedule(schedule, block) {
  return schedule.start_time === block.start_time
}

function AdminLabSchedulesPage({ user }) {
  const [labs, setLabs] = useState([])
  const [selectedLabId, setSelectedLabId] = useState('')
  const [schedules, setSchedules] = useState([])
  const [loadingLabs, setLoadingLabs] = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editorState, setEditorState] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [teacherProfiles, setTeacherProfiles] = useState([])

  const canManage = hasAnyPermission(user, REQUIRED_PERMISSIONS)

  useEffect(() => {
    const loadLabs = async () => {
      setLoadingLabs(true)
      try {
        const data = await listAdminLabs()
        const activeLabs = (Array.isArray(data) ? data : []).filter((lab) => lab.is_active !== false)
        setLabs(activeLabs)
        if (activeLabs.length > 0 && !selectedLabId) {
          setSelectedLabId(String(activeLabs[0].id))
        }
        setError('')
      } catch (err) {
        setError(err.message || 'No se pudieron cargar los laboratorios')
      } finally {
        setLoadingLabs(false)
      }
    }
    loadLabs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    listUserProfiles()
      .then((profiles) => {
        if (cancelled) return
        const list = Array.isArray(profiles) ? profiles : []
        const docentes = list.filter((profile) => profile?.is_active !== false && isTeacherProfile(profile))
        // Si por alguna razon ningun perfil declara rol Docente, ofrecemos todos
        // los perfiles activos para no bloquear la asignacion.
        setTeacherProfiles(docentes.length > 0 ? docentes : list.filter((profile) => profile?.is_active !== false))
      })
      .catch(() => {
        if (!cancelled) setTeacherProfiles([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadSchedules = async (labId) => {
    if (!labId) {
      setSchedules([])
      return
    }
    setLoadingSchedules(true)
    try {
      const data = await listLabSchedules({ laboratory_id: labId })
      setSchedules(data)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los horarios')
    } finally {
      setLoadingSchedules(false)
    }
  }

  useEffect(() => {
    loadSchedules(selectedLabId)
  }, [selectedLabId])

  const schedulesByWeekday = useMemo(() => buildScheduleIndex(schedules), [schedules])

  const selectedLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(selectedLabId)) || null,
    [labs, selectedLabId],
  )

  const openCreateForBlock = (weekday, block) => {
    if (!canManage) return
    setEditorState({
      mode: 'create',
      form: {
        ...emptyForm,
        weekday,
        start_time: block.start_time,
        end_time: block.end_time,
      },
    })
  }

  const openEdit = (schedule) => {
    if (!canManage) return
    setEditorState({
      mode: 'edit',
      schedule,
      form: {
        weekday: schedule.weekday,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        subject: schedule.subject,
        description: schedule.description,
        teacher_id: schedule.teacher_id || '',
        teacher_name: schedule.teacher_name || '',
      },
    })
  }

  const handleTeacherChange = (teacherId) => {
    const profile = teacherProfiles.find((entry) => String(entry.id) === String(teacherId)) || null
    setEditorState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        form: {
          ...prev.form,
          teacher_id: teacherId ? String(teacherId) : '',
          teacher_name: profile ? resolveProfileName(profile) : '',
        },
      }
    })
  }

  const closeEditor = () => setEditorState(null)

  const handleFormChange = (field, value) => {
    setEditorState((prev) => {
      if (!prev) return prev
      const nextForm = { ...prev.form, [field]: value }
      if (field === 'start_time' && nextForm.end_time && nextForm.end_time <= value) {
        const nextEnd = BLOCK_ENDS.find((end) => end > value)
        nextForm.end_time = nextEnd || ''
      }
      return { ...prev, form: nextForm }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!editorState || !selectedLabId) return
    const { mode, form, schedule } = editorState

    if (!form.subject.trim()) {
      setError('Debes indicar el nombre de la materia o clase.')
      return
    }
    if (!form.start_time || !form.end_time || form.end_time <= form.start_time) {
      setError('El rango horario seleccionado no es valido.')
      return
    }

    try {
      if (mode === 'create') {
        await createLabSchedule({
          laboratory_id: selectedLabId,
          weekday: form.weekday,
          start_time: form.start_time,
          end_time: form.end_time,
          subject: form.subject,
          description: form.description,
          teacher_id: form.teacher_id,
          teacher_name: form.teacher_name,
        })
        setMessage('Clase agregada al horario.')
      } else {
        await updateLabSchedule(schedule.id, {
          start_time: form.start_time,
          end_time: form.end_time,
          subject: form.subject,
          description: form.description,
          teacher_id: form.teacher_id,
          teacher_name: form.teacher_name,
        })
        setMessage('Clase actualizada.')
      }
      closeEditor()
      await loadSchedules(selectedLabId)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo guardar la clase.')
    }
  }

  const handleDelete = (schedule) => {
    if (!canManage) return
    setConfirmModal({
      message: `Se eliminara la clase "${schedule.subject}" de los ${WEEKDAYS[schedule.weekday]?.label?.toLowerCase() || ''}.`,
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await deleteLabSchedule(schedule.id)
          setMessage('Clase eliminada.')
          closeEditor()
          await loadSchedules(selectedLabId)
        } catch (err) {
          setError(err.message || 'No se pudo eliminar la clase.')
        }
      },
    })
  }

  const totalClasses = schedules.length

  return (
    <section className="infra-page" aria-label="Horarios de laboratorios">
      {confirmModal ? (
        <ConfirmModal
          title="Eliminar clase"
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}

      <header className="infra-header">
        <div>
          <p className="infra-kicker">Horarios academicos</p>
          <h2>Clases recurrentes por laboratorio</h2>
          <p>Define los bloques academicos que estan ocupados por clases. Los demas bloques quedan disponibles para reservas.</p>
        </div>
        <div className="infra-summary">
          <div><span>Laboratorios</span><strong>{labs.length}</strong></div>
          <div><span>Clases registradas</span><strong>{totalClasses}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      <div className="infra-body schedules-body">
        <div className="schedules-toolbar">
          <label className="schedules-lab-picker">
            <span>Laboratorio</span>
            <select
              value={selectedLabId}
              onChange={(event) => setSelectedLabId(event.target.value)}
              disabled={loadingLabs || labs.length === 0}
            >
              {labs.length === 0 ? (
                <option value="">No hay laboratorios activos</option>
              ) : null}
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
          </label>
          {selectedLab ? (
            <p className="schedules-lab-meta">
              {selectedLab.location || 'Sin ubicacion registrada'} - capacidad {selectedLab.capacity || '?'}
            </p>
          ) : null}
        </div>

        {loadingSchedules ? (
          <p className="schedules-empty">Cargando horarios...</p>
        ) : !selectedLabId ? (
          <p className="schedules-empty">Selecciona un laboratorio para ver su horario semanal.</p>
        ) : (
          <div className="schedules-grid-wrapper">
            <table className="schedules-grid">
              <thead>
                <tr>
                  <th className="schedules-grid-time">Bloque</th>
                  {WEEKDAYS.map((day) => (
                    <th key={day.value} className="schedules-grid-day">
                      <span className="schedules-grid-day-short">{day.short}</span>
                      <span className="schedules-grid-day-label">{day.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACADEMIC_BLOCKS.map((block) => (
                  <tr key={block.start_time}>
                    <th className="schedules-grid-time" scope="row">
                      <span>{block.start_time}</span>
                      <small>{block.end_time}</small>
                    </th>
                    {WEEKDAYS.map((day) => {
                      const daySchedules = schedulesByWeekday.get(String(day.value)) || []
                      const matching = findScheduleCoveringBlock(daySchedules, block)
                      if (!matching) {
                        return (
                          <td key={day.value} className="schedules-cell schedules-cell--free">
                            <button
                              type="button"
                              className="schedules-cell-btn"
                              onClick={() => openCreateForBlock(day.value, block)}
                              disabled={!canManage}
                              aria-label={`Agregar clase el ${day.label} de ${block.start_time} a ${block.end_time}`}
                            >
                              <span className="schedules-cell-add">+</span>
                            </button>
                          </td>
                        )
                      }

                      const isFirst = isFirstBlockOfSchedule(matching, block)
                      return (
                        <td
                          key={day.value}
                          className={`schedules-cell schedules-cell--class ${isFirst ? 'schedules-cell--head' : 'schedules-cell--continuation'}`}
                        >
                          <button
                            type="button"
                            className="schedules-cell-btn"
                            onClick={() => openEdit(matching)}
                            disabled={!canManage}
                          >
                            {isFirst ? (
                              <>
                                <strong>{matching.subject}</strong>
                                <small>{matching.start_time} - {matching.end_time}</small>
                                {matching.teacher_name ? (
                                  <small className="schedules-cell-teacher">👩‍🏫 {matching.teacher_name}</small>
                                ) : null}
                              </>
                            ) : (
                              <span className="schedules-cell-cont-dot" aria-hidden="true">.</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="schedules-hint">
          Cada clase puede ocupar uno o varios bloques academicos. Si la clase es de 2:30 horas, abarca el inicio del primer bloque hasta el fin del ultimo, absorbiendo los huecos intermedios.
        </p>
      </div>

      {editorState ? createPortal(
        <div className="confirm-backdrop" onClick={closeEditor} role="dialog" aria-modal="true">
          <form className="schedules-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
            <header className="schedules-modal-header">
              <h3>{editorState.mode === 'create' ? 'Nueva clase' : 'Editar clase'}</h3>
              <button type="button" className="schedules-modal-close" onClick={closeEditor} aria-label="Cerrar">x</button>
            </header>

            <div className="schedules-modal-grid">
              <label>
                <span>Dia</span>
                <select
                  value={editorState.form.weekday}
                  onChange={(event) => handleFormChange('weekday', Number(event.target.value))}
                  disabled={editorState.mode === 'edit'}
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Hora de inicio</span>
                <select
                  value={editorState.form.start_time}
                  onChange={(event) => handleFormChange('start_time', event.target.value)}
                  required
                >
                  <option value="">Selecciona</option>
                  {BLOCK_STARTS.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Hora de fin</span>
                <select
                  value={editorState.form.end_time}
                  onChange={(event) => handleFormChange('end_time', event.target.value)}
                  required
                >
                  <option value="">Selecciona</option>
                  {BLOCK_ENDS
                    .filter((value) => !editorState.form.start_time || value > editorState.form.start_time)
                    .map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                </select>
              </label>
            </div>

            <label className="schedules-modal-field">
              <span>Materia / clase</span>
              <input
                type="text"
                value={editorState.form.subject}
                maxLength={120}
                onChange={(event) => handleFormChange('subject', event.target.value)}
                required
              />
            </label>

            <label className="schedules-modal-field">
              <span>Docente responsable (opcional)</span>
              <select
                value={editorState.form.teacher_id || ''}
                onChange={(event) => handleTeacherChange(event.target.value)}
              >
                <option value="">Sin docente asignado</option>
                {editorState.form.teacher_id
                  && !teacherProfiles.some((profile) => String(profile.id) === String(editorState.form.teacher_id)) ? (
                    <option value={editorState.form.teacher_id}>
                      {editorState.form.teacher_name || 'Docente asignado'} (actual)
                    </option>
                  ) : null}
                {teacherProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {resolveProfileName(profile)}{profile.email ? ` — ${profile.email}` : ''}
                  </option>
                ))}
              </select>
              <small className="schedules-modal-hint">
                El docente asignado podra pedir materiales y equipos para esta clase desde su portal.
              </small>
            </label>

            <label className="schedules-modal-field">
              <span>Descripcion (opcional)</span>
              <textarea
                rows={3}
                value={editorState.form.description}
                maxLength={400}
                onChange={(event) => handleFormChange('description', event.target.value)}
              />
            </label>

            <footer className="schedules-modal-actions">
              {editorState.mode === 'edit' ? (
                <button type="button" className="schedules-modal-danger" onClick={() => handleDelete(editorState.schedule)}>
                  Eliminar
                </button>
              ) : <span />}
              <div className="schedules-modal-primary-actions">
                <button type="button" className="schedules-modal-secondary" onClick={closeEditor}>Cancelar</button>
                <button type="submit" className="schedules-modal-primary">
                  {editorState.mode === 'create' ? 'Crear clase' : 'Guardar cambios'}
                </button>
              </div>
            </footer>
          </form>
        </div>,
        document.body,
      ) : null}
    </section>
  )
}

export default AdminLabSchedulesPage
