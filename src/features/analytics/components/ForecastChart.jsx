import { useMemo } from 'react'

// Grafico de linea minimal en SVG (sin dependencias): la serie historica se
// dibuja con linea solida y la serie pronosticada (IA) con linea punteada que
// continua desde el ultimo punto real. Opcionalmente traza una linea de
// referencia horizontal (p. ej. stock minimo).
export default function ForecastChart({
  history = [],
  forecast = [],
  threshold = null,
  thresholdLabel = '',
  historyColor = '#2563eb',
  forecastColor = '#f59e0b',
  height = 220,
  valueSuffix = '',
}) {
  const layout = useMemo(() => {
    const histPoints = history.map((p) => ({ date: p.date, value: Number(p.value) || 0 }))
    const forePoints = forecast.map((p) => ({ date: p.date, value: Number(p.value) || 0 }))
    const combined = [...histPoints, ...forePoints]
    if (combined.length === 0) {
      return null
    }

    const width = 720
    const pad = { top: 18, right: 18, bottom: 28, left: 44 }
    const innerW = width - pad.left - pad.right
    const innerH = height - pad.top - pad.bottom

    const values = combined.map((p) => p.value)
    const maxValue = Math.max(...values, threshold != null ? Number(threshold) : 0, 1)
    const total = combined.length
    const xFor = (index) => pad.left + (total <= 1 ? 0 : (index * innerW) / (total - 1))
    const yFor = (value) => pad.top + innerH - (value / maxValue) * innerH

    const toPath = (points, startIndex) =>
      points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(startIndex + i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
        .join(' ')

    const historyPath = toPath(histPoints, 0)
    // La linea punteada arranca en el ultimo punto real para quedar continua.
    const lastHist = histPoints.length ? [histPoints[histPoints.length - 1]] : []
    const forecastPath = toPath([...lastHist, ...forePoints], Math.max(histPoints.length - 1, 0))

    const boundaryX = histPoints.length ? xFor(histPoints.length - 1) : pad.left
    const thresholdY = threshold != null ? yFor(Number(threshold)) : null

    const tickIndexes = [0, Math.max(histPoints.length - 1, 0), total - 1]
    const ticks = [...new Set(tickIndexes)].map((index) => ({
      x: xFor(index),
      label: combined[index]?.date?.slice(5) || '',
    }))

    return {
      width,
      pad,
      innerH,
      maxValue,
      historyPath,
      forecastPath,
      boundaryX,
      thresholdY,
      ticks,
    }
  }, [history, forecast, threshold, height])

  if (!layout) {
    return <p className="forecast-empty">Sin datos suficientes para graficar.</p>
  }

  const { width, pad, innerH, maxValue, historyPath, forecastPath, boundaryX, thresholdY, ticks } = layout

  return (
    <svg
      role="img"
      aria-label="Grafico de pronostico: historico solido y prediccion punteada"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* eje Y: max y 0 */}
      <text x={pad.left - 8} y={pad.top + 4} textAnchor="end" fontSize="11" fill="#64748b">
        {maxValue.toFixed(maxValue >= 10 ? 0 : 1)}
      </text>
      <text x={pad.left - 8} y={pad.top + innerH + 4} textAnchor="end" fontSize="11" fill="#64748b">
        0
      </text>
      <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} stroke="#e2e8f0" />

      {/* separador historico / pronostico */}
      <line
        x1={boundaryX}
        y1={pad.top}
        x2={boundaryX}
        y2={pad.top + innerH}
        stroke="#cbd5e1"
        strokeDasharray="3 3"
      />

      {/* linea de referencia (stock minimo) */}
      {thresholdY != null ? (
        <g>
          <line
            x1={pad.left}
            y1={thresholdY}
            x2={width - pad.right}
            y2={thresholdY}
            stroke="#ef4444"
            strokeDasharray="5 4"
          />
          {thresholdLabel ? (
            <text x={width - pad.right} y={thresholdY - 4} textAnchor="end" fontSize="11" fill="#ef4444">
              {thresholdLabel}
            </text>
          ) : null}
        </g>
      ) : null}

      <path d={historyPath} fill="none" stroke={historyColor} strokeWidth="2.5" />
      <path d={forecastPath} fill="none" stroke={forecastColor} strokeWidth="2.5" strokeDasharray="6 5" />

      {ticks.map((tick) => (
        <text key={`${tick.x}-${tick.label}`} x={tick.x} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748b">
          {tick.label}
        </text>
      ))}

      <g fontSize="11">
        <rect x={pad.left} y={4} width="10" height="3" fill={historyColor} />
        <text x={pad.left + 14} y={9} fill="#475569">Historico</text>
        <rect x={pad.left + 84} y={4} width="10" height="3" fill={forecastColor} />
        <text x={pad.left + 98} y={9} fill="#475569">Pronostico IA{valueSuffix ? ` (${valueSuffix})` : ''}</text>
      </g>
    </svg>
  )
}
