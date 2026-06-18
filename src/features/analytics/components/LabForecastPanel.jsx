import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { getLaboratoryForecast } from '../services/predictionsService'
import ForecastChart from './ForecastChart'

// Panel autocontenido: selecciona un laboratorio y muestra el pronostico de
// ocupacion (historico solido + prediccion punteada). Se renderiza dentro de la
// pagina de Analisis, que ya esta protegida por consultar_estadisticas.
export default function LabForecastPanel({ labs = [] }) {
  const options = useMemo(
    () =>
      labs
        .filter((lab) => lab?.laboratory_id)
        .map((lab) => ({ id: lab.laboratory_id, name: lab.laboratory_name || lab.laboratory_id })),
    [labs],
  )

  const [selectedId, setSelectedId] = useState('')
  // El laboratorio efectivo es el elegido o el primero disponible; se deriva sin
  // un efecto para no llamar setState de forma sincrona.
  const effectiveId = selectedId || (options[0]?.id ?? '')

  const [result, setResult] = useState({ id: null, error: '', data: null })

  useEffect(() => {
    if (!effectiveId) {
      return undefined
    }
    let active = true
    getLaboratoryForecast(effectiveId)
      .then((response) => {
        if (active) setResult({ id: effectiveId, error: '', data: response })
      })
      .catch((err) => {
        if (active) setResult({ id: effectiveId, error: err?.message || 'No se pudo cargar el pronostico', data: null })
      })
    return () => {
      active = false
    }
  }, [effectiveId])

  if (!options.length) {
    return null
  }

  const loading = result.id !== effectiveId
  const error = loading ? '' : result.error
  const data = loading ? null : result.data

  return (
    <section className="analytics-panel" aria-label="Pronostico de ocupacion con IA">
      <div className="analytics-panel-header">
        <div>
          <h3>
            <Sparkles size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Pronostico de ocupacion (IA)
          </h3>
          <p className="analytics-panel-subtitle">
            Proyeccion de horas reservadas por dia para las proximas semanas. La linea solida es el
            historico real; la punteada es la prediccion del modelo.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span>Laboratorio</span>
          <select value={effectiveId} onChange={(event) => setSelectedId(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p>Calculando pronostico...</p> : null}
      {error ? <p className="forecast-error" style={{ color: '#b91c1c' }}>{error}</p> : null}

      {!loading && !error && data ? (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8, fontSize: 13 }}>
            <span>
              Pico proyectado: <strong>{Number(data.projected_peak || 0).toFixed(1)} h/dia</strong>
            </span>
            <span>
              Horizonte: <strong>{data.horizon_days} dias</strong>
            </span>
            {data.confidence === 'low' ? (
              <span style={{ color: '#b45309' }}>
                Pocos datos historicos: estimacion de baja confianza (modelo base).
              </span>
            ) : (
              <span style={{ color: '#15803d' }}>Modelo de red neuronal entrenado con el historico.</span>
            )}
            {data.metrics ? (
              <span title="Error medido por backtesting temporal (menor es mejor)">
                Error (validacion): <strong>MAE {data.metrics.mae} · RMSE {data.metrics.rmse}</strong>{' '}
                ({data.metrics.test_days}d de prueba)
              </span>
            ) : null}
          </div>
          <ForecastChart history={data.history} forecast={data.forecast} valueSuffix="horas/dia" />
        </div>
      ) : null}
    </section>
  )
}
