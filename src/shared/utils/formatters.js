/**
 * Formatea una fecha (YYYY-MM-DD) al locale boliviano.
 * @param {string} date
 * @returns {string}
 */
export function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Formatea un datetime ISO al locale boliviano con hora.
 * @param {string|null} value
 * @returns {string}
 */
export function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

/**
 * Parsea un ISO datetime ignorando el sufijo de zona horaria.
 * El backend guarda fechas planas (ej. start_at de reservas y tutorias)
 * marcadas con `Z` aunque la hora representa el reloj LOCAL del usuario.
 * `new Date(...)` aplicaria la conversion UTC -> zona del navegador, lo que
 * en Bolivia (UTC-4) corre las horas 4 hs hacia atras. Este helper extrae los
 * componentes y construye un Date local, conservando la hora original.
 * @param {string|null|undefined} value
 * @returns {Date|null}
 */
export function parseLocalDateTime(value) {
  if (!value) return null
  const normalized = String(value).replace(' ', 'T')
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) {
    const fallback = new Date(normalized)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  const [, year, month, day, hour, minute, second] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second || 0),
    0,
  )
}

/**
 * Como formatDateTime, pero respeta la hora local original sin aplicar
 * conversion de zona horaria. Usar para `start_at`/`end_at` y similares
 * que el backend devuelve marcados como UTC pero contienen la hora local.
 * @param {string|null} value
 * @returns {string}
 */
export function formatLocalDateTime(value) {
  if (!value) return 'Sin fecha'
  const date = parseLocalDateTime(value)
  if (!date) return value
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Traduce el estado de una reserva/préstamo al español.
 * @param {string} status
 * @returns {string}
 */
export function formatStatus(status) {
  if (status === 'approved') return 'Aprobada'
  if (status === 'pending') return 'Pendiente'
  if (status === 'rejected') return 'Rechazada'
  if (status === 'cancelled') return 'Cancelada'
  if (status === 'active') return 'Activo'
  if (status === 'overdue') return 'Vencido'
  if (status === 'returned') return 'Devuelto'
  return status
}

/**
 * Devuelve la clase CSS correspondiente al estado de una reserva.
 * @param {string} status
 * @returns {string}
 */
export function statusClass(status) {
  if (status === 'approved') return 'approved'
  if (status === 'pending') return 'pending'
  if (status === 'rejected' || status === 'cancelled') return 'rejected'
  return 'neutral'
}

/**
 * Traduce el estado de un activo al español.
 * @param {string} value
 * @returns {string}
 */
export function assetStatusLabel(value) {
  if (value === 'available') return 'Disponible'
  if (value === 'loaned') return 'Prestado'
  if (value === 'maintenance') return 'Mantenimiento'
  if (value === 'damaged') return 'Dañado'
  return value
}

/**
 * Devuelve la clase CSS correspondiente al estado de un activo.
 * @param {string} value
 * @returns {string}
 */
export function assetStatusBadgeClass(value) {
  if (value === 'available') return 'available'
  if (value === 'loaned') return 'loaned'
  if (value === 'maintenance') return 'maintenance'
  if (value === 'damaged') return 'damaged'
  return 'neutral'
}

/**
 * Traduce el tipo de movimiento de inventario al español.
 * @param {string} value
 * @returns {string}
 */
export function movementTypeLabel(value) {
  if (value === 'entry') return 'Ingreso'
  if (value === 'return') return 'Devolución'
  if (value === 'consumption') return 'Consumo'
  if (value === 'adjustment') return 'Ajuste manual'
  if (value === 'loan_issue') return 'Salida por préstamo'
  if (value === 'loan_return') return 'Retorno desde préstamo'
  return value
}
