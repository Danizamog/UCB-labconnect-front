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
