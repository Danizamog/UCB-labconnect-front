import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import { listAdminLabs, listAdminAreas } from '../../admin/services/infrastructureService'
import { 
  listReservations, 
  getOccupancyDashboard, 
  getReservationStatsHourly 
} from '../services/reservationsService'
import './ReservationsAnalytics.css'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildHoursArray() {
  const hours = []
  for (let h = 7; h <= 21; h++) hours.push(`${String(h).padStart(2, '0')}:00`)
  return hours
}

function buildDaysArray(from, to) {
  const days = []
  const start = new Date(from)
  const end = new Date(to)
  const curr = new Date(start)
  let safety = 0
  while (curr <= end && safety < 32) {
    days.push(curr.toISOString().slice(0, 10))
    curr.setDate(curr.getDate() + 1)
    safety++
  }
  return days.length > 0 ? days : [from]
}

function SimpleHeatmap({ xLabels, yLabels, values, cellWidth = 64, cellHeight = 34 }) {
  const [showAll, setShowAll] = useState(false)
  if (!xLabels || !yLabels || !values) return null

  const maxVisibleRows = 10
  const totalRows = yLabels.length
  const rowTotals = values.map((row) => row.reduce((a, b) => a + b, 0))

  let displayY = yLabels
  let displayValues = values
  let note = null

  if (!showAll && totalRows > maxVisibleRows) {
    const indices = rowTotals
      .map((val, idx) => ({ val, idx }))
      .sort((a, b) => b.val - a.val)
      .slice(0, maxVisibleRows)
      .map((o) => o.idx)
    indices.sort((a, b) => a - b)
    displayY = indices.map((i) => yLabels[i])
    displayValues = indices.map((i) => values[i])
    note = `Mostrando top ${maxVisibleRows} horas activas`
  }

  const flat = displayValues.flat()
  const max = Math.max(...flat, 0)

  return (
    <div className="analytics-heatmap-wrapper">
      <div className="heatmap-controls-row">
        <span className="heatmap-info-badge">{note || `Análisis de ${totalRows} franjas`}</span>
        {totalRows > maxVisibleRows && (
          <button className="heatmap-view-toggle" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Ver resumen' : 'Ver todas las horas'}
          </button>
        )}
      </div>

      <div className="heatmap-scroll-container">
        <div className="heatmap-grid-layout">
          <div className="heatmap-header-row">
            <div className="heatmap-label-spacer" />
            <div className="heatmap-column-labels">
              {xLabels.map((xl, i) => (
                <div key={i} className="heatmap-column-tag" style={{ minWidth: cellWidth }}>
                  {xl.includes('-') && xl.length > 8 ? xl.split('-').slice(1).join('/') : xl}
                </div>
              ))}
            </div>
          </div>

          <div className="heatmap-data-body">
            {displayY.map((yl, r) => (
              <div key={r} className="heatmap-data-row">
                <div className="heatmap-row-tag">{yl}</div>
                <div className="heatmap-cell-group">
                  {xLabels.map((xl, c) => {
                    const val = displayValues[r][c] || 0
                    const alpha = max > 0 ? Math.min(1, 0.05 + (val / max) * 0.95) : 0
                    const bg = val > 0 ? `rgba(18, 85, 160, ${alpha})` : 'var(--bg-200)'
                    const color = alpha > 0.45 ? '#fff' : 'var(--ink-700)'
                    return (
                      <div
                        key={c}
                        className={`heatmap-data-cell ${val > 0 ? 'has-data' : 'is-empty'}`}
                        title={`${val} reservas | ${xl} @ ${yl}`}
                        style={{ minWidth: cellWidth, height: cellHeight, background: bg, color }}
                      >
                        {val}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="heatmap-status-bar">
        <div className="heatmap-legend-scale">
          <span className="scale-text">Baja</span>
          <div className="scale-gradient" style={{ background: 'linear-gradient(to right, var(--bg-300), rgba(18, 85, 160, 1))' }} />
          <span className="scale-text">Alta demanda ({max})</span>
        </div>
      </div>
    </div>
  )
}

export default function ReservationsAnalytics({ laboratoryId: initialLabId = '' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [labs, setLabs] = useState([])
  const [areas, setAreas] = useState([])
  const [reservations, setReservations] = useState([])
  const [occupancy, setOccupancy] = useState(null)
  const [hourlyData, setHourlyData] = useState([])
  const [hourlyLoading, setHourlyLoading] = useState(false)
  const [heatmapMode, setHeatmapMode] = useState('days') // 'days' | 'labs' | 'areas'

  const defaultFilters = useMemo(() => ({
    laboratory_id: initialLabId,
    area_id: '',
    from: daysAgoIso(14),
    to: todayIso()
  }), [initialLabId])

  const [filters, setFilters] = useState(defaultFilters)

  const handleClearFilters = () => {
    setFilters(defaultFilters)
    setHeatmapMode('days')
  }

  const loadAllData = useCallback(async () => {
    setHourlyLoading(true)
    setError('')
    try {
      console.group('📊 [Analytics] Sincronización')
      const [labsData, areasData] = await Promise.all([listAdminLabs(), listAdminAreas()])
      setLabs(Array.isArray(labsData) ? labsData : [])
      setAreas(Array.isArray(areasData) ? areasData : [])

      const params = { laboratory_id: filters.laboratory_id, from: filters.from, to: filters.to }
      const [hRaw, oRaw, rList] = await Promise.all([
        getReservationStatsHourly(params),
        getOccupancyDashboard(filters.laboratory_id),
        listReservations({ ...params }) 
      ])

      const positiveStatuses = ['approved', 'confirmed', 'active', 'completed']
      const filteredRes = (Array.isArray(rList) ? rList : []).filter(r => positiveStatuses.includes(r.status))

      console.log('📥 Datos:', { total: rList?.length, analyzable: filteredRes.length })

      const hMap = new Map()
      filteredRes.forEach(r => {
        const hh = (r.start_time || '').slice(0, 2)
        if (hh) hMap.set(hh, (hMap.get(hh) || 0) + 1)
      })
      
      const consistentHourly = buildHoursArray().map(h => ({
        hour: h,
        count: hMap.get(h.slice(0, 2)) || 0
      }))

      setHourlyData(consistentHourly)
      setOccupancy(oRaw)
      setReservations(filteredRes)
      setLoading(false)
      console.groupEnd()
    } catch (err) {
      console.error('❌ Error analíticas:', err)
      setError(err?.message || 'Error al cargar analíticas')
      console.groupEnd()
    } finally {
      setHourlyLoading(false)
    }
  }, [filters, labs.length, areas.length])

  useEffect(() => { loadAllData() }, [loadAllData])

  const heatmapData = useMemo(() => {
    const hours = buildHoursArray()
    let xLabels = []
    
    const activeLabs = filters.laboratory_id ? labs.filter(l => String(l.id) === String(filters.laboratory_id)) : labs
    const activeAreas = filters.area_id ? areas.filter(a => String(a.id) === String(filters.area_id)) : areas

    if (heatmapMode === 'days') xLabels = buildDaysArray(filters.from, filters.to)
    else if (heatmapMode === 'labs') xLabels = activeLabs.map(l => l.name)
    else if (heatmapMode === 'areas') xLabels = activeAreas.map(a => a.name)

    if (xLabels.length === 0) xLabels = ['Sin datos']

    const labToAreaMap = new Map()
    labs.forEach(l => { if (l.area_id) labToAreaMap.set(String(l.id), String(l.area_id)) })

    const matrix = hours.map(h => {
      const hr = h.slice(0, 2)
      return xLabels.map(xl => {
        return reservations.filter(r => {
          if (!(r.start_time || '').startsWith(hr)) return false
          if (heatmapMode === 'days') return r.date === xl
          if (heatmapMode === 'labs') return r.laboratory_name === xl || String(r.laboratory_id) === String(activeLabs.find(l => l.name === xl)?.id)
          if (heatmapMode === 'areas') {
            const targetArea = activeAreas.find(a => a.name === xl)
            const resAreaId = String(r.area_id || labToAreaMap.get(String(r.laboratory_id)) || '')
            return resAreaId === String(targetArea?.id)
          }
          return false
        }).length
      })
    })

    return { xLabels, yLabels: hours, values: matrix }
  }, [heatmapMode, reservations, filters, labs, areas])

  const handleDateChange = (field, value) => {
    setFilters(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'from' && new Date(value) > new Date(next.to)) next.to = value
      if (field === 'to' && new Date(value) < new Date(next.from)) next.from = value
      return next
    })
  }

  const peakHour = useMemo(() => {
    const sorted = [...hourlyData].sort((a, b) => b.count - a.count)
    return sorted[0]?.count > 0 ? sorted[0].hour : 'N/A'
  }, [hourlyData])

  const isFiltered = filters.laboratory_id !== initialLabId || filters.area_id !== '' || filters.from !== daysAgoIso(14) || filters.to !== todayIso()

  if (loading && !hourlyData.length) return <div className="reservations-analytics-loading"><div className="spinner"/></div>

  return (
    <section className="reservations-analytics-v2">
      <header className="analytics-header">
        <div className="analytics-title">
          <h4>Inteligencia de Demanda</h4>
          <p className="muted">Análisis de horas pico y saturación.</p>
        </div>
        <div className="analytics-toolbar">
          <div className="toolbar-group">
            <label><span>Desde</span><input type="date" value={filters.from} onChange={e => handleDateChange('from', e.target.value)}/></label>
            <label><span>Hasta</span><input type="date" value={filters.to} min={filters.from} onChange={e => handleDateChange('to', e.target.value)}/></label>
          </div>
          <div className="toolbar-group">
            <label><span>Laboratorio</span><select value={filters.laboratory_id} onChange={e => setFilters(f => ({...f, laboratory_id: e.target.value}))}><option value="">Todos</option>{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
            <label><span>Área</span><select value={filters.area_id} onChange={e => setFilters(f => ({...f, area_id: e.target.value}))}><option value="">Todas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          </div>
          {isFiltered && (
            <button className="analytics-clear-btn" onClick={handleClearFilters} title="Quitar todos los filtros">✕ Limpiar</button>
          )}
          <button className="analytics-refresh-btn" onClick={loadAllData} disabled={hourlyLoading}>{hourlyLoading ? '...' : '↻'}</button>
        </div>
      </header>

      {error ? <p className="analytics-error-banner">{error}</p> : null}

      <div className="analytics-summary-cards">
        <div className="summary-card"><span className="card-label">Ocupación Actual</span><strong className="card-value">{occupancy?.current_occupancy || 0}</strong><span className="card-hint">Usuarios activos</span></div>
        <div className="summary-card highlight"><span className="card-label">Hora Pico</span><strong className="card-value">{peakHour}</strong><span className="card-hint">Frecuencia máxima</span></div>
        <div className="summary-card"><span className="card-label">Labs con Sesiones</span><strong className="card-value">{occupancy?.lab_breakdown?.length || 0}</strong><span className="card-hint">Salas ocupadas</span></div>
      </div>

      <div className="analytics-main-stack">
        <div className="analytics-chart-container">
          <div className="chart-head"><h5>Distribución Horaria</h5><p>Frecuencia de reservas por franja.</p></div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="hour" tick={{ fill: 'var(--ink-700)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--ink-700)', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry, index) => <Cell key={index} fill={entry.hour === peakHour ? 'var(--primary-600)' : 'var(--primary-300)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-chart-container heatmap-full-width">
          <div className="chart-head">
            <div className="chart-head-with-toggle">
              <div className="chart-titles"><h5>Mapa de Intensidad de Uso</h5><p>Cruza horas vs {heatmapMode === 'days' ? 'Días' : heatmapMode === 'labs' ? 'Laboratorios' : 'Áreas'}.</p></div>
              <div className="heatmap-mode-selector">
                <button className={heatmapMode === 'days' ? 'active' : ''} onClick={() => setHeatmapMode('days')}>Días</button>
                <button className={heatmapMode === 'labs' ? 'active' : ''} onClick={() => setHeatmapMode('labs')}>Labs</button>
                <button className={heatmapMode === 'areas' ? 'active' : ''} onClick={() => setHeatmapMode('areas')}>Áreas</button>
              </div>
            </div>
          </div>
          <div className="chart-body heatmap-isolated-scroll">
            <SimpleHeatmap xLabels={heatmapData.xLabels} yLabels={heatmapData.yLabels} values={heatmapData.values} />
          </div>
        </div>
      </div>
    </section>
  )
}
