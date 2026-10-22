import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, UserCheck } from 'lucide-react'
import { listUsersWithRoles } from '../../admin/services/rolesService'
import './PickerModals.css'

const TEACHER_ROLE_NAME = 'docente'

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es')
    .trim()
}

function isTeacher(user) {
  return normalize(user?.role?.nombre) === TEACHER_ROLE_NAME
}

// Ventana para buscar y seleccionar al docente responsable (solo usuarios con rol Docente).
// Permite dejar la reserva sin docente, recordando poner el nombre en la descripcion.
function TeacherPickerModal({ open, onClose, onSelect, selectedTeacherId = '' }) {
  const [teachers, setTeachers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return undefined
    document.body.classList.add('reservation-modal-open')
    return () => document.body.classList.remove('reservation-modal-open')
  }, [open])

  const requestRef = useRef(0)
  const fetchTeachers = useCallback(() => {
    const reqId = requestRef.current + 1
    requestRef.current = reqId
    setIsLoading(true)
    setError('')
    listUsersWithRoles()
      .then((users) => {
        if (reqId !== requestRef.current) return
        setTeachers((Array.isArray(users) ? users : []).filter(isTeacher))
      })
      .catch(() => {
        if (reqId === requestRef.current) setError('No se pudo cargar la lista de docentes.')
      })
      .finally(() => {
        if (reqId === requestRef.current) setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!open) return
    // Carga bajo demanda al abrir; el estado de carga es intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTeachers()
  }, [open, fetchTeachers])

  const filtered = useMemo(() => {
    const term = normalize(search)
    if (!term) return teachers
    return teachers.filter((t) => `${normalize(t.name)} ${normalize(t.email)}`.includes(term))
  }, [teachers, search])

  if (!open) return null

  const content = (
    <div className="picker-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="picker-modal" onClick={(event) => event.stopPropagation()}>
        <header className="picker-modal-header">
          <div>
            <p className="picker-modal-kicker">Docente responsable</p>
            <h3>Selecciona al docente responsable</h3>
            <p>Busca entre los docentes registrados. Es opcional.</p>
          </div>
          <button type="button" className="picker-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="picker-modal-toolbar">
          <label className="picker-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar docente por nombre o correo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
          </label>
        </div>

        <p className="picker-modal-hint">
          Si tu docente no aparece o no tienes un tutor asignado, deja este campo vacío y
          <strong> aclara en la descripción del proyecto</strong> quién es tu docente responsable
          o por qué no tienes uno.
        </p>

        <div className="picker-modal-list">
          {isLoading ? (
            <p className="reservations-empty">Cargando docentes...</p>
          ) : error ? (
            <p className="reservations-empty">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="reservations-empty">No se encontraron docentes.</p>
          ) : (
            filtered.map((teacher) => {
              const isSelected = String(teacher.id) === String(selectedTeacherId || '')
              return (
                <button
                  key={teacher.id}
                  type="button"
                  className={`picker-row${isSelected ? ' is-selected' : ''}`}
                  onClick={() => {
                    onSelect({ id: String(teacher.id), name: teacher.name || teacher.email || 'Docente' })
                    onClose()
                  }}
                >
                  <span className="picker-row-icon"><UserCheck size={18} /></span>
                  <span className="picker-row-body">
                    <strong>{teacher.name || 'Sin nombre'}</strong>
                    <span>{teacher.email || 'Sin correo'}</span>
                  </span>
                  {isSelected ? <span className="picker-row-badge">Seleccionado</span> : null}
                </button>
              )
            })
          )}
        </div>

        <div className="picker-modal-actions">
          <button
            type="button"
            className="reservations-secondary"
            onClick={() => {
              onSelect(null)
              onClose()
            }}
          >
            Sin docente responsable
          </button>
          <button type="button" className="reservations-primary" onClick={onClose}>
            Listo
          </button>
        </div>
      </section>
    </div>
  )

  return createPortal(content, document.body)
}

export default TeacherPickerModal
