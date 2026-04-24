import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
 
} from 'recharts'
// Inline simple heatmap renderer to avoid external export mismatches
function SimpleHeatmap({ xLabels, yLabels, values, cellWidth = 48, cellHeight = 30, maxVisibleRows = 6 }) {
  const [showAll, setShowAll] = useState(false)
  if (!xLabels || !yLabels || !values) return null

  const totalRows = yLabels.length

  // compute totals per row (hour)
  const rowTotals = values.map((row) => Array.isArray(row) ? row.reduce((a, b) => a + (Number(b) || 0), 0) : 0)

  let displayY = yLabels
  let displayValues = values
  let note = null

  if (!showAll && totalRows > maxVisibleRows) {
    // pick top N rows by total
    const indices = rowTotals
      .map((val, idx) => ({ val, idx }))
      .sort((a, b) => b.val - a.val)
      .slice(0, maxVisibleRows)
      .map((o) => o.idx)

    // order by descending importance
    indices.sort((a, b) => rowTotals[b] - rowTotals[a])
    displayY = indices.map((i) => yLabels[i])
    displayValues = indices.map((i) => values[i])
    note = `Mostrando ${Math.min(maxVisibleRows, totalRows)} de ${totalRows} horas (más demandadas)`
  }

  const flat = displayValues.reduce((acc, row) => acc.concat(Array.isArray(row) ? row : []), [])
  const max = flat.length ? Math.max(...flat) : 0

  return (
    <div className="simple-heatmap" style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-700)' }}>{note || `Horas: ${totalRows}`}</div>
        {totalRows > maxVisibleRows && (
          <button className="heatmap-toggle" onClick={() => setShowAll(!showAll)}>{showAll ? `Ver top ${maxVisibleRows}` : 'Ver todo'}</button>
        )}
      </div>

      <div style={{ display: 'flex', marginBottom: 8 }}>
        <div style={{ width: 60 }} />
        <div style={{ display: 'flex' }}>
          {xLabels.map((xl, i) => (
            <div key={i} style={{ minWidth: cellWidth, textAlign: 'center', fontSize: 11, padding: '0 4px' }}>{xl}</div>
          ))}
        </div>
      </div>

      <div>
        {displayY.map((yl, r) => (
          <div key={r} style={{ display: 'flex', marginBottom: 6 }}>
            <div style={{ width: 60, textAlign: 'right', paddingRight: 8, fontSize: 12 }}>{yl}</div>
            <div style={{ display: 'flex' }}>
              {xLabels.map((xl, c) => {
                const val = (displayValues[r] && displayValues[r][c]) || 0
                const alpha = max ? Math.min(1, 0.12 + (val / max) * 0.88) : 0
                const bg = `rgba(18,85,160,${alpha})`
                const color = alpha > 0.45 ? '#fff' : 'var(--ink-900)'
                return (
                  <div
                    key={c}
                    title={`${val} reservas — ${yl} · ${xl}`}
                    style={{ minWidth: cellWidth, width: cellWidth, height: cellHeight, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 11, borderRadius: 4, marginRight: 4 }}
                  >
                    {val || ''}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="heatmap-legend">
        <div className="heatmap-scale">0</div>
        <div className="heatmap-gradient" aria-hidden="true" />
        <div className="heatmap-scale">{max}</div>
      </div>
    </div>
  )
}
import './ReservationsAnalytics.css'
import { listReservations, getOccupancyDashboard, getReservationStatsHourly, getReservationStatsTopSlots, getReservationStatsHeatmap } from '../services/reservationsService'

const MOCK_RESERVATIONS = (() => {
  // generate synthetic reservations across hours 8-20 with peaks at 10 and 15
  const items = []
  const labs = ['Lab A', 'Lab B', 'Lab C']
  for (let d = 0; d < 14; d++) {
    const day = new Date()
    day.setDate(day.getDate() - d)
    const isoDate = day.toISOString().slice(0, 10)
    for (let h = 8; h <= 20; h++) {
      // base frequency
      let freq = Math.max(0, Math.round(3 + Math.sin(h / 2) * 2))
      // add peaks
      if (h === 10 || h === 15) freq += 6
      for (let i = 0; i < freq; i++) {
        items.push({
          id: `${isoDate}-${h}-${i}`,
          date: isoDate,
          start_time: `${String(h).padStart(2, '0')}:00`,
          end_time: `${String(h + 1).padStart(2, '0')}:00`,
          laboratory_name: labs[Math.floor(Math.random() * labs.length)],
        })
      }
    }
  }
  return items
})()

function buildHourlyData(reservations, startHour = 0, endHour = 23) {
  const hours = []
  for (let h = startHour; h <= endHour; h++) {
    const label = `${String(h).padStart(2, '0')}:00`
    hours.push({ hour: label, count: 0 })
  }

  reservations.forEach((r) => {
    const hour = Number((r.start_time || '00:00').split(':')[0])
    const idx = Math.min(Math.max(hour - startHour, 0), hours.length - 1)
    hours[idx].count += 1
  })

  return hours
}

function parseHourlyResponse(resp) {
  const payload = resp?.data ?? resp
  if (!payload || !Array.isArray(payload)) return null

  const first = payload[0]
  if (first && typeof first === 'object') {
    const hourKey = ['hour', 'start_time', 'time', 'h'].find((k) => k in first) || Object.keys(first)[0]
    const countKey = ['count', 'value', 'val', 'n', 'qty'].find((k) => k in first) || Object.keys(first).find((k) => k !== hourKey) || 'count'

    const map = new Map()
    payload.forEach((item) => {
      let h = item[hourKey]
      if (typeof h === 'number') h = String(h).padStart(2, '0')
      if (typeof h === 'string') {
        const hh = h.slice(0, 2).padStart(2, '0')
        map.set(hh, Number(item[countKey] || 0))
      }
    })

    const arr = []
    for (let h = 6; h <= 22; h++) {
      const label = `${String(h).padStart(2, '0')}:00`
      const key = String(h).padStart(2, '0')
      arr.push({ hour: label, count: map.has(key) ? map.get(key) : 0 })
    }

    return arr
  }

  return null
}

function parseHeatmapResponse(resp) {
  const payload = resp?.data ?? resp
  if (!payload) return null

  // matrix form: [[...]] with x/y labels provided separately
  if (Array.isArray(payload) && payload.length > 0) {
    if (Array.isArray(payload[0]) && typeof payload[0][0] === 'number') {
      const xLabels = resp?.x_labels || resp?.xLabels || resp?.x || []
      const yLabels = resp?.y_labels || resp?.yLabels || resp?.y || []
      return { xLabels, yLabels, values: payload }
    }

    const first = payload[0]
    if (first && typeof first === 'object') {
      const potentialDateKeys = ['date', 'day', 'x', 'd', 'label']
      const potentialHourKeys = ['hour', 'time', 'y', 'h', 'start_time']
      const potentialCountKeys = ['count', 'value', 'val', 'c', 'n', 'qty']

      const dateKey = potentialDateKeys.find((k) => k in first)
      const hourKey = potentialHourKeys.find((k) => k in first)
      const countKey = potentialCountKeys.find((k) => k in first)

      if (dateKey && hourKey && countKey) {
        const xLabels = Array.from(new Set(payload.map((it) => it[dateKey]))).sort()
        const yLabels = Array.from(new Set(payload.map((it) => it[hourKey]))).sort()
        const values = yLabels.map((y) => xLabels.map((x) => {
          const found = payload.find((it) => it[dateKey] === x && it[hourKey] === y)
          return found ? Number(found[countKey] || 0) : 0
        }))
        return { xLabels, yLabels, values }
      }
    }
  }

  return null
}

function buildHeatmapHoursVsLabs(reservations = [], startHour = 6, endHour = 22, maxLabs = 12) {
  // Build heatmap matrix with rows = hours, columns = laboratories
  const yLabels = []
  for (let h = startHour; h <= endHour; h++) {
    yLabels.push(`${String(h).padStart(2, '0')}:00`)
  }

  const labCounts = {}
  reservations.forEach((r) => {
    const lab = String(r.laboratory_name || r.laboratory_id || 'Desconocido')
    labCounts[lab] = (labCounts[lab] || 0) + 1
  })

  let xLabels = Object.keys(labCounts)
  // sort by frequency desc, then name
  xLabels.sort((a, b) => (labCounts[b] - labCounts[a]) || a.localeCompare(b))
  if (xLabels.length === 0) xLabels = ['Sin datos']
  if (xLabels.length > maxLabs) xLabels = xLabels.slice(0, maxLabs)

  const values = yLabels.map((y) => {
    const hour = Number(y.slice(0, 2))
    return xLabels.map((lab) => (
      reservations.reduce((acc, r) => {
        const rHour = Number(String((r.start_time || '00:00').split(':')[0]))
        const rLab = String(r.laboratory_name || r.laboratory_id || 'Desconocido')
        if (rHour === hour && rLab === lab) return acc + 1
        return acc
      }, 0)
    ))
  })

  return { xLabels, yLabels, values }
}

export default function ReservationsAnalytics({ laboratoryId = '', initialRange = { days: 14 } }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reservations, setReservations] = useState([])
  const [heatmap, setHeatmap] = useState(null)
  const [occupancy, setOccupancy] = useState(null)
  const [hourlyData, setHourlyData] = useState(null)
  const [hourlyLoading, setHourlyLoading] = useState(false)
  const [rangeDays, setRangeDays] = useState(initialRange?.days || 14)
  const useMockEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_USE_MOCK : undefined
  const useMock = useMockEnv === 'true' || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'development')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    if (useMock) {
      // small delay to mimic network
      setTimeout(() => {
        if (!active) return
        setReservations(MOCK_RESERVATIONS)
        setHeatmap(buildHeatmapHoursVsLabs(MOCK_RESERVATIONS))
        setOccupancy({ current_occupancy: 12, lab_breakdown: [{ laboratory_id: '1', occupancy_count: 4 }] })
        setLoading(false)
      }, 300)
      return
    }

    // Prefer stats endpoint for hourly distribution when available
    getReservationStatsHourly({ laboratory_id: laboratoryId })
      .then((data) => {
        if (!active) return
        if (data && Array.isArray(data.data)) {
          // transform to local reservations-like items for existing ui
          const derived = data.data.map((item, idx) => ({ id: `h-${idx}`, start_time: item.hour, date: data.from || '', laboratory_name: data.laboratory_id || '' }))
          setReservations(derived)
        }
      })
      .catch(() => {
        // fallback to listing reservations
        listReservations({ laboratory_id: laboratoryId }).then((resList) => {
          if (!active) return
          setReservations(Array.isArray(resList) ? resList : [])
        }).catch(() => {})
      })

    getOccupancyDashboard(laboratoryId).then((occ) => {
      if (!active) return
      setOccupancy(occ)
      setLoading(false)
    }).catch((err) => {
      if (!active) return
      setError(err?.message || 'No se pudo cargar datos analíticos')
      setLoading(false)
    })

    // Fetch heatmap stats when available
    getReservationStatsHeatmap({ laboratory_id: laboratoryId }).then((data) => {
      if (!active) return
      const parsed = parseHeatmapResponse(data)
      if (parsed) setHeatmap(parsed)
    }).catch(() => {
      // ignore heatmap errors
    })

    return () => { active = false }
  }, [laboratoryId])

  const hourly = useMemo(() => {
    if (Array.isArray(hourlyData) && hourlyData.length) return hourlyData
    return buildHourlyData(reservations, 6, 22)
  }, [hourlyData, reservations])

  const enhancedHourly = useMemo(() => {
    const data = Array.isArray(hourly) ? [...hourly] : []
    const topN = 3
    const sorted = [...data].sort((a, b) => b.count - a.count)
    const topSet = new Set(sorted.slice(0, topN).map((d) => d.hour))
    return data.map((d) => ({ ...d, isPeak: topSet.has(d.hour), label: topSet.has(d.hour) ? String(d.count) : '' }))
  }, [hourly])

  useEffect(() => {
    if (!Array.isArray(reservations) || reservations.length === 0) return
    const computed = buildHeatmapHoursVsLabs(reservations)
    if (computed) setHeatmap(computed)
  }, [reservations])

  useEffect(() => {
    let active = true
    setHourlyLoading(true)

    const toDate = new Date()
    const fromDate = new Date()
    fromDate.setDate(toDate.getDate() - Math.max(0, (Number(rangeDays) || 14) - 1))
    const from = fromDate.toISOString().slice(0, 10)
    const to = toDate.toISOString().slice(0, 10)

    getReservationStatsHourly({ laboratory_id: laboratoryId, from, to })
      .then((data) => {
        if (!active) return
        const parsed = parseHourlyResponse(data)
        if (parsed) {
          setHourlyData(parsed)
        } else {
          // fallback to deriving from reservations
          setHourlyData(buildHourlyData(reservations, 6, 22))
        }
      })
      .catch(() => {
        if (!active) return
        setHourlyData(buildHourlyData(reservations, 6, 22))
      })
      .finally(() => {
        if (!active) return
        setHourlyLoading(false)
      })

    return () => { active = false }
  }, [laboratoryId, rangeDays, reservations])

  if (loading) return <div className="reservations-analytics">Cargando estadísticas...</div>
  if (error) return <div className="reservations-analytics error">{error}</div>

  return (
    <section className="reservations-analytics">
      <header>
        <h4>Estadísticas de uso</h4>
        <p className="muted">Distribución por hora y ocupación actual.</p>
      </header>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h5>Horas más frecuentes</h5>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourly} margin={{ top: 8, right: 12, left: -8, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpactiy={0.06} />
              <XAxis dataKey="hour" tick={{ fill: 'var(--ink-700)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--ink-700)', fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1255a0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        

        <div className="analytics-card heatmap-card">
          <h5>Mapa de calor</h5>
          {heatmap && heatmap.xLabels && heatmap.yLabels ? (
            <div style={{ width: '100%', height: 260 }}>
              <SimpleHeatmap xLabels={heatmap.xLabels} yLabels={heatmap.yLabels} values={heatmap.values} />
            </div>
          ) : (
            <div className="muted">No hay datos de heatmap.</div>
          )}
        </div>
      </div>
    </section>
  )
}
