import { DayReservationsGroup } from "../types/availability";

type Props = {
  selectedDate: string;
  groups: DayReservationsGroup[];
};

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 72;

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("es-BO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function DayReservationsPanel({ selectedDate, groups }: Props) {
  const totalHours = END_HOUR - START_HOUR;
  const totalHeight = totalHours * HOUR_HEIGHT;

  return (
    <div className="card">
      <div style={{ marginBottom: 20 }}>
        <h2 className="section-title" style={{ marginBottom: 8 }}>
          Disponibilidad diaria de laboratorios
        </h2>
        <p style={{ margin: 0, color: "var(--ucb-gray-700)" }}>
          Consulta los horarios ocupados en una sola vista. Los espacios vacíos representan disponibilidad.
        </p>
        <p style={{ marginTop: 8, color: "var(--ucb-blue-dark)", fontWeight: 700 }}>
          {formatDateLabel(selectedDate)}
        </p>
      </div>

      {groups.length === 0 ? (
        <p>No hay laboratorios para mostrar.</p>
      ) : (
        <div
          style={{
            border: "1px solid rgba(15, 76, 129, 0.10)",
            borderRadius: 24,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 12px 30px rgba(15, 76, 129, 0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `80px repeat(${groups.length}, minmax(220px, 1fr))`,
              borderBottom: "1px solid #eef2f7",
              background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
              position: "sticky",
              top: 0,
              zIndex: 2,
            }}
          >
            <div
              style={{
                padding: "16px 12px",
                borderRight: "1px solid #eef2f7",
                fontWeight: 700,
                color: "var(--ucb-gray-700)",
              }}
            >
              Hora
            </div>

            {groups.map((group) => (
              <div
                key={group.laboratory_id}
                style={{
                  padding: "16px 14px",
                  borderRight: "1px solid #eef2f7",
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    color: "var(--ucb-blue-dark)",
                    fontSize: "0.96rem",
                  }}
                >
                  {group.laboratory_name}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `80px repeat(${groups.length}, minmax(220px, 1fr))`,
              minWidth: 900,
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                borderRight: "1px solid #eef2f7",
                position: "relative",
                height: totalHeight,
              }}
            >
              {Array.from({ length: totalHours + 1 }).map((_, index) => {
                const hour = START_HOUR + index;
                if (hour > END_HOUR) return null;

                return (
                  <div
                    key={hour}
                    style={{
                      height: HOUR_HEIGHT,
                      borderBottom: "1px solid #eef2f7",
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 10,
                        fontSize: "0.75rem",
                        color: "var(--ucb-gray-700)",
                        fontWeight: 700,
                      }}
                    >
                      {formatHourLabel(hour)}
                    </span>
                  </div>
                );
              })}
            </div>

            {groups.map((group) => (
              <div
                key={group.laboratory_id}
                style={{
                  position: "relative",
                  height: totalHeight,
                  borderRight: "1px solid #eef2f7",
                  background: "#fff",
                }}
              >
                {Array.from({ length: totalHours }).map((_, index) => (
                  <div
                    key={index}
                    style={{
                      height: HOUR_HEIGHT,
                      borderBottom: "1px solid #eef2f7",
                    }}
                  />
                ))}

                {group.reservations.length === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        border: "1px dashed #86efac",
                        background: "#f0fdf4",
                        color: "#166534",
                        borderRadius: 18,
                        padding: "14px 16px",
                        textAlign: "center",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                      }}
                    >
                      Disponible
                    </div>
                  </div>
                )}

                {group.reservations.map((reservation, index) => {
                  const startMinutes = timeToMinutes(reservation.start_time);
                  const endMinutes = timeToMinutes(reservation.end_time);

                  const top =
                    ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

                  const height =
                    ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

                  return (
                    <div
                      key={`${group.laboratory_id}-${reservation.start_time}-${reservation.end_time}-${index}`}
                      style={{
                        position: "absolute",
                        left: 10,
                        right: 10,
                        top,
                        height: Math.max(height, 44),
                        borderRadius: 16,
                        border: "1px solid rgba(15, 76, 129, 0.16)",
                        background:
                          "linear-gradient(135deg, rgba(15,76,129,0.10) 0%, rgba(15,76,129,0.18) 100%)",
                        boxShadow: "0 8px 18px rgba(15, 76, 129, 0.10)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderLeft: "5px solid var(--ucb-blue-dark)",
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            color: "var(--ucb-blue-dark)",
                          }}
                        >
                          Ocupado
                        </div>

                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--ucb-gray-700)",
                            fontWeight: 600,
                          }}
                        >
                          {reservation.start_time} - {reservation.end_time}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}