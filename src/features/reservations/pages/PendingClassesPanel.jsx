import { useCallback, useEffect, useState } from 'react'
import { WEEKDAYS, listPendingClasses, updateClassApproval } from '../../admin/services/labSchedulesService'

export default function PendingClassesPanel({ labNameById }) {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [reasons, setReasons] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setClasses(await listPendingClasses()) }
    catch (err) { setError(err.message || 'No se pudieron cargar las clases pendientes.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (item, status) => {
    setBusy(item.id); setError(''); setMessage('')
    try {
      await updateClassApproval(item.id, status, reasons[item.id] || '')
      setMessage(status === 'approved' ? 'Clase aprobada. El horario ya está reservado en el laboratorio.' : 'Clase rechazada. El docente podrá consultar el motivo.')
      await load()
    } catch (err) { setError(err.message || 'No se pudo procesar la clase.') }
    finally { setBusy('') }
  }

  return <section className="reservations-panel reservations-panel-priority">
    <div className="reservations-panel-header"><div><h3>Clases pendientes de aprobación</h3><p>Solo el Administrador autoriza estos horarios. La aprobación verifica conflictos y activa la clase.</p></div><button type="button" className="reservations-secondary" disabled={loading || Boolean(busy)} onClick={load}>Actualizar</button></div>
    {error ? <p className="reservations-message error" role="alert">{error}</p> : null}
    {message ? <p className="reservations-message success" role="status">{message}</p> : null}
    {loading ? <p className="reservations-empty">Cargando clases...</p> : classes.length === 0 ? <p className="reservations-empty">No hay clases pendientes.</p> :
      <div className="teacher-class-grid">{classes.map((item) => <article className="reservations-panel" key={item.id}>
        <h4>{item.subject}</h4><p>{item.teacher_name || 'Docente'} · {labNameById[item.laboratory_id] || 'Laboratorio'}</p>
        <p>{WEEKDAYS.find((day) => day.value === item.weekday)?.label} · {item.start_time}–{item.end_time}</p>
        {item.description ? <p>{item.description}</p> : null}
        <label>Motivo de rechazo<textarea maxLength={1000} value={reasons[item.id] || ''} onChange={(event) => setReasons((values) => ({ ...values, [item.id]: event.target.value }))} placeholder="Obligatorio para rechazar" /></label>
        <div className="reservations-actions"><button className="reservations-primary" type="button" disabled={Boolean(busy)} onClick={() => decide(item, 'approved')}>Aprobar clase</button><button className="reservations-secondary" type="button" disabled={Boolean(busy) || !reasons[item.id]?.trim()} onClick={() => decide(item, 'rejected')}>Rechazar</button></div>
      </article>)}</div>}
  </section>
}
