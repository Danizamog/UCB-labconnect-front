import { useEffect, useState } from 'react'
import { getWeeklyClassAvailability } from '../../admin/services/labSchedulesService'
import { subscribeReservationsRealtime } from '../services/reservationsService'
import './WeeklySchedulePicker.css'

function isWeeklyRangeAvailable(start, end, availability) {
  if (!availability || !start || !end || end <= start) return false
  if (!availability.slots.some((slot) => slot.start_time === start && slot.state === 'available')) return false
  if (!availability.slots.some((slot) => slot.end_time === end && slot.state === 'available')) return false
  return !availability.blocked_ranges.some((range) => start < range.end_time && range.start_time < end)
}

export default function WeeklySchedulePicker({ laboratoryId, weekday, excludeId = '', startTime, endTime, onChange, onValidityChange }) {
  const [result, setResult] = useState(null)
  const [revision, setRevision] = useState(0)
  const key = `${laboratoryId}:${weekday}:${excludeId}:${revision}`
  const current = result?.key === key ? result : null
  const availability = current?.data
  const valid = isWeeklyRangeAvailable(startTime, endTime, availability)

  useEffect(() => {
    if (!laboratoryId) return
    let cancelled = false
    getWeeklyClassAvailability({ laboratory_id: laboratoryId, weekday, exclude_id: excludeId })
      .then((data) => {
        if (!Array.isArray(data?.slots) || !Array.isArray(data?.blocked_ranges)) throw new Error('No se pudo verificar la disponibilidad.')
        if (!cancelled) setResult({ key, data })
      })
      .catch((error) => { if (!cancelled) setResult({ key, error: error.message }) })
    return () => { cancelled = true }
  }, [key, laboratoryId, weekday, excludeId])

  useEffect(() => {
    onValidityChange(valid)
  }, [valid, onValidityChange])

  useEffect(() => subscribeReservationsRealtime(() => setRevision((value) => value + 1), {
    topics: ['lab_schedule', 'lab_reservation', 'tutorial_session', 'lab_block'],
    laboratoryIds: laboratoryId ? [laboratoryId] : [],
    onResync: () => setRevision((value) => value + 1),
  }), [laboratoryId])

  if (!laboratoryId) return <p className="class-composer-help">Selecciona un laboratorio para consultar sus horarios.</p>
  if (!current) return <p role="status">Consultando disponibilidad semanal…</p>
  if (current.error) return <div role="alert"><p>{current.error}</p><button type="button" onClick={() => setRevision((value) => value + 1)}>Volver a consultar</button></div>

  const slots = availability.slots
  const freeSlots = slots.filter((slot) => slot.state === 'available')
  return <div className="weekly-schedule-picker">
    <p className="class-composer-help">Elige el inicio y el fin de tu clase semanal. Los bloques ocupados no se pueden seleccionar.</p>
    <div className="class-time-fields">
      <label>Desde<select aria-label="Hora de inicio" value={freeSlots.some((slot) => slot.start_time === startTime) ? startTime : ''} required onChange={(event) => {
        const start = event.target.value
        const slot = freeSlots.find((entry) => entry.start_time === start)
        onChange({ start_time: start, end_time: isWeeklyRangeAvailable(start, endTime, availability) ? endTime : slot?.end_time || '' })
      }}><option value="">Selecciona</option>{freeSlots.map((slot) => <option key={slot.start_time} value={slot.start_time}>{slot.start_time}</option>)}</select></label>
      <span aria-hidden="true">—</span>
      <label>Hasta<select aria-label="Hora de fin" value={valid ? endTime : ''} required disabled={!startTime} onChange={(event) => onChange({ start_time: startTime, end_time: event.target.value })}>
        <option value="">Selecciona</option>{freeSlots.filter((slot) => isWeeklyRangeAvailable(startTime, slot.end_time, availability)).map((slot) => <option key={slot.end_time} value={slot.end_time}>{slot.end_time}</option>)}
      </select></label>
    </div>
    {freeSlots.length === 0 ? <p role="status">No hay horarios semanales disponibles para este día.</p> : null}
    {startTime && endTime && !valid ? <p role="alert">El rango seleccionado ya no está disponible. Elige otro horario.</p> : null}
    <div className="weekly-slot-grid" aria-label="Bloques del horario semanal">
      {slots.map((slot) => {
        const blocked = slot.state !== 'available'
        const selected = valid && startTime <= slot.start_time && slot.end_time <= endTime
        const conflict = slot.conflict
        const label = blocked ? `${conflict?.label || 'Ocupado'}${conflict?.date ? ` · ${conflict.date}` : ''}` : 'Disponible'
        return <button key={slot.start_time} type="button" disabled={blocked} aria-pressed={selected} title={label}
          onClick={() => onChange({ start_time: slot.start_time, end_time: slot.end_time })}>
          <strong>{slot.start_time}–{slot.end_time}</strong><span>{label}</span>
        </button>
      })}
    </div>
  </div>
}
