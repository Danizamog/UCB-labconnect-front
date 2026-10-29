import { useCallback, useEffect, useState } from 'react'
import { WEEKDAYS, listPendingClasses, updateClassApproval } from '../../admin/services/labSchedulesService'
import { subscribeReservationsRealtime } from '../services/reservationsService'
import './ClassChangeComparison.css'
import './ReservationsPages.css'

function ChangeComparison({ item, labNameById }) {
  const original = item.current_schedule || item.original_snapshot
  if (!original) return null
  const rows = [
    ['Materia', original.subject, item.subject],
    ['Laboratorio', labNameById[original.laboratory_id] || 'Laboratorio', labNameById[item.laboratory_id] || 'Laboratorio'],
    ['Día', WEEKDAYS.find((day) => day.value === original.weekday)?.label, WEEKDAYS.find((day) => day.value === item.weekday)?.label],
    ['Horario', `${original.start_time}–${original.end_time}`, `${item.start_time}–${item.end_time}`],
    ['Descripción', original.description || 'Sin descripción', item.description || 'Sin descripción'],
  ]
  return <div className="class-change-comparison">
    {item.source_changed ? <p role="alert">La clase original cambió o ya no existe. El docente debe actualizar su solicitud antes de aprobarla.</p> : null}
    <table><caption>Clase actual y cambio solicitado</caption><thead><tr><th>Dato</th><th>Actual</th><th>Propuesto</th></tr></thead><tbody>{rows.map(([label, before, after]) => <tr key={label}><th scope="row">{label}</th><td>{before}</td><td>{after}</td></tr>)}</tbody></table>
    <p>El horario actual sigue vigente hasta aprobar esta solicitud.</p>
  </div>
}

export default function PendingClassesPanel({ labNameById, onCountChange }) {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [reasons, setReasons] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const records = await listPendingClasses()
      setClasses(records)
      onCountChange?.(records.length)
      setError('')
    }
    catch (err) { setError(err.message || 'No se pudieron cargar las clases pendientes.') }
    finally { setLoading(false) }
  }, [onCountChange])
  useEffect(() => { load() }, [load])
  useEffect(() => subscribeReservationsRealtime((event) => {
    if (event.topic === 'lab_schedule') load()
  }, { topics: ['lab_schedule'], onResync: load }), [load])

  const decide = async (item, status) => {
    setBusy(item.id); setError(''); setMessage('')
    try {
      await updateClassApproval(item.id, status, reasons[item.id] || '')
      setMessage(status === 'approved' ? (item.original_schedule_id ? 'Cambio aprobado. Se actualizó la clase original.' : 'Clase aprobada. El horario ya está reservado en el laboratorio.') : 'Solicitud rechazada. La clase original, si existe, conserva su horario.')
      await load()
    } catch (err) { setError(err.message || 'No se pudo procesar la clase.') }
    finally { setBusy('') }
  }

  return <section className="reservations-panel reservations-panel-priority">
    <div className="reservations-panel-header"><div><h3>Clases pendientes de aprobación</h3><p>Solo el Administrador autoriza estos horarios. La aprobación verifica conflictos y activa la clase.</p></div><button type="button" className="reservations-secondary" disabled={loading || Boolean(busy)} onClick={load}>Actualizar</button></div>
    {error ? <p className="reservations-message error" role="alert">{error}</p> : null}
    {message ? <p className="reservations-message success" role="status">{message}</p> : null}
    {loading ? <p className="reservations-empty">Cargando clases...</p> : classes.length === 0 ? <p className="reservations-empty">No hay clases pendientes.</p> :
      <div className="class-requests-grid">{classes.map((item) => <article className="reservations-panel class-request-card" key={item.id}>
        <strong>{item.original_schedule_id ? 'Solicitud de cambio' : 'Nueva clase'}</strong>
        <h4>{item.subject}</h4><p>{item.teacher_name || 'Docente'} · {labNameById[item.laboratory_id] || 'Laboratorio'}</p>
        {item.original_schedule_id ? <ChangeComparison item={item} labNameById={labNameById} /> : null}
        <p>{WEEKDAYS.find((day) => day.value === item.weekday)?.label} · {item.start_time}–{item.end_time}</p>
        {item.description ? <p>{item.description}</p> : null}
        <label className="class-rejection-field">Motivo de rechazo<textarea rows={3} maxLength={1000} value={reasons[item.id] || ''} onChange={(event) => setReasons((values) => ({ ...values, [item.id]: event.target.value }))} placeholder="Obligatorio para rechazar" /></label>
        <div className="reservations-actions"><button className="reservations-primary" type="button" disabled={Boolean(busy) || item.source_changed} onClick={() => decide(item, 'approved')}>{item.original_schedule_id ? 'Aprobar cambio' : 'Aprobar clase'}</button><button className="reservations-secondary" type="button" disabled={Boolean(busy) || !reasons[item.id]?.trim()} onClick={() => decide(item, 'rejected')}>Rechazar</button></div>
      </article>)}</div>}
  </section>
}
