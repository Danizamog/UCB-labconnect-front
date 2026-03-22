import { DayReservationsGroup, LabCalendar } from "../types/availability";

const RESERVATIONS_API = "http://localhost:8005/api/v1";

export async function getLabsCalendar(
  year: number,
  month: number,
  token: string,
  labId?: number
): Promise<LabCalendar[]> {
  const url = new URL(`${RESERVATIONS_API}/availability/calendar`);
  url.searchParams.set("year", String(year));
  url.searchParams.set("month", String(month));
  if (labId) url.searchParams.set("lab_id", String(labId));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo cargar el calendario");
  }

  return data;
}

export async function getDayReservations(
  date: string,
  token: string,
  labId?: number
): Promise<DayReservationsGroup[]> {
  const url = new URL(`${RESERVATIONS_API}/availability/day`);
  url.searchParams.set("date", date);
  if (labId) url.searchParams.set("lab_id", String(labId));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo cargar la agenda del día");
  }

  return data;
}