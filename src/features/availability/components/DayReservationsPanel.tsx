import { DayReservationsGroup } from "../types/availability";

type Props = {
  selectedDate: string;
  groups: DayReservationsGroup[];
};

const START_HOUR = 9;
const END_HOUR = 19;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("es-BO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getReservationStyle(start: string, end: string) {
  const startMinutes = timeToMinutes(start) - START_HOUR * 60;
  const endMinutes = timeToMinutes(end) - START_HOUR * 60;
  const left = Math.max(0, (startMinutes / TOTAL_MINUTES) * 100);
  const width = Math.max(8, ((endMinutes - startMinutes) / TOTAL_MINUTES) * 100);
  return { left: `${left}%`, width: `${width}%` };
}

export default function DayReservationsPanel({ selectedDate, groups }: Props) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => START_HOUR + index);

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Disponibilidad diaria</h2>
          <p className="section-copy">Visualiza los laboratorios en una linea horaria clara. Los tramos vacios representan disponibilidad.</p>
        </div>
        <strong style={{ color: "var(--ucb-blue-dark)", textTransform: "capitalize" }}>{formatDateLabel(selectedDate)}</strong>
      </div>

      {groups.length === 0 ? (
        <p>No hay laboratorios para mostrar.</p>
      ) : (
        <>
          <div className="timeline-header">
            <div className="timeline-lab-column">Laboratorio</div>
            <div className="timeline-hours">
              {hours.map((hour) => (
                <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
              ))}
            </div>
          </div>

          <div className="timeline-board">
            {groups.map((group) => (
              <div key={group.laboratory_id} className="timeline-row">
                <div className="timeline-lab-card">
                  <strong>{group.laboratory_name}</strong>
                  <span className={`badge ${group.reservations.length === 0 ? "badge-available" : "badge-maintenance"}`}>
                    {group.reservations.length === 0 ? "Libre" : `${group.reservations.length} reserva(s)`}
                  </span>
                </div>

                <div className="timeline-track">
                  <div className="timeline-grid">
                    {Array.from({ length: END_HOUR - START_HOUR }).map((_, index) => (
                      <span key={index} />
                    ))}
                  </div>

                  {group.reservations.length === 0 ? (
                    <div className="timeline-available">Disponible durante toda la jornada</div>
                  ) : (
                    group.reservations.map((reservation, index) => (
                      <div
                        key={`${group.laboratory_id}-${reservation.start_time}-${reservation.end_time}-${index}`}
                        className="timeline-reservation"
                        style={getReservationStyle(reservation.start_time, reservation.end_time)}
                      >
                        <strong>{reservation.start_time} - {reservation.end_time}</strong>
                        <span>Reservado</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
