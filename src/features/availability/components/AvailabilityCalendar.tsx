import { DayAvailability, LabCalendar } from "../types/availability";

type Props = {
  calendarData: LabCalendar | null;
  allCalendars: LabCalendar[];
  selectedLabId: number | null;
  year: number;
  month: number;
};

const weekdayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function getMonthName(month: number) {
  return new Date(2026, month - 1, 1).toLocaleString("es-ES", { month: "long" });
}

function getStyles(status: string) {
  if (status === "available") return { badge: "badge badge-available", label: "Disponible" };
  if (status === "partial") return { badge: "badge badge-maintenance", label: "Parcial" };
  return { badge: "badge badge-damaged", label: "Ocupado" };
}

function mergeDayStatuses(days: DayAvailability[]): DayAvailability {
  const occupiedSlots = days.reduce((sum, day) => sum + day.occupied_slots, 0);
  const totalSlots = days.reduce((sum, day) => sum + day.total_slots, 0);
  const hasOccupied = days.some((day) => day.status === "occupied");
  const hasPartial = days.some((day) => day.status === "partial");
  const allAvailable = days.every((day) => day.status === "available");
  const allOccupied = days.every((day) => day.status === "occupied");

  let status: "available" | "partial" | "occupied" = "available";
  if (allAvailable) status = "available";
  else if (allOccupied) status = "occupied";
  else if (hasOccupied || hasPartial) status = "partial";

  return {
    day: days[0].day,
    date: days[0].date,
    status,
    occupied_slots: occupiedSlots,
    total_slots: totalSlots,
  };
}

export default function AvailabilityCalendar({ calendarData, allCalendars, selectedLabId, year, month }: Props) {
  const mergedCalendarData: LabCalendar | null = (() => {
    if (selectedLabId !== null) return calendarData;
    if (allCalendars.length === 0) return null;

    const daysByNumber = new Map<number, DayAvailability[]>();
    allCalendars.forEach((lab) => {
      lab.days.forEach((day) => {
        if (!daysByNumber.has(day.day)) daysByNumber.set(day.day, []);
        daysByNumber.get(day.day)!.push(day);
      });
    });

    return {
      laboratory_id: 0,
      laboratory_name: "Todos los laboratorios",
      year,
      month,
      days: Array.from(daysByNumber.entries()).sort((a, b) => a[0] - b[0]).map(([, days]) => mergeDayStatuses(days)),
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
      <div className="section-head">
        <div>
          <h2 className="section-title">Disponibilidad del mes</h2>
          <p className="section-copy">{selectedLabId === null ? "Vista general de todos los laboratorios" : mergedCalendarData.laboratory_name}</p>
        </div>
        <strong style={{ textTransform: "capitalize", color: "var(--ucb-blue-dark)" }}>{getMonthName(month)} {year}</strong>
      </div>

      <div className="month-calendar">
        {weekdayNames.map((day) => (
          <div key={day} className="month-calendar-head">{day}</div>
        ))}

        {cells.map((cell, index) => {
          if (cell === null) return <div key={`empty-${index}`} className="month-calendar-cell empty" />;

          const dayData = statusMap.get(cell);
          const styles = dayData ? getStyles(dayData.status) : null;
          return (
            <div key={cell} className={`month-calendar-cell ${dayData?.status || ""}`}>
              <div className="month-calendar-top">
                <strong>{cell}</strong>
                {styles && <span className={styles.badge}>{styles.label}</span>}
              </div>
              {dayData && (
                <div className="month-calendar-meta">
                  <div>{dayData.occupied_slots}/{dayData.total_slots} bloques ocupados</div>
                  <div>{dayData.date}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
