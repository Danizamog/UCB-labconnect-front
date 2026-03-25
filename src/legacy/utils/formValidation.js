export const validateReservationForm = (data) => {
  const { laboratory_id, date, start_time, end_time, needs_support, support_topic } = data;

  if (!laboratory_id) return "Debes seleccionar un laboratorio.";
  if (!date) return "Debes seleccionar una fecha.";
  if (!start_time || !end_time) return "Debes seleccionar un horario.";
  if (start_time >= end_time) return "La hora de inicio debe ser menor que la hora de fin.";
  if (needs_support && (!support_topic || !support_topic.trim())) {
    return "Debes indicar el tipo de apoyo requerido.";
  }
  return "";
};
