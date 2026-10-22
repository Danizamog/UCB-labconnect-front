const DEFAULT_HELP_CONTENT = {
  title: 'Ayuda de la seccion',
  description: 'Guia rapida para entender el objetivo de esta pantalla y las acciones disponibles.',
  questions: [
    {
      question: '¿Que puedo hacer en esta pantalla?',
      answer: 'Revisa los bloques visibles y usa los botones principales para crear, editar o consultar registros.',
    },
    {
      question: '¿Como vuelvo al inicio?',
      answer: 'Desde la barra lateral puedes elegir "Inicio" para regresar al panel principal.',
    },
  ],
}

export const SECTION_HELP_CONTENT = {
  home: {
    title: 'Inicio',
    description: 'Resumen institucional de LabConnect con accesos directos y estado general de la plataforma.',
    questions: [
      {
        question: '¿Que muestra esta portada?',
        answer: 'Presenta accesos institucionales, atajos de trabajo y un resumen general del entorno UCB.',
      },
      {
        question: '¿Como entro rapido a una accion?',
        answer: 'Usa la seccion "Acceso rapido" para abrir de inmediato los modulos clave segun tu rol.',
      },
    ],
  },
  admin_reservas: {
    title: 'Reservas de laboratorio',
    description: 'Gestion operativa de reservas, estados y seguimiento de solicitudes de uso de laboratorios.',
    questions: [
      {
        question: '¿Que acciones principales tiene este modulo?',
        answer: 'Permite revisar reservas, cambiar estados y mantener el flujo operativo del laboratorio.',
      },
      {
        question: '¿Que hago si una reserva requiere correccion?',
        answer: 'Abre el detalle de la reserva, ajusta los datos y guarda los cambios para actualizar el historial.',
      },
    ],
  },
  tutorials_manage: {
    title: 'Publicar tutorias',
    description: 'Creacion y administracion de sesiones de tutoria para estudiantes.',
    questions: [
      {
        question: '¿Como publico una nueva tutoria?',
        answer: 'Completa el formulario de la sesion con fecha, horario, laboratorio y cupos disponibles.',
      },
      {
        question: '¿Puedo editar una sesion publicada?',
        answer: 'Si, desde la lista de tutorias puedes abrir la sesion y actualizar su informacion.',
      },
    ],
  },
  profiles: {
    title: 'Perfiles',
    description: 'Administracion de cuentas de usuario, estado de perfiles y datos asociados.',
    questions: [
      {
        question: '¿Para que sirve este modulo?',
        answer: 'Sirve para revisar perfiles, actualizar datos y reactivar cuentas cuando sea necesario.',
      },
      {
        question: '¿Como busco un usuario rapido?',
        answer: 'Usa filtros o el buscador por nombre, correo o identificador segun el panel disponible.',
      },
    ],
  },
  roles: {
    title: 'Roles y permisos',
    description: 'Configuracion de permisos que controlan el acceso a cada funcionalidad.',
    questions: [
      {
        question: '¿Que debo cuidar al editar permisos?',
        answer: 'Aplica solo los permisos necesarios para evitar accesos excesivos en cuentas operativas.',
      },
      {
        question: '¿Los cambios se aplican de inmediato?',
        answer: 'Si, normalmente los permisos actualizados impactan la navegacion en la siguiente recarga de sesion.',
      },
    ],
  },
  penalties: {
    title: 'Penalizaciones',
    description: 'Registro de sanciones por incumplimientos, danos o reglas operativas.',
    questions: [
      {
        question: '¿Cuando debo registrar una penalizacion?',
        answer: 'Cuando exista un incidente documentado con evidencia y periodo definido de restriccion.',
      },
      {
        question: '¿Como evito errores en el registro?',
        answer: 'Verifica usuario, fechas y motivo antes de guardar para mantener trazabilidad correcta.',
      },
    ],
  },
  areas: {
    title: 'Areas',
    description: 'Catalogo y organizacion de areas academicas o administrativas del laboratorio.',
    questions: [
      {
        question: '¿Que representa un area?',
        answer: 'Es una agrupacion funcional para ordenar laboratorios, recursos y disponibilidad.',
      },
      {
        question: '¿Cuando crear una nueva area?',
        answer: 'Cuando se incorpore una nueva linea de trabajo que requiera gestion separada.',
      },
    ],
  },
  laboratorios: {
    title: 'Laboratorios',
    description: 'Gestion de laboratorios disponibles para reservas y actividades academicas.',
    questions: [
      {
        question: '¿Que datos debo completar?',
        answer: 'Nombre, identificador, capacidad y estado operativo para habilitar su uso correctamente.',
      },
      {
        question: '¿Como deshabilito temporalmente un laboratorio?',
        answer: 'Actualiza su estado para que deje de aparecer como disponible durante el periodo requerido.',
      },
    ],
  },
  equipos: {
    title: 'Equipos',
    description: 'Inventario de equipos, estado tecnico y seguimiento de mantenimiento.',
    questions: [
      {
        question: '¿Como registrar un equipo nuevo?',
        answer: 'Crea un registro con su identificador, descripcion, ubicacion y estado inicial.',
      },
      {
        question: '¿Que hacer si un equipo entra a mantenimiento?',
        answer: 'Cambia su estado y agrega observaciones para bloquear su asignacion en reservas.',
      },
    ],
  },
  materiales: {
    title: 'Materiales y reactivos',
    description: 'Control de stock, movimientos y disponibilidad de insumos.',
    questions: [
      {
        question: '¿Como mantengo stock actualizado?',
        answer: 'Registra entradas y salidas cada vez que se repone o consume material.',
      },
      {
        question: '¿Que indica el stock bajo?',
        answer: 'Que debes programar reposicion para evitar bloqueos en practicas o reservas.',
      },
    ],
  },
  calendar: {
    title: 'Calendario',
    description: 'Vista consolidada de disponibilidad y ocupacion por fecha y horario.',
    questions: [
      {
        question: '¿Para que sirve el calendario?',
        answer: 'Te permite identificar franjas libres y planificar reservas sin choques de horario.',
      },
      {
        question: '¿Como interpreto un bloque ocupado?',
        answer: 'Significa que existe una reserva o bloqueo activo en ese horario y laboratorio.',
      },
    ],
  },
  tutorials_public: {
    title: 'Tutorias',
    description: 'Catalogo de tutorias publicadas para inscripcion y seguimiento estudiantil.',
    questions: [
      {
        question: '¿Como me inscribo en una tutoria?',
        answer: 'Abre el detalle de la sesion y usa la accion principal para reservar tu cupo.',
      },
      {
        question: '¿Que pasa si ya no hay cupos?',
        answer: 'El sistema mostrara la sesion completa y deberas elegir otra fecha u horario disponible.',
      },
    ],
  },
  reserve_reactivos: {
    title: 'Reservar reactivos',
    description: 'Solicitud de insumos segun disponibilidad para practicas y actividades.',
    questions: [
      {
        question: '¿Que debo verificar antes de reservar?',
        answer: 'Cantidad disponible, fecha de uso y datos de la actividad para evitar rechazos.',
      },
      {
        question: '¿Como hago seguimiento a mi solicitud?',
        answer: 'Revisa el estado en el mismo modulo para ver si fue aprobada, observada o rechazada.',
      },
    ],
  },
  reserve: {
    title: 'Reservar laboratorio',
    description: 'Creacion y gestion de solicitudes de reserva de espacios de laboratorio.',
    questions: [
      {
        question: '¿Que necesito para reservar?',
        answer: 'Seleccionar laboratorio, fecha, horario y motivo academico de la solicitud.',
      },
      {
        question: '¿Puedo modificar una reserva creada?',
        answer: 'Si el estado lo permite, abre la reserva y edita los campos antes de confirmar cambios.',
      },
    ],
  },
  mapa: {
    title: 'Mapa UCB',
    description: 'Vista de orientacion para ubicar espacios academicos e institucionales.',
    questions: [
      {
        question: '¿Como uso el mapa?',
        answer: 'Explora los puntos de interes y usa el zoom para identificar ubicaciones dentro del campus.',
      },
      {
        question: '¿Para que me ayuda en reservas?',
        answer: 'Te permite reconocer la ubicacion del laboratorio antes de confirmar asistencia presencial.',
      },
    ],
  },
}

const SECTION_STEP_GUIDES = {
  home: [
    'Revisa el bloque de resumen y valida tus accesos disponibles.',
    'Usa "Acceso rapido" para abrir la seccion de trabajo que necesitas.',
    'Confirma notificaciones pendientes en la parte superior.',
  ],
  admin_reservas: [
    'Filtra por estado para encontrar solicitudes pendientes.',
    'Abre la fila de la reserva y valida fecha, horario y solicitante.',
    'Aprueba o rechaza segun reglas operativas del laboratorio.',
  ],
  tutorials_manage: [
    'Completa fecha, horario, laboratorio y cupo.',
    'Publica la tutoria y revisa la lista de sesiones activas.',
    'Edita o cierra sesiones segun disponibilidad.',
  ],
  profiles: [
    'Busca al usuario por nombre, correo o identificador.',
    'Abre el perfil y actualiza los datos requeridos.',
    'Guarda cambios y verifica estado de cuenta.',
  ],
  roles: [
    'Selecciona un rol existente o crea uno nuevo.',
    'Activa solo permisos necesarios para ese perfil.',
    'Guarda y valida el resultado con una cuenta de prueba.',
  ],
  penalties: [
    'Ubica al usuario y revisa su historial.',
    'Registra la penalizacion con motivo claro y evidencia.',
    'Define periodo y estado para mantener trazabilidad.',
  ],
  areas: [
    'Crea o edita el area academica.',
    'Asocia laboratorios y configura estado operativo.',
    'Guarda y verifica que aparezca en filtros.',
  ],
  laboratorios: [
    'Registra nombre, capacidad y area asociada.',
    'Configura estado para habilitar o bloquear reservas.',
    'Guarda y valida disponibilidad en calendario.',
  ],
  equipos: [
    'Despliega el formulario de catalogo o mantenimiento.',
    'Completa datos clave y estado del equipo.',
    'Guarda y valida historial o tickets activos.',
  ],
  materiales: [
    'Registra material o reactivo con stock inicial.',
    'Carga movimientos de entrada/salida segun operacion.',
    'Revisa historial y alertas de stock bajo.',
  ],
  calendar: [
    'Selecciona laboratorio y dia de trabajo.',
    'Revisa bloques disponibles y ocupados.',
    'Ajusta planificacion segun disponibilidad real.',
  ],
  tutorials_public: [
    'Abre la lista de tutorias disponibles.',
    'Revisa detalle de cada sesion y cupos.',
    'Inscribete en la sesion seleccionada.',
  ],
  reserve_reactivos: [
    'Selecciona reactivo y cantidad requerida.',
    'Indica fecha y contexto de uso.',
    'Envia solicitud y monitorea estado.',
  ],
  reserve: [
    'Selecciona laboratorio, fecha y rango horario.',
    'Completa motivo academico de la solicitud.',
    'Envia y revisa estado en tu historial.',
  ],
  mapa: [
    'Usa zoom y desplazamiento para ubicar bloques.',
    'Selecciona el edificio o punto de interes.',
    'Confirma ubicacion antes de la actividad presencial.',
  ],
}

function buildStepAnswer(sectionId) {
  const steps = SECTION_STEP_GUIDES[sectionId] || [
    'Revisa los datos principales de la pantalla.',
    'Completa la accion requerida en el formulario o tabla.',
    'Guarda y valida el resultado en el listado.',
  ]

  return steps.map((step, index) => `${index + 1}. ${step}`).join(' ')
}

function buildCommonQuestions(sectionId, title) {
  return [
    {
      question: '¿Como lo hago paso a paso?',
      answer: buildStepAnswer(sectionId),
    },
    {
      question: '¿Por que no veo una seccion o boton en mi menu?',
      answer: 'El frontend muestra opciones segun rol/permisos de tu cuenta. Si no aparece una seccion, normalmente tu perfil no tiene ese acceso activo.',
    },
    {
      question: '¿Por que no me deja editar o guardar?',
      answer: 'Revisa campos obligatorios, formato de fechas/horas y permisos de edicion. Si el boton sigue bloqueado, refresca sesion y vuelve a intentar.',
    },
    {
      question: '¿Como corrijo un dato mal registrado?',
      answer: `Busca el registro en ${title}, usa la accion Editar/Actualizar y guarda cambios. Si el modulo maneja estados, valida que no este en un estado bloqueado.`,
    },
    {
      question: '¿Que significa cuando una lista no carga datos?',
      answer: 'Puede ser filtro sin coincidencias, sesion vencida o error de red/API. Limpia filtros, recarga la pantalla y revisa si aparece mensaje de error.',
    },
    {
      question: '¿Que debo validar antes de guardar?',
      answer: `Antes de guardar en ${title}, valida datos obligatorios, seleccion correcta de estado y que no existan duplicados evidentes.`,
    },
    {
      question: '¿Que hago si algo falla o no carga?',
      answer: 'Recarga la vista, verifica conexion/sesion y vuelve a intentar. Si persiste, copia el mensaje de error y reportalo al soporte con contexto.',
    },
    {
      question: '¿Los cambios se guardan al instante para todos?',
      answer: 'Algunas vistas se actualizan en tiempo real y otras al recargar datos. Si no ves cambios, vuelve a cargar la lista o navega fuera y regresa.',
    },
  ]
}

function mergeQuestions(baseQuestions = [], commonQuestions = []) {
  const seen = new Set()
  const merged = []

  ;[...baseQuestions, ...commonQuestions].forEach((item) => {
    const key = String(item?.question || '').trim().toLowerCase()
    if (!key || seen.has(key)) {
      return
    }
    seen.add(key)
    merged.push(item)
  })

  return merged
}

export function getHelpContentForSection(sectionId, fallbackLabel = 'seccion') {
  const content = SECTION_HELP_CONTENT[sectionId]
  if (content) {
    return {
      ...content,
      questions: mergeQuestions(content.questions, buildCommonQuestions(sectionId, content.title || fallbackLabel)),
    }
  }

  const fallbackTitle = `Ayuda de ${fallbackLabel}`
  return {
    ...DEFAULT_HELP_CONTENT,
    title: fallbackTitle,
    questions: mergeQuestions(DEFAULT_HELP_CONTENT.questions, buildCommonQuestions(sectionId, fallbackTitle)),
  }
}
