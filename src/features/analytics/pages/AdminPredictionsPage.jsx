import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronRight,
  Database,
  FlaskConical,
  Minus,
  PackageX,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { getPredictionsOverview, getSupplyForecast } from '../services/predictionsService'
import ForecastChart from '../components/ForecastChart'
import LabForecastPanel from '../components/LabForecastPanel'
import './AdminLabAnalyticsPage.css'
import './AdminPredictionsPage.css'

const ALERT_META = {
  red: { label: 'Critico', className: 'pred-chip pred-chip-red', color: '#b91c1c' },
  yellow: { label: 'En riesgo', className: 'pred-chip pred-chip-yellow', color: '#b45309' },
  green: { label: 'Saludable', className: 'pred-chip pred-chip-green', color: '#15803d' },
}

const TREND_META = {
  up: { label: 'En aumento', Icon: TrendingUp, color: '#b91c1c' },
  down: { label: 'A la baja', Icon: TrendingDown, color: '#15803d' },
  flat: { label: 'Estable', Icon: Minus, color: '#64748b' },
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function hourRange(hour) {
  return `${pad2(hour)}:00–${pad2((hour + 1) % 24)}:00`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
}

function StockBar({ quantity, minimum, color }) {
  const scale = Math.max(quantity, minimum, 1) * 1.1
  const fill = Math.min(100, (quantity / scale) * 100)
  const marker = Math.min(100, (minimum / scale) * 100)
  return (
    <div className="pred-stockbar" title={`Stock ${quantity} · minimo ${minimum}`}>
      <div className="pred-stockbar-fill" style={{ width: `${fill}%`, background: color }} />
      {minimum > 0 ? <div className="pred-stockbar-min" style={{ left: `${marker}%` }} /> : null}
    </div>
  )
}

export default function AdminPredictionsPage() {
  const [overview, setOverview] = useState(null)
  const [requestState, setRequestState] = useState({ loading: true, error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [onlyRisk, setOnlyRisk] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSupply, setSelectedSupply] = useState(null)

  useEffect(() => {
    let active = true
    getPredictionsOverview()
      .then((data) => {
        if (active) {
          setOverview(data)
          setRequestState({ loading: false, error: '' })
          setRefreshing(false)
        }
      })
      .catch((err) => {
        if (active) {
          setRequestState({ loading: false, error: err?.message || 'No se pudo cargar el panorama' })
          setRefreshing(false)
        }
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const labsForPanel = useMemo(
    () =>
      (overview?.laboratories || []).map((lab) => ({
        laboratory_id: lab.laboratory_id,
        laboratory_name: lab.name,
      })),
    [overview],
  )

  const visibleSupplies = useMemo(() => {
    let supplies = overview?.supplies || []
    if (onlyRisk) supplies = supplies.filter((row) => row.alert_level !== 'green')
    const term = search.trim().toLowerCase()
    if (term) supplies = supplies.filter((row) => row.name.toLowerCase().includes(term))
    return supplies
  }, [overview, onlyRisk, search])

  if (requestState.loading) {
    return (
      <section className="analytics-page" aria-busy="true">
        <div className="pred-skeleton-header" />
        <div className="pred-kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pred-skeleton-card" />
          ))}
        </div>
        <div className="pred-skeleton-block" />
      </section>
    )
  }

  if (requestState.error) {
    return (
      <section className="analytics-page">
        <div className="pred-error">
          <AlertTriangle size={18} />
          <span>{requestState.error}</span>
          <button type="button" className="infra-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Reintentar
          </button>
        </div>
      </section>
    )
  }

  if (!overview) {
    return null
  }

  const dq = overview.data_quality
  const discarded = dq.invalid_date + dq.out_of_window + dq.duplicates

  const peakHours = overview.peak_hours || []
  const weekdayUsage = overview.weekday_usage || []
  const maxHour = Math.max(1, ...peakHours.map((h) => h.occupied_hours))
  const maxWeekday = Math.max(1, ...weekdayUsage.map((w) => w.occupied_hours))
  const topHours = [...peakHours].sort((a, b) => b.occupied_hours - a.occupied_hours).filter((h) => h.occupied_hours > 0).slice(0, 6)
  const hasUsage = peakHours.some((h) => h.occupied_hours > 0)

  const triggerRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  return (
    <section className="analytics-page" aria-label="Predicciones con IA">
      <header className="analytics-header pred-header">
        <div className="analytics-header-copy">
          <p className="analytics-kicker">
            <Sparkles size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Inteligencia predictiva
          </p>
          <h2>Predicciones de demanda y desabastecimiento</h2>
          <p>
            Anticipa que laboratorios se saturaran y que insumos se agotaran antes de tiempo. Las cifras
            resumen el panorama; los graficos muestran la tendencia historica frente a la prediccion del modelo.
          </p>
        </div>
        <div className="pred-header-actions">
          <span className="pred-updated">Actualizado: {formatDateTime(overview.generated_at)}</span>
          <button type="button" className="pred-refresh" onClick={triggerRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'pred-spin' : ''} />
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {/* KPIs: los datos importantes de un vistazo */}
      <div className="pred-kpi-grid">
        <article className={`pred-kpi ${overview.supplies_at_risk > 0 ? 'pred-kpi--danger' : 'pred-kpi--ok'}`}>
          <span className="pred-kpi-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <AlertTriangle size={18} />
          </span>
          <div>
            <strong>{overview.supplies_at_risk}</strong>
            <small>de {overview.supplies_total} insumos en riesgo</small>
          </div>
        </article>
        <article className={`pred-kpi ${overview.soonest_depletion_days != null ? 'pred-kpi--warn' : 'pred-kpi--ok'}`}>
          <span className="pred-kpi-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <PackageX size={18} />
          </span>
          <div>
            <strong>
              {overview.soonest_depletion_days != null ? `~${overview.soonest_depletion_days} dias` : 'Sin riesgo'}
            </strong>
            <small>{overview.soonest_depletion_name || 'proximo agotamiento'}</small>
          </div>
        </article>
        <article className="pred-kpi pred-kpi--info">
          <span className="pred-kpi-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <FlaskConical size={18} />
          </span>
          <div>
            <strong>{overview.busiest_lab_name || 'Sin datos'}</strong>
            <small>{formatNumber(overview.busiest_lab_hours)} h/dia proyectado (lab mas exigido)</small>
          </div>
        </article>
        <article className="pred-kpi pred-kpi--ok">
          <span className="pred-kpi-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <Database size={18} />
          </span>
          <div>
            <strong>
              {dq.used_records}/{dq.total_records}
            </strong>
            <small>registros usados tras limpieza</small>
          </div>
        </article>
      </div>

      {/* Tabla rankeada de riesgo de insumos */}
      <section className="analytics-panel">
        <div className="analytics-panel-header">
          <div>
            <h3>Riesgo de desabastecimiento por insumo</h3>
            <p className="analytics-panel-subtitle">
              Ordenado por urgencia. Haz clic en una fila para ver el detalle de demanda proyectada.
            </p>
          </div>
          <div className="pred-toolbar">
            <span className="pred-search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Buscar material…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
            <button type="button" className="infra-secondary" onClick={() => setOnlyRisk((prev) => !prev)}>
              {onlyRisk ? 'Ver todos' : 'Solo en riesgo'}
            </button>
          </div>
        </div>

        <div className="pred-table-wrap">
          <table className="pred-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Material</th>
                <th>Nivel de stock</th>
                <th>Demanda diaria</th>
                <th>Dias restantes</th>
                <th>Confianza</th>
                <th aria-label="Detalle" />
              </tr>
            </thead>
            <tbody>
              {visibleSupplies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="pred-empty">
                    {search ? 'Sin coincidencias para tu busqueda.' : 'No hay insumos en riesgo segun la prediccion actual.'}
                  </td>
                </tr>
              ) : (
                visibleSupplies.map((row) => {
                  const meta = ALERT_META[row.alert_level] || ALERT_META.green
                  const isSelected = selectedSupply?.id === row.stock_item_id
                  return (
                    <tr
                      key={row.stock_item_id}
                      className={isSelected ? 'pred-row is-selected' : 'pred-row'}
                      onClick={() => setSelectedSupply({ id: row.stock_item_id, name: row.name })}
                    >
                      <td>
                        <span className={meta.className}>
                          <span className="pred-dot" style={{ background: meta.color }} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="pred-name">{row.name}</td>
                      <td className="pred-stock-cell">
                        <StockBar quantity={row.quantity_available} minimum={row.minimum_stock} color={meta.color} />
                        <small>
                          {formatNumber(row.quantity_available, 0)} {row.unit} · min {formatNumber(row.minimum_stock, 0)}
                        </small>
                      </td>
                      <td>
                        {formatNumber(row.avg_daily_demand, 2)} {row.unit}/dia
                      </td>
                      <td>
                        <strong style={{ color: meta.color }}>
                          {row.projected_days_remaining != null ? `~${row.projected_days_remaining} d` : '—'}
                        </strong>
                      </td>
                      <td>
                        <span className={`pred-confidence ${row.confidence === 'low' ? 'is-low' : 'is-high'}`}>
                          {row.confidence === 'low' ? 'Baja' : 'Alta'}
                        </span>
                      </td>
                      <td className="pred-chevron">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedSupply ? (
          <div className="pred-detail">
            <div className="pred-detail-head">
              <h4>Demanda proyectada · {selectedSupply.name}</h4>
              <button type="button" className="pred-detail-close" onClick={() => setSelectedSupply(null)} aria-label="Cerrar detalle">
                <X size={16} />
              </button>
            </div>
            <SupplyDetailChart stockItemId={selectedSupply.id} />
          </div>
        ) : null}
      </section>

      {/* Resumen por laboratorio: carga promedio + tendencia */}
      {overview.laboratories.length > 0 ? (
        <section className="analytics-panel">
          <div className="analytics-panel-header">
            <div>
              <h3>Resumen por laboratorio</h3>
              <p className="analytics-panel-subtitle">
                Carga promedio reciente y tendencia de demanda (ventana {overview.window_days} dias).
              </p>
            </div>
          </div>
          <div className="pred-lab-grid">
            {overview.laboratories.map((lab) => {
              const trend = TREND_META[lab.recent_trend] || TREND_META.flat
              const TrendIcon = trend.Icon
              return (
                <div key={lab.laboratory_id} className="pred-lab-card">
                  <strong>{lab.name}</strong>
                  <span className="pred-lab-hours">{formatNumber(lab.avg_daily_hours)} h/dia</span>
                  <span className="pred-trend" style={{ color: trend.color }}>
                    <TrendIcon size={14} /> {trend.label}
                  </span>
                  <small>{lab.active_days} dias con uso</small>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Horarios y dias de mayor uso: la estacionalidad que aprende la red neuronal */}
      {hasUsage ? (
        <section className="analytics-panel">
          <div className="analytics-panel-header">
            <div>
              <h3>Horarios y dias de mayor uso</h3>
              <p className="analytics-panel-subtitle">
                Frecuencia historica de ocupacion (ventana {overview.window_days} dias). Estos patrones
                de hora y dia de semana son precisamente los que la red neuronal usa como variables.
              </p>
            </div>
          </div>

          <div className="pred-usage-grid">
            <div className="pred-usage-col">
              <h4>Distribucion por hora del dia</h4>
              <div className="pred-hours-bars">
                {peakHours.map((slot) => {
                  const height = Math.max(3, (slot.occupied_hours / maxHour) * 100)
                  const isTop = topHours.slice(0, 3).some((h) => h.hour === slot.hour)
                  return (
                    <div key={slot.hour} className="pred-hour-bar" title={`${hourRange(slot.hour)} · ${formatNumber(slot.occupied_hours)} h (${slot.percentage}%)`}>
                      <span className="pred-hour-fill" style={{ height: `${height}%`, background: isTop ? '#1d4ed8' : '#93c5fd' }} />
                      {slot.hour % 3 === 0 ? <small>{pad2(slot.hour)}</small> : <small>&nbsp;</small>}
                    </div>
                  )
                })}
              </div>

              <table className="pred-table pred-hours-table">
                <thead>
                  <tr>
                    <th>Franja horaria</th>
                    <th>Horas usadas</th>
                    <th>% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {topHours.map((slot, index) => (
                    <tr key={slot.hour}>
                      <td>
                        {index === 0 ? <span className="pred-rank">1º</span> : null} {hourRange(slot.hour)}
                      </td>
                      <td>{formatNumber(slot.occupied_hours)} h</td>
                      <td>{slot.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pred-usage-col">
              <h4>Dias de la semana mas usados</h4>
              <div className="pred-weekday-list">
                {weekdayUsage.map((day) => (
                  <div key={day.weekday} className="pred-weekday-row">
                    <span className="pred-weekday-name">{day.label}</span>
                    <span className="pred-weekday-track">
                      <span
                        className="pred-weekday-fill"
                        style={{ width: `${Math.max(2, (day.occupied_hours / maxWeekday) * 100)}%` }}
                      />
                    </span>
                    <span className="pred-weekday-value">{formatNumber(day.occupied_hours)} h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Pronostico de ocupacion por laboratorio (grafico) */}
      <LabForecastPanel labs={labsForPanel} />

      {/* Limpieza de datos */}
      <section className="analytics-panel">
        <div className="analytics-panel-header">
          <div>
            <h3>
              <Database size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Limpieza de datos
            </h3>
            <p className="analytics-panel-subtitle">
              Antes de entrenar, el ETL descarta registros inconsistentes y recorta valores atipicos para que las
              predicciones no se distorsionen. Ventana analizada: {overview.window_days} dias.
            </p>
          </div>
        </div>
        <div className="pred-dq-grid">
          <div className="pred-dq-item"><strong>{dq.total_records}</strong><small>registros leidos</small></div>
          <div className="pred-dq-item"><strong>{dq.used_records}</strong><small>usados para el modelo</small></div>
          <div className="pred-dq-item"><strong>{dq.excluded_status}</strong><small>excluidos por estado</small></div>
          <div className="pred-dq-item"><strong>{discarded}</strong><small>descartados (fecha/duplicado/fuera de rango)</small></div>
          <div className="pred-dq-item"><strong>{dq.outliers_capped}</strong><small>dias con picos atipicos recortados</small></div>
        </div>
      </section>
    </section>
  )
}

function SupplyDetailChart({ stockItemId }) {
  const [result, setResult] = useState({ id: null, error: '', data: null })

  useEffect(() => {
    let active = true
    getSupplyForecast(stockItemId)
      .then((data) => {
        if (active) setResult({ id: stockItemId, error: '', data })
      })
      .catch((err) => {
        if (active) setResult({ id: stockItemId, error: err?.message || 'No disponible', data: null })
      })
    return () => {
      active = false
    }
  }, [stockItemId])

  const loading = result.id !== stockItemId
  if (loading) {
    return <p className="module-loading">Calculando demanda…</p>
  }
  if (result.error || !result.data) {
    return <p style={{ color: '#b91c1c' }}>{result.error || 'Sin datos'}</p>
  }

  const data = result.data
  const projectedEnd = data.forecast.length ? data.forecast[data.forecast.length - 1].projected_stock : data.quantity_available
  const demandForecast = data.forecast.map((point) => ({ date: point.date, value: point.predicted_demand }))

  return (
    <div>
      <div className="pred-detail-stats">
        <div className="pred-stat">
          <small>Dias restantes</small>
          <strong>{data.projected_days_remaining != null ? `~${data.projected_days_remaining}` : 'sin riesgo'}</strong>
        </div>
        <div className="pred-stat">
          <small>Stock al fin del horizonte</small>
          <strong>{formatNumber(projectedEnd, 0)} {data.unit}</strong>
        </div>
        <div className="pred-stat">
          <small>Modelo</small>
          <strong>
            {data.model === 'mlp_regressor' ? 'Red neuronal' : 'Base'}
            {data.confidence === 'low' ? ' · baja confianza' : ''}
          </strong>
        </div>
      </div>
      <ForecastChart history={data.history} forecast={demandForecast} valueSuffix={`${data.unit || 'unidades'}/dia`} />
    </div>
  )
}
