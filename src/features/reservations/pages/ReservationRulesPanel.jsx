import { useEffect, useState } from 'react'
import { createLabBlock, deleteLabBlock, listLabBlocks } from '../services/reservationsService'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import { formatDateTime } from '../../../shared/utils/formatters'

const emptyForm = { laboratory_id: '', start_at: '', end_at: '', block_type: 'maintenance', reason: '' }

export default function ReservationRulesPanel({ labs }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [removing, setRemoving] = useState(null)
  const refresh = async () => setRows(await listLabBlocks())
  useEffect(() => { refresh().catch((err) => setError(err.message)) }, [])
  const save = async (event) => {
    event.preventDefault()
    if (form.end_at <= form.start_at) { setError('El fin debe ser posterior al inicio.'); return }
    setPending(true)
    setError('')
    try {
      await createLabBlock({ ...form, start_at: `${form.start_at}:00`, end_at: `${form.end_at}:00`, is_active: true })
      setForm(emptyForm)
      await refresh()
    } catch (err) { setError(err.message) } finally { setPending(false) }
  }
  return <section className="reservations-card">
    <h3>Reglas y bloqueos de disponibilidad</h3>
    <p>Impide nuevas reservas durante mantenimiento, eventos u otros periodos no disponibles.</p>
    {error ? <p className="reservations-alert error" role="alert">{error}</p> : null}
    <form className="reservations-form" onSubmit={save}>
      <div className="reservations-form-grid">
        <label>Laboratorio<select required value={form.laboratory_id} onChange={(e) => setForm({ ...form, laboratory_id: e.target.value })}><option value="">Seleccionar</option>{labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}</select></label>
        <label>Inicio<input required type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></label>
        <label>Fin<input required type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></label>
        <label>Tipo<select value={form.block_type} onChange={(e) => setForm({ ...form, block_type: e.target.value })}><option value="maintenance">Mantenimiento</option><option value="event">Evento</option><option value="holiday">Feriado</option><option value="other">Otro</option></select></label>
        <label>Motivo<input required maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
      </div>
      <button className="reservations-primary" disabled={pending}>Crear bloqueo</button>
    </form>
    {rows.length ? rows.map((row) => <article key={row.id} className="reservations-card">
      <strong>{labs.find((lab) => lab.id === row.laboratory_id)?.name || row.laboratory_id}</strong>
      <p>{formatDateTime(row.start_at)} — {formatDateTime(row.end_at)}</p><p>{row.reason}</p>
      <button className="reservations-danger" onClick={() => setRemoving(row)}>Eliminar bloqueo</button>
    </article>) : <p>No hay bloqueos registrados.</p>}
    {removing ? <ConfirmModal title="Eliminar bloqueo" message="El periodo volvera a estar disponible para nuevas reservas." onCancel={() => setRemoving(null)} onConfirm={async () => {
      try { await deleteLabBlock(removing.id); setRemoving(null); await refresh() } catch (err) { setError(err.message); setRemoving(null) }
    }} /> : null}
  </section>
}
