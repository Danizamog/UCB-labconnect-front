import { LabCalendar, DayAvailability } from "../types/availability";

type Props = {
  calendarData: LabCalendar | null;
  allCalendars: LabCalendar[];
  selectedLabId: number | null;
  year: number;
  month: number;
};

const weekdayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getMonthName(month: number) {
  return new Date(2026, month - 1, 1).toLocaleString("es-ES", { month: "long" });
}

function getStyles(status: string) {
  if (status === "available") {
    return {
      bg: "#e8f8ec",
      border: "#7ac77a",
      label: "Disponible",
    };
  }

  if (status === "partial") {
    return {
      bg: "#fff6dd",
      border: "#f2c94c",
      label: "Parcial",
    };
  }

  return {
    bg: "#fdeaea",
    border: "#e57373",
    label: "Ocupado",
  };
}

function mergeDayStatuses(days: DayAvailability[]): DayAvailability {
  const occupiedSlots = days.reduce((sum, day) => sum + day.occupied_slots, 0);
  const totalSlots = days.reduce((sum, day) => sum + day.total_slots, 0);

  const hasOccupied = days.some((day) => day.status === "occupied");
  const hasPartial = days.some((day) => day.status === "partial");
  const allAvailable = days.every((day) => day.status === "available");
  const allOccupied = days.every((day) => day.status === "occupied");

  let status: "available" | "partial" | "occupied" = "available";

  if (allAvailable) {
    status = "available";
  } else if (allOccupied) {
    status = "occupied";
  } else if (hasOccupied || hasPartial) {
    status = "partial";
  }

  return {
    day: days[0].day,
    date: days[0].date,
    status,
    occupied_slots: occupiedSlots,
    total_slots: totalSlots,
  };
}

export default function AvailabilityCalendar({
  calendarData,
  allCalendars,
  selectedLabId,
  year,
  month,
}: Props) {
  const mergedCalendarData: LabCalendar | null = (() => {
    if (selectedLabId !== null) {
      return calendarData;
    }

    if (allCalendars.length === 0) {
      return null;
    }

    const daysByNumber = new Map<number, DayAvailability[]>();

    allCalendars.forEach((lab) => {
      lab.days.forEach((day) => {
        if (!daysByNumber.has(day.day)) {
          daysByNumber.set(day.day, []);
        }
        daysByNumber.get(day.day)!.push(day);
      });
    });

    const mergedDays: DayAvailability[] = Array.from(daysByNumber.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, days]) => mergeDayStatuses(days));

    return {
      laboratory_id: 0,
      laboratory_name: "Todos los laboratorios",
      year,
      month,
      days: mergedDays,
    };
  })();

  if (!mergedCalendarData) {
    return (
      <div className="card">
        <h2 className="section-title">Disponibilidad mensual</h2>
        <p>No hay datos de calendario para mostrar.</p>
      </div>
    );
  }

  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) cells.push(day);

  const statusMap = new Map(mergedCalendarData.days.map((d) => [d.day, d]));

  return (
    <div className="card">
      <div className="topbar" style={{ marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            Disponibilidad del mes
          </h2>
          <div style={{ color: "var(--ucb-gray-700)", fontSize: 14 }}>
            {selectedLabId === null
              ? "Vista general de todos los laboratorios"
              : mergedCalendarData.laboratory_name}
          </div>
        </div>

        <div
          style={{
            fontWeight: 700,
            color: "var(--ucb-blue-dark)",
            textTransform: "capitalize",
          }}
        >
          {getMonthName(month)} {year}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          border: "1px solid var(--ucb-gray-200)",
          borderRadius: 18,
          overflow: "hidden",
          background: "white",
        }}
      >
        {weekdayNames.map((day) => (
          <div
            key={day}
            style={{
              padding: 12,
              background: "var(--ucb-blue-soft)",
              fontWeight: 800,
              color: "var(--ucb-blue-dark)",
              borderBottom: "1px solid var(--ucb-gray-200)",
              textAlign: "center",
            }}
          >
            {day}
          </div>
        ))}

        {cells.map((cell, index) => {
          if (cell === null) {
            return (
              <div
                key={`empty-${index}`}
                style={{
                  minHeight: 125,
                  borderRight: "1px solid var(--ucb-gray-100)",
                  borderBottom: "1px solid var(--ucb-gray-100)",
                  background: "#fafafa",
                }}
              />
            );
          }

          const dayData = statusMap.get(cell);

          if (!dayData) {
            return (
              <div
                key={cell}
                style={{
                  minHeight: 125,
                  padding: 10,
                  borderRight: "1px solid var(--ucb-gray-100)",
                  borderBottom: "1px solid var(--ucb-gray-100)",
                }}
              >
                <div style={{ fontWeight: 700 }}>{cell}</div>
              </div>
            );
          }

          const styles = getStyles(dayData.status);

          return (
            <div
              key={cell}
              style={{
                minHeight: 125,
                padding: 10,
                borderRight: "1px solid var(--ucb-gray-100)",
                borderBottom: "1px solid var(--ucb-gray-100)",
                background: styles.bg,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                <strong>{cell}</strong>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "white",
                    border: `1px solid ${styles.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {styles.label}
                </span>
              </div>

              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: styles.border,
                  marginBottom: 8,
                }}
              />

              <div style={{ fontSize: 13, color: "var(--ucb-gray-700)" }}>
                <div>
                  <b>Ocupados:</b> {dayData.occupied_slots}/{dayData.total_slots}
                </div>
                <div>
                  <b>Fecha:</b> {dayData.date}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}