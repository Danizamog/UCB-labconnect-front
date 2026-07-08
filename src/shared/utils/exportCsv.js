// Exportacion de informes a CSV compatible con Excel.
// - Usa ';' como separador (Excel en configuracion regional es-* lo interpreta como columnas).
// - Antepone BOM UTF-8 para que Excel muestre bien los acentos.

function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Descarga una lista de filas como CSV.
 * @param {string} filename Nombre del archivo (se agrega .csv si falta).
 * @param {Array<{key?: string, label: string, value?: (row) => any}>} columns Columnas.
 * @param {Array<object>} rows Filas de datos.
 */
export function downloadCsv(filename, columns, rows) {
  const safeColumns = Array.isArray(columns) ? columns : []
  const safeRows = Array.isArray(rows) ? rows : []

  const header = safeColumns.map((column) => escapeCell(column.label)).join(';')
  const lines = safeRows.map((row) =>
    safeColumns
      .map((column) => {
        const raw = typeof column.value === 'function' ? column.value(row) : row?.[column.key]
        return escapeCell(raw)
      })
      .join(';'),
  )

  const BOM = String.fromCharCode(0xfeff)
  const csv = BOM + [header, ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Sufijo de fecha (YYYY-MM-DD) para nombres de archivo. */
export function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}
