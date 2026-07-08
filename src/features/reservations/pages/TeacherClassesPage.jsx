import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, FlaskConical, Cpu, CalendarDays, Clock3, MapPin, RotateCw } from 'lucide-react'
import { WEEKDAYS, listMyTeacherClasses } from '../../admin/services/labSchedulesService'
import {
  createEquipmentRequest,
  listEquipmentRequests,
  normalizeCategory,
} from '../../admin/services/infrastructureService'
import {
  createSupplyReservation,
  listAvailableLabs,
  listSupplyReservations,
} from '../services/reservationsService'
import MaterialPickerModal from './MaterialPickerModal'
import EquipmentPickerModal from './EquipmentPickerModal'
import './ReservationsPages.css'
import './TeacherClassesPage.css'

const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  delivered: 'Entregada',
  returned: 'Devuelta',
}

function newGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function weekdayLabel(weekday) {
  return WEEKDAYS.find((day) => day.value === Number(weekday))?.label || ''
}

function classContextLabel(klass, labName) {
  const parts = [klass.subject]
  if (labName) parts.push(labName)
  const when = [weekdayLabel(klass.weekday), klass.start_time].filter(Boolean).join(' ')
  if (when) parts.push(when)
  return `Clase: ${parts.join(' · ')}`
}

const emptyBuilder = {
  materials: [],
  equipment: [],
  recurrence: 'once',
  recurrence_end_date: '',
  purpose: '',
}

function TeacherClassesPage({ user }) {
  const [classes, setClasses] = useState([])
  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeClass, setActiveClass] = useState(null)
  const [builder, setBuilder] = useState(emptyBuilder)
  const [materialPicker, setMaterialPicker] = useState(null) // null | 'reactivos' | 'materiales'
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [supplyRequests, setSupplyRequests] = useState([])
  const [equipmentRequests, setEquipmentRequests] = useState([])

  const userId = String(user?.user_id || '')

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )

  const loadClasses = useCallback(async () => {
    setLoading(true)
    try {
      const [classesData, labsData] = await Promise.all([
        listMyTeacherClasses(),
        listAvailableLabs(user).catch(() => []),
      ])
      setClasses(Array.isArray(classesData) ? classesData : [])
      setLabs(Array.isArray(labsData) ? labsData : [])
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus clases.')
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadRequests = useCallback(async () => {
    try {
      const [supplies, equipment] = await Promise.all([
        listSupplyReservations({ skipCache: true }).catch(() => []),
        listEquipmentRequests({ skipCache: true }).catch(() => []),
      ])
      // El backend de insumos puede devolver mas de lo propio si el docente tiene
      // permiso de tutorias: filtramos a las solicitudes creadas por el docente.
      setSupplyRequests((Array.isArray(supplies) ? supplies : []).filter((item) => String(item.requested_by || '') === userId))
      setEquipmentRequests(Array.isArray(equipment) ? equipment : [])
    } catch {
      // no critico
    }
  }, [userId])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const openClass = (klass) => {
    setActiveClass(klass)
    setBuilder(emptyBuilder)
    setError('')
    setMessage('')
  }

  const closeClass = () => {
    setActiveClass(null)
    setBuilder(emptyBuilder)
    setMaterialPicker(null)
    setEquipmentPickerOpen(false)
  }

  const updateMaterialQty = (stockItemId, value) => {
    setBuilder((prev) => ({
      ...prev,
      materials: prev.materials.map((entry) =>
        String(entry.stock_item_id) === String(stockItemId)
          ? { ...entry, quantity: Math.max(1, Number(value) || 1) }
          : entry,
      ),
    }))
  }

  const removeMaterial = (stockItemId) => {
    setBuilder((prev) => ({
      ...prev,
      materials: prev.materials.filter((entry) => String(entry.stock_item_id) !== String(stockItemId)),
    }))
  }

  const removeEquipment = (assetId) => {
    setBuilder((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((entry) => String(entry.asset_id) !== String(assetId)),
    }))
  }

  const totalSelected = builder.materials.length + builder.equipment.length
  const isWeekly = builder.recurrence === 'weekly'
  const canSubmit = Boolean(
    activeClass
      && totalSelected > 0
      && (!isWeekly || builder.recurrence_end_date),
  )

  const handleSubmit = async () => {
    if (!activeClass || isSubmitting) return
    if (totalSelected === 0) {
      setError('Selecciona al menos un material o equipo para solicitar.')
      return
    }
    if (isWeekly && !builder.recurrence_end_date) {
      setError('Indica la fecha límite del préstamo semanal.')
      return
    }

    setIsSubmitting(true)
    setError('')
    setMessage('')

    const labName = labNameById[String(activeClass.laboratory_id)] || ''
    const requestedFor = classContextLabel(activeClass, labName)
    const groupId = newGroupId()
    const recurrence = builder.recurrence
    const recurrenceEnd = isWeekly ? builder.recurrence_end_date : ''
    const notes = builder.purpose.trim()

    const materialCalls = builder.materials.map((entry) =>
      createSupplyReservation({
        stock_item_id: entry.stock_item_id,
        quantity: Number(entry.quantity) || 1,
        requested_for: requestedFor,
        notes,
        laboratory_id: String(activeClass.laboratory_id || ''),
        recurrence,
        recurrence_end_date: recurrenceEnd,
        recurrence_group_id: groupId,
      }),
    )
    const equipmentCalls = builder.equipment.map((entry) =>
      createEquipmentRequest({
        asset_id: entry.asset_id,
        purpose: requestedFor,
        notes,
        requested_for: requestedFor,
        laboratory_id: entry.laboratory_id || String(activeClass.laboratory_id || ''),
        recurrence,
        recurrence_end_date: recurrenceEnd,
        recurrence_group_id: groupId,
        requested_by_name: user?.name || user?.username || '',
        requested_by_email: user?.email || '',
      }),
    )

    const results = await Promise.allSettled([...materialCalls, ...equipmentCalls])
    const failed = results.filter((r) => r.status === 'rejected')

    setIsSubmitting(false)

    if (failed.length === 0) {
      setMessage(
        isWeekly
          ? `Solicitud enviada. Pediste ${totalSelected} recurso(s) cada semana hasta ${recurrenceEnd}. Queda pendiente de aprobación del encargado.`
          : `Solicitud enviada con ${totalSelected} recurso(s). Queda pendiente de aprobación del encargado.`,
      )
      setBuilder(emptyBuilder)
      setActiveClass(null)
      await loadRequests()
    } else {
      const detail = failed.map((r) => r.reason?.message || 'Error').join('; ')
      setError(`${failed.length} de ${results.length} solicitud(es) no se pudieron enviar: ${detail}`)
      await loadRequests()
    }
  }

  const myRequests = useMemo(() => {
    const supplies = supplyRequests.map((item) => ({
      key: `s-${item.id}`,
      type: 'material',
      name: item.stock_item_name || item.stock_item_id,
      detail: `${item.quantity} u.`,
      status: item.status,
      recurrence: item.recurrence,
      recurrence_end_date: item.recurrence_end_date,
      context: item.requested_for,
      created: item.created,
    }))
    const equipment = equipmentRequests.map((item) => ({
      key: `e-${item.id}`,
      type: 'equipo',
      name: item.asset_name || item.asset_id,
      detail: item.asset_serial_number ? `Serie ${item.asset_serial_number}` : 'Equipo',
      status: item.status,
      recurrence: item.recurrence,
      recurrence_end_date: item.recurrence_end_date,
      context: item.requested_for,
      created: item.created || item.requested_at || '',
    }))
    return [...supplies, ...equipment].sort((a, b) => String(b.created).localeCompare(String(a.created)))
  }, [supplyRequests, equipmentRequests])

  const pendingCount = myRequests.filter((r) => r.status === 'pending').length

  return (
    <section className="reservations-page teacher-classes-page" aria-label="Mis clases">
      <header className="reservations-header">
        <div className="reservations-header-copy">
          <p className="reservations-kicker">Portal docente</p>
          <h2>Mis clases</h2>
          <p>Consulta las clases que tienes asignadas y solicita los materiales o equipos que necesitas para cada una.</p>
        </div>
        <div className="reservations-summary">
          <div className="reservations-summary-card tone-overview">
            <span className="reservations-summary-card-icon"><BookOpen size={18} /></span>
            <div><span>Clases</span><strong>{classes.length}</strong></div>
          </div>
          <div className="reservations-summary-card tone-requests">
            <span className="reservations-summary-card-icon"><FlaskConical size={18} /></span>
            <div><span>Solicitudes</span><strong>{myRequests.length}</strong></div>
          </div>
          <div className="reservations-summary-card tone-control">
            <span className="reservations-summary-card-icon"><Clock3 size={18} /></span>
            <div><span>Pendientes</span><strong>{pendingCount}</strong></div>
          </div>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Clases asignadas</h3>
          <p className="reservations-panel-subtitle">Elige una clase para ver su información y pedir recursos.</p>
        </div>

        {loading ? (
          <p className="reservations-empty">Cargando tus clases...</p>
        ) : classes.length === 0 ? (
          <p className="reservations-empty">
            Aún no tienes clases asignadas. Pídele al encargado de laboratorio que te asigne una clase desde
            “Horarios de laboratorios”.
          </p>
        ) : (
          <div className="teacher-class-grid">
            {classes.map((klass) => {
              const labName = labNameById[String(klass.laboratory_id)] || 'Laboratorio'
              return (
                <article key={klass.id} className="teacher-class-card">
                  <div className="teacher-class-card-top">
                    <span className="teacher-class-pill">{weekdayLabel(klass.weekday)}</span>
                    <span className="teacher-class-time">{klass.start_time} - {klass.end_time}</span>
                  </div>
                  <h4>{klass.subject}</h4>
                  <div className="teacher-class-meta">
                    <span><MapPin size={14} aria-hidden="true" /> {labName}</span>
                    <span><CalendarDays size={14} aria-hidden="true" /> {weekdayLabel(klass.weekday)}</span>
                  </div>
                  {klass.description ? <p className="teacher-class-desc">{klass.description}</p> : null}
                  <button type="button" className="reservations-primary" onClick={() => openClass(klass)}>
                    Ver clase y pedir recursos
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Mis solicitudes</h3>
          <p className="reservations-panel-subtitle">Estado de los materiales y equipos que pediste para tus clases.</p>
        </div>
        {myRequests.length === 0 ? (
          <p className="reservations-empty">Todavía no has enviado solicitudes de recursos.</p>
        ) : (
          <div className="teacher-request-list">
            {myRequests.map((req) => (
              <article key={req.key} className="teacher-request-row">
                <span className={`teacher-request-type is-${req.type}`}>
                  {req.type === 'material' ? <FlaskConical size={14} /> : <Cpu size={14} />}
                  {req.type === 'material' ? 'Material' : 'Equipo'}
                </span>
                <div className="teacher-request-info">
                  <strong>{req.name}</strong>
                  <small>{req.detail}{req.context ? ` · ${req.context}` : ''}</small>
                </div>
                <div className="teacher-request-tags">
                  {req.recurrence === 'weekly' ? (
                    <span className="teacher-tag is-weekly">
                      <RotateCw size={12} /> Semanal{req.recurrence_end_date ? ` hasta ${req.recurrence_end_date}` : ''}
                    </span>
                  ) : (
                    <span className="teacher-tag">1 vez</span>
                  )}
                  <span className={`reservations-status ${req.status}`}>{STATUS_LABELS[req.status] || req.status}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {activeClass ? (
        <div className="teacher-builder-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) closeClass() }}>
          <section className="teacher-builder-modal">
            <header className="teacher-builder-head">
              <div>
                <p className="reservations-kicker">Pedir recursos</p>
                <h3>{activeClass.subject}</h3>
                <p className="teacher-builder-sub">
                  {labNameById[String(activeClass.laboratory_id)] || 'Laboratorio'} · {weekdayLabel(activeClass.weekday)} {activeClass.start_time} - {activeClass.end_time}
                </p>
              </div>
              <button type="button" className="picker-modal-close" onClick={closeClass} aria-label="Cerrar">✕</button>
            </header>

            {activeClass.description ? (
              <p className="teacher-builder-desc">{activeClass.description}</p>
            ) : null}

            <div className="teacher-builder-body">
              <div className="teacher-builder-section">
                <div className="teacher-builder-section-head">
                  <strong>1 · Materiales y reactivos</strong>
                  <div className="teacher-builder-actions">
                    <button type="button" className="reservations-secondary" onClick={() => setMaterialPicker('reactivos')}>Elegir reactivos</button>
                    <button type="button" className="reservations-secondary" onClick={() => setMaterialPicker('materiales')}>Elegir materiales</button>
                  </div>
                </div>
                {builder.materials.length === 0 ? (
                  <p className="teacher-builder-empty">Sin materiales seleccionados.</p>
                ) : (
                  <ul className="teacher-selected-list">
                    {builder.materials.map((entry) => {
                      const stock = Number(entry.quantity_available || 0)
                      const limit = Number(entry.limite_reserva_usuario || 0)
                      const max = limit > 0 ? Math.min(stock, limit) : stock
                      return (
                        <li key={entry.stock_item_id} className="teacher-selected-row">
                          <div>
                            <strong>{entry.name}</strong>
                            <small>{normalizeCategory(entry.category)} · {stock} {entry.unit || ''} disp.{limit > 0 ? ` (máx ${limit})` : ''}</small>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max={Math.max(max, 1)}
                            value={entry.quantity}
                            onChange={(e) => updateMaterialQty(entry.stock_item_id, e.target.value)}
                          />
                          <button type="button" className="reservations-secondary" onClick={() => removeMaterial(entry.stock_item_id)}>Quitar</button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="teacher-builder-section">
                <div className="teacher-builder-section-head">
                  <strong>2 · Equipos</strong>
                  <div className="teacher-builder-actions">
                    <button type="button" className="reservations-secondary" onClick={() => setEquipmentPickerOpen(true)}>Elegir equipos</button>
                  </div>
                </div>
                {builder.equipment.length === 0 ? (
                  <p className="teacher-builder-empty">Sin equipos seleccionados.</p>
                ) : (
                  <ul className="teacher-selected-list">
                    {builder.equipment.map((entry) => (
                      <li key={entry.asset_id} className="teacher-selected-row">
                        <div>
                          <strong>{entry.asset_name}</strong>
                          <small>{entry.category || 'Equipo'}{entry.serial_number ? ` · Serie ${entry.serial_number}` : ''}{entry.laboratory_name ? ` · ${entry.laboratory_name}` : ''}</small>
                        </div>
                        <button type="button" className="reservations-secondary" onClick={() => removeEquipment(entry.asset_id)}>Quitar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="teacher-builder-section">
                <div className="teacher-builder-section-head">
                  <strong>3 · Frecuencia del préstamo</strong>
                </div>
                <div className="teacher-recurrence-toggle">
                  <button
                    type="button"
                    className={`teacher-recurrence-option${builder.recurrence === 'once' ? ' is-active' : ''}`}
                    onClick={() => setBuilder((prev) => ({ ...prev, recurrence: 'once' }))}
                  >
                    <strong>Una sola vez</strong>
                    <small>Para una fecha o práctica puntual.</small>
                  </button>
                  <button
                    type="button"
                    className={`teacher-recurrence-option${builder.recurrence === 'weekly' ? ' is-active' : ''}`}
                    onClick={() => setBuilder((prev) => ({ ...prev, recurrence: 'weekly' }))}
                  >
                    <strong>Cada semana</strong>
                    <small>Se renueva cada semana hasta la fecha que indiques.</small>
                  </button>
                </div>
                {isWeekly ? (
                  <label className="teacher-builder-field">
                    <span>Repetir hasta (fecha límite)</span>
                    <input
                      type="date"
                      value={builder.recurrence_end_date}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setBuilder((prev) => ({ ...prev, recurrence_end_date: e.target.value }))}
                    />
                  </label>
                ) : null}
              </div>

              <label className="teacher-builder-field">
                <span>Nota para el encargado (opcional)</span>
                <textarea
                  rows="2"
                  value={builder.purpose}
                  onChange={(e) => setBuilder((prev) => ({ ...prev, purpose: e.target.value }))}
                  placeholder="Ej. Práctica de titulación, se usa al inicio de la clase."
                />
              </label>
            </div>

            <footer className="teacher-builder-foot">
              <span className="teacher-builder-count">{totalSelected} recurso(s) seleccionado(s)</span>
              <div className="teacher-builder-foot-actions">
                <button type="button" className="reservations-secondary" onClick={closeClass}>Cancelar</button>
                <button type="button" className="reservations-primary" disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
                  {isSubmitting ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      <MaterialPickerModal
        open={materialPicker !== null}
        onClose={() => setMaterialPicker(null)}
        title={materialPicker === 'reactivos' ? 'Seleccionar reactivos' : 'Seleccionar materiales'}
        kicker={materialPicker === 'reactivos' ? 'Reactivos' : 'Materiales'}
        initialCategory={materialPicker === 'reactivos' ? 'Reactivos' : ''}
        selected={builder.materials}
        onChange={(next) => setBuilder((prev) => ({ ...prev, materials: next }))}
      />

      <EquipmentPickerModal
        open={equipmentPickerOpen}
        onClose={() => setEquipmentPickerOpen(false)}
        selected={builder.equipment}
        onChange={(next) => setBuilder((prev) => ({ ...prev, equipment: next }))}
      />
    </section>
  )
}

export default TeacherClassesPage
