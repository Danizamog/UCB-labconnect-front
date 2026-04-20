import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  FlaskConical,
  Gauge,
  LoaderCircle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { getLaboratoryUsageAnalytics } from '../../reservations/services/reservationsService'
import './AdminLabAnalyticsPage.css'

const PERIOD_OPTIONS = [
  {
    id: 'daily',
    label: 'Diario',
    helper: 'Uso acumulado del dia actual.',
    icon: CalendarClock,
  },
  {
    id: 'weekly',
    label: 'Semanal',
    helper: 'Desde el lunes hasta hoy.',
    icon: CalendarRange,
  },
  {
    id: 'monthly',
    label: 'Mensual',
    helper: 'Desde el inicio del mes hasta hoy.',
    icon: CalendarDays,
  },
]

const emptyAnalytics = {
  period: 'daily',
  period_label: '',
  start_date: '',
  end_date: '',
  generated_at: '',
  labs: [],
  totals: {
    laboratories_count: 0,
    available_blocks: 0,
    blocked_blocks: 0,
    used_blocks: 0,
    reserved_blocks: 0,
    in_progress_blocks: 0,
    completed_blocks: 0,
    occupancy_percentage: 0,
  },
  highest_usage_laboratory: null,
  lowest_usage_laboratory: null,
}

function formatDateLabel(value) {
  if (!value) {
    return 'Sin fecha'
  }

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function formatPeriodRange(analytics) {
  if (!analytics?.start_date || !analytics?.end_date) {
    return 'Periodo no disponible'
  }

  if (analytics.start_date === analytics.end_date) {
    return formatDateLabel(analytics.start_date)
  }

  return `${formatDateLabel(analytics.start_date)} - ${formatDateLabel(analytics.end_date)}`
}

function formatPercentage(value) {
  return `${Number(value || 0).toFixed(2)}%`
}

function RankingCard({ title, description, lab, tone = 'neutral', icon: Icon }) {
  return (
    <article className={`analytics-highlight-card tone-${tone}`}>
      <div className="analytics-highlight-head">
        <span className={`analytics-highlight-icon tone-${tone}`}>
          <Icon size={18} />
        </span>
        <div>
          <p>{title}</p>
          <strong>{lab?.laboratory_name || 'Sin registros'}</strong>
        </div>
      </div>
      <div className="analytics-highlight-metric">
        <span>{lab ? formatPercentage(lab.occupancy_percentage) : '0.00%'}</span>
        <small>
          {lab
            ? `${lab.used_blocks} de ${lab.available_blocks} bloques disponibles`
            : description}
        </small>
      </div>
    </article>
  )
}

function LoadingState() {
  return (
    <section className="analytics-panel" aria-label="Cargando estadisticas">
      <div className="analytics-loading-copy">
        <LoaderCircle size={18} className="analytics-loading-spinner" />
        <span>Cargando estadisticas de uso por laboratorio...</span>
      </div>
      <div className="analytics-skeleton-grid">
        <div className="analytics-skeleton-card" />
        <div className="analytics-skeleton-card" />
        <div className="analytics-skeleton-card" />
      </div>
      <div className="analytics-skeleton-list">
        <div className="analytics-skeleton-row" />
        <div className="analytics-skeleton-row" />
        <div className="analytics-skeleton-row" />
      </div>
    </section>
  )
}

function AdminLabAnalyticsPage() {
  const [period, setPeriod] = useState('daily')
  const [analytics, setAnalytics] = useState(emptyAnalytics)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadAnalytics() {
      setIsLoading(true)
      setError('')

      try {
        const response = await getLaboratoryUsageAnalytics(period)
        if (!isMounted) {
          return
        }
        setAnalytics(response)
      } catch (err) {
        if (!isMounted) {
          return
        }
        setAnalytics(emptyAnalytics)
        setError(err.message || 'No se pudieron cargar las estadisticas de uso por laboratorio.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [period])

  const rankedLabs = useMemo(() => (
    Array.isArray(analytics?.labs) ? analytics.labs : []
  ), [analytics])

  return (
    <section className="analytics-page" aria-label="Modulo de analisis de laboratorios">
      <header className="analytics-header">
        <div className="analytics-header-copy">
          <p className="analytics-kicker">Analisis operativo</p>
          <h2>Frecuencia de uso por laboratorio</h2>
          <p>
            Identifica los laboratorios con mayor y menor ocupacion usando el total de bloques disponibles
            frente a los bloques reservados, en curso y completados.
          </p>
        </div>

        <div className="analytics-summary">
          <article>
            <span>Periodo</span>
            <strong>{analytics.period_label || 'Sin datos'}</strong>
            <small>{formatPeriodRange(analytics)}</small>
          </article>
          <article>
            <span>Ocupacion global</span>
            <strong>{formatPercentage(analytics.totals.occupancy_percentage)}</strong>
            <small>{analytics.totals.used_blocks} bloques usados</small>
          </article>
          <article>
            <span>Laboratorios</span>
            <strong>{analytics.totals.laboratories_count}</strong>
            <small>Con bloques disponibles en el periodo</small>
          </article>
        </div>
      </header>

      <section className="analytics-panel analytics-panel-filters">
        <div className="analytics-panel-header">
          <div>
            <h3>Filtro de periodo</h3>
            <p className="analytics-panel-subtitle">
              Cambia entre vista diaria, semanal o mensual. El estado del filtro se controla localmente en este modulo.
            </p>
          </div>
        </div>

        <div className="analytics-period-grid" role="tablist" aria-label="Filtro de estadisticas por periodo">
          {PERIOD_OPTIONS.map((option) => {
            const Icon = option.icon
            const isActive = period === option.id

            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`analytics-period-button ${isActive ? 'is-active' : ''}`}
                onClick={() => setPeriod(option.id)}
              >
                <span className="analytics-period-icon">
                  <Icon size={18} />
                </span>
                <strong>{option.label}</strong>
                <span>{option.helper}</span>
              </button>
            )
          })}
        </div>
      </section>

      {error ? <p className="analytics-message analytics-message-error">{error}</p> : null}

      {isLoading ? <LoadingState /> : null}

      {!isLoading && !error ? (
        <>
          <section className="analytics-insights-grid">
            <RankingCard
              title="Mayor ocupacion"
              description="Todavia no existe un laboratorio lider en este periodo."
              lab={analytics.highest_usage_laboratory}
              tone="up"
              icon={TrendingUp}
            />
            <RankingCard
              title="Menor ocupacion"
              description="Todavia no existe un laboratorio con menor ocupacion en este periodo."
              lab={analytics.lowest_usage_laboratory}
              tone="down"
              icon={TrendingDown}
            />
            <article className="analytics-highlight-card tone-neutral">
              <div className="analytics-highlight-head">
                <span className="analytics-highlight-icon tone-neutral">
                  <Gauge size={18} />
                </span>
                <div>
                  <p>Resumen global</p>
                  <strong>{formatPercentage(analytics.totals.occupancy_percentage)}</strong>
                </div>
              </div>
              <div className="analytics-highlight-metric">
                <span>{analytics.totals.used_blocks} / {analytics.totals.available_blocks}</span>
                <small>
                  {analytics.totals.reserved_blocks} reservados, {analytics.totals.in_progress_blocks} en curso,
                  {' '}{analytics.totals.completed_blocks} completados y {analytics.totals.blocked_blocks} bloqueados.
                </small>
              </div>
            </article>
          </section>

          <section className="analytics-panel">
            <div className="analytics-panel-header">
              <div>
                <h3>Como se calcula</h3>
                <p className="analytics-panel-subtitle">
                  Porcentaje de uso = bloques usados / bloques disponibles. Los bloques bloqueados por mantenimiento
                  o eventos no se cuentan como disponibles para no distorsionar la ocupacion.
                </p>
              </div>
            </div>

            <div className="analytics-metric-grid">
              <article className="analytics-metric-card">
                <span><BarChart3 size={18} /></span>
                <strong>{analytics.totals.available_blocks}</strong>
                <p>Bloques disponibles en el periodo.</p>
              </article>
              <article className="analytics-metric-card">
                <span><FlaskConical size={18} /></span>
                <strong>{analytics.totals.used_blocks}</strong>
                <p>Bloques efectivamente usados por reservas aprobadas, en curso o completadas.</p>
              </article>
              <article className="analytics-metric-card">
                <span><CalendarRange size={18} /></span>
                <strong>{analytics.totals.blocked_blocks}</strong>
                <p>Bloques descontados por cierres operativos o mantenimiento.</p>
              </article>
            </div>
          </section>

          <section className="analytics-panel">
            <div className="analytics-panel-header">
              <div>
                <h3>Ranking de ocupacion por laboratorio</h3>
                <p className="analytics-panel-subtitle">
                  El listado queda ordenado de mayor a menor porcentaje de ocupacion para facilitar la asignacion de recursos.
                </p>
              </div>
            </div>

            {rankedLabs.length === 0 ? (
              <p className="analytics-empty">No hay datos registrados</p>
            ) : (
              <div className="analytics-ranking-list">
                {rankedLabs.map((lab, index) => (
                  <article key={lab.laboratory_id} className="analytics-ranking-card">
                    <div className="analytics-ranking-head">
                      <div className="analytics-ranking-title">
                        <span className="analytics-ranking-position">#{index + 1}</span>
                        <div>
                          <h4>{lab.laboratory_name || lab.laboratory_id}</h4>
                          <p>
                            {lab.area_name || 'Sin area'}{lab.laboratory_location ? ` · ${lab.laboratory_location}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="analytics-ranking-score">
                        <strong>{formatPercentage(lab.occupancy_percentage)}</strong>
                        <small>{lab.used_blocks} / {lab.available_blocks} bloques</small>
                      </div>
                    </div>

                    <div className="analytics-progress-track" aria-hidden="true">
                      <div className="analytics-progress-fill" style={{ width: `${Math.max(Math.min(lab.occupancy_percentage, 100), 0)}%` }} />
                    </div>

                    <div className="analytics-breakdown-grid">
                      <div>
                        <span>Reservados</span>
                        <strong>{lab.reserved_blocks}</strong>
                      </div>
                      <div>
                        <span>En curso</span>
                        <strong>{lab.in_progress_blocks}</strong>
                      </div>
                      <div>
                        <span>Completados</span>
                        <strong>{lab.completed_blocks}</strong>
                      </div>
                      <div>
                        <span>Bloqueados</span>
                        <strong>{lab.blocked_blocks}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}

export default AdminLabAnalyticsPage
