import { hasAnyPermission } from './permissions.js'

export const TUTORIAL_PERMISSIONS = ['gestionar_tutorias_propias', 'gestionar_asistencia_tutorias', 'gestionar_observaciones_tutorias']
export const RESERVATION_PERMISSIONS = ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio', 'aprobar_clases', 'aprobar_tutorias', 'gestionar_reservas_materiales', 'gestionar_prestamos']
export const MATERIAL_PERMISSIONS = ['gestionar_stock', 'gestionar_reactivos_quimicos', 'gestionar_reservas_materiales', 'generar_reportes']

export function equipmentAccess(user) {
  return {
    inventory: hasAnyPermission(user, ['gestionar_inventario', 'gestionar_estado_equipos']),
    status: hasAnyPermission(user, ['gestionar_estado_equipos']),
    tickets: hasAnyPermission(user, ['gestionar_mantenimiento', 'registrar_tickets_equipo']),
    closeTickets: hasAnyPermission(user, ['gestionar_mantenimiento']),
    loans: hasAnyPermission(user, ['gestionar_prestamos']),
  }
}

export function reservationAccess(user) {
  const reservations = hasAnyPermission(user, ['gestionar_reservas'])
  const access = hasAnyPermission(user, ['gestionar_accesos_laboratorio'])
  return {
    reservations, access,
    operations: reservations || access,
    rules: hasAnyPermission(user, ['gestionar_reglas_reserva']),
    classes: hasAnyPermission(user, ['aprobar_clases']),
    tutorials: hasAnyPermission(user, ['aprobar_tutorias']),
    supplies: hasAnyPermission(user, ['gestionar_reservas_materiales']),
    equipment: hasAnyPermission(user, ['gestionar_prestamos']),
  }
}

export function materialAccess(user) {
  return {
    stock: hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos']),
    movements: hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos', 'gestionar_reservas_materiales']),
    requests: hasAnyPermission(user, ['gestionar_reservas_materiales']),
    reports: hasAnyPermission(user, ['generar_reportes', 'consultar_estadisticas']),
    catalog: hasAnyPermission(user, ['gestionar_stock', 'gestionar_reactivos_quimicos', 'gestionar_reservas_materiales']),
  }
}
