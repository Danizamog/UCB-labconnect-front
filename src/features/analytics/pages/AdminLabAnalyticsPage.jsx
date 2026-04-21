import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  FlaskConical,
  Gauge,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
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

const OCCUPANCY_FILTERS = [
  { id: 'all', label: 'Todos', helper: 'Muestra todo el ranking.' },
  { id: 'high', label: 'Alta', helper: 'Laboratorios con alta demanda.' },
  { id: 'medium', label: 'Media', helper: 'Uso estable o equilibrado.' },
  { id: 'low', label: 'Baja', helper: 'Espacios con margen disponible.' },
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

function formatDateTimeLabel(value) {
  if (!value) {
    return 'Sin actualizacion'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function normalizeSearchValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getOccupancyBand(value) {
  const normalizedValue = Number(value || 0)

  if (normalizedValue >= 70) {
    return 'high'
  }

  if (normalizedValue >= 35) {
    return 'medium'
  }

  return 'low'
}

function getOccupancyMeta(value) {
  const band = getOccupancyBand(value)

  if (band === 'high') {
    return {
      id: 'high',
      label: 'Alta demanda',
      helper: 'Conviene revisar capacidad y redistribucion.',
    }
  }

  if (band === 'medium') {
    return {
      id: 'medium',
      label: 'Uso estable',
      helper: 'Mantiene una ocupacion equilibrada.',
    }
  }

  return {
    id: 'low',
    label: 'Oportunidad disponible',
    helper: 'Tiene espacio para absorber mas demanda.',
  }
}

function getDecisionCopy({ highCount, mediumCount, lowCount, totalCount }) {
  if (totalCount === 0) {
    return 'Todavia no hay datos para sugerir ajustes operativos.'
  }

  if (highCount >= Math.max(1, Math.ceil(totalCount / 2))) {
    return 'La mayor parte del uso se concentra en pocos laboratorios. Conviene revisar redistribucion, horarios o capacidad.'
  }

  if (lowCount >= Math.max(1, Math.ceil(totalCount / 2))) {
    return 'Hay varios laboratorios con capacidad ociosa. Puede ser buen momento para redirigir reservas o reforzar difusion.'
  }

  if (mediumCount >= Math.max(1, Math.floor(totalCount / 2))) {
    return 'La ocupacion se ve relativamente balanceada. Vale la pena vigilar solo los extremos del ranking.'
  }

  return 'El uso esta repartido de forma mixta. Revisa laboratorios con alta y baja ocupacion para optimizar recursos.'
}

function getProgressWidth(value) {
  return `${Math.max(Math.min(Number(value || 0), 100), 0)}%`
}

function OccupancyBadge({ value }) {
  const meta = getOccupancyMeta(value)

  return (
    <span className={`analytics-occupancy-badge tone-${meta.id}`}>
      {meta.label}
    </span>
  )
}

function RankingCard({ title, description, lab, tone = 'neutral', icon: Icon }) {
  const occupancyMeta = getOccupancyMeta(lab?.occupancy_percentage)

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
      <div className="analytics-highlight-footer">
        <OccupancyBadge value={lab?.occupancy_percentage} />
        <span>{lab ? occupancyMeta.helper : description}</span>
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
  const [occupancyFilter, setOccupancyFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
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

  const rankedLabs = useMemo(
    () => (Array.isArray(analytics?.labs) ? analytics.labs : []),
    [analytics]
  )

  const filteredLabs = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(deferredSearchTerm)

    return rankedLabs.filter((lab) => {
      const matchesSearch = !normalizedSearch || [
        lab.laboratory_name,
        lab.area_name,
        lab.laboratory_location,
        lab.laboratory_id,
      ].some((field) => normalizeSearchValue(field).includes(normalizedSearch))

      const matchesOccupancy =
        occupancyFilter === 'all' || getOccupancyBand(lab.occupancy_percentage) === occupancyFilter

      return matchesSearch && matchesOccupancy
    })
  }, [deferredSearchTerm, occupancyFilter, rankedLabs])

  const occupancySummary = useMemo(() => {
    const highCount = rankedLabs.filter((lab) => getOccupancyBand(lab.occupancy_percentage) === 'high').length
    const mediumCount = rankedLabs.filter((lab) => getOccupancyBand(lab.occupancy_percentage) === 'medium').length
    const lowCount = rankedLabs.filter((lab) => getOccupancyBand(lab.occupancy_percentage) === 'low').length

    return {
      totalCount: rankedLabs.length,
      highCount,
      mediumCount,
      lowCount,
      recommendation: getDecisionCopy({
        highCount,
        mediumCount,
        lowCount,
        totalCount: rankedLabs.length,
      }),
    }
  }, [rankedLabs])

  return (
    <section className="analytics-page" aria-label="Modulo de analisis de laboratorios">
      <header className="analytics-header">
        <div className="analytics-header-copy">
          <p className="analytics-kicker">Analisis operativo</p>
          <h2>Frecuencia de uso por laboratorio</h2>
          <p>
            Identifica rapido que laboratorios estan mas exigidos, cuales tienen capacidad disponible
            y como cambia la ocupacion segun el periodo seleccionado.
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
          <article>
            <span>Actualizado</span>
            <strong>{formatDateTimeLabel(analytics.generated_at)}</strong>
            <small>Ultima consulta del modulo</small>
          </article>
        </div>
      </header>

      <section className="analytics-panel analytics-panel-filters">
        <div className="analytics-panel-header">
          <div>
            <h3>Explora el periodo y filtra el ranking</h3>
            <p className="analytics-panel-subtitle">
              Primero cambia la ventana de tiempo. Luego busca un laboratorio o filtra por nivel de ocupacion
              para entender mejor donde conviene actuar.
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
                onClick={() => {
                  startTransition(() => setPeriod(option.id))
                }}
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

        <div className="analytics-toolbar">
          <label className="analytics-search-field">
            <span className="analytics-search-icon">
              <Search size={16} />
            </span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar laboratorio, area o ubicacion"
              aria-label="Buscar laboratorio en el ranking"
            />
          </label>

          <div className="analytics-filter-group" aria-label="Filtro local por ocupacion">
            <div className="analytics-filter-label">
              <SlidersHorizontal size={16} />
              <span>Nivel de ocupacion</span>
            </div>
            <div className="analytics-filter-chips">
              {OCCUPANCY_FILTERS.map((filterOption) => (
                <button
                  key={filterOption.id}
                  type="button"
                  className={`analytics-filter-chip ${occupancyFilter === filterOption.id ? 'is-active' : ''}`}
                  onClick={() => setOccupancyFilter(filterOption.id)}
                  title={filterOption.helper}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="analytics-message analytics-message-error">{error}</p> : null}

      {isLoading ? <LoadingState /> : null}

      {!isLoading && !error ? (
        <>
          <section className="analytics-decision-grid" aria-label="Lectura rapida del periodo">
            <article className="analytics-decision-card tone-high">
              <span className="analytics-decision-icon">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p>Alta demanda</p>
                <strong>{occupancySummary.highCount}</strong>
                <small>Laboratorios con 70% o mas de ocupacion.</small>
              </div>
            </article>

            <article className="analytics-decision-card tone-medium">
              <span className="analytics-decision-icon">
                <Gauge size={18} />
              </span>
              <div>
                <p>Uso estable</p>
                <strong>{occupancySummary.mediumCount}</strong>
                <small>Laboratorios con una carga intermedia y balanceada.</small>
              </div>
            </article>

            <article className="analytics-decision-card tone-low">
              <span className="analytics-decision-icon">
                <Sparkles size={18} />
              </span>
              <div>
                <p>Capacidad disponible</p>
                <strong>{occupancySummary.lowCount}</strong>
                <small>Laboratorios con margen para absorber mas demanda.</small>
              </div>
            </article>

            <article className="analytics-decision-card tone-note analytics-decision-card-wide">
              <span className="analytics-decision-icon">
                <BarChart3 size={18} />
              </span>
              <div>
                <p>Lectura sugerida</p>
                <strong>Donde conviene mirar primero</strong>
                <small>{occupancySummary.recommendation}</small>
              </div>
            </article>
          </section>

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
              <div className="analytics-highlight-footer">
                <OccupancyBadge value={analytics.totals.occupancy_percentage} />
                <span>La ocupacion global ayuda a comparar el periodo completo antes de entrar al detalle por laboratorio.</span>
              </div>
            </article>
          </section>

          <section className="analytics-panel">
            <div className="analytics-panel-header">
              <div>
                <h3>Como leer estos datos</h3>
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
                <p>Bloques disponibles para reserva dentro del periodo visible.</p>
              </article>
              <article className="analytics-metric-card">
                <span><FlaskConical size={18} /></span>
                <strong>{analytics.totals.used_blocks}</strong>
                <p>Bloques usados por reservas aprobadas, en curso o completadas.</p>
              </article>
              <article className="analytics-metric-card">
                <span><CalendarRange size={18} /></span>
                <strong>{analytics.totals.blocked_blocks}</strong>
                <p>Bloques descontados por cierres operativos o mantenimiento.</p>
              </article>
            </div>
          </section>

          <section className="analytics-panel">
            <div className="analytics-panel-header analytics-panel-header-with-meta">
              <div>
                <h3>Ranking de ocupacion por laboratorio</h3>
                <p className="analytics-panel-subtitle">
                  El listado queda ordenado de mayor a menor porcentaje de ocupacion para facilitar la asignacion de recursos.
                </p>
              </div>
              <div className="analytics-results-meta">
                <strong>{filteredLabs.length}</strong>
                <span>
                  {filteredLabs.length === rankedLabs.length
                    ? 'laboratorios visibles'
                    : `de ${rankedLabs.length} laboratorios en el periodo`}
                </span>
              </div>
            </div>

            {filteredLabs.length === 0 ? (
              <div className="analytics-empty-state">
                <p className="analytics-empty">No hay datos registrados</p>
                <small>
                  Ajusta la busqueda o el filtro local para volver a mostrar laboratorios de este periodo.
                </small>
              </div>
            ) : (
              <div className="analytics-ranking-list">
                {filteredLabs.map((lab, index) => {
                  const occupancyMeta = getOccupancyMeta(lab.occupancy_percentage)

                  return (
                    <article key={lab.laboratory_id} className="analytics-ranking-card">
                      <div className="analytics-ranking-head">
                        <div className="analytics-ranking-title">
                          <span className="analytics-ranking-position">#{index + 1}</span>
                          <div>
                            <div className="analytics-ranking-name-row">
                              <h4>{lab.laboratory_name || lab.laboratory_id}</h4>
                              <OccupancyBadge value={lab.occupancy_percentage} />
                            </div>
                            <p>
                              {lab.area_name || 'Sin area'}
                              {lab.laboratory_location ? ` - ${lab.laboratory_location}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="analytics-ranking-score">
                          <strong>{formatPercentage(lab.occupancy_percentage)}</strong>
                          <small>{lab.used_blocks} / {lab.available_blocks} bloques</small>
                        </div>
                      </div>

                      <div className="analytics-progress-track" aria-hidden="true">
                        <div className="analytics-progress-fill" style={{ width: getProgressWidth(lab.occupancy_percentage) }} />
                      </div>

                      <div className="analytics-ranking-caption">
                        <span>{occupancyMeta.helper}</span>
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
                  )
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}

export default AdminLabAnalyticsPage
