const RESERVATIONS_API = "http://localhost:8000/api/availability";

export async function getLabsCalendar(year, month, token, labId = null) {
  const url = new URL(`${RESERVATIONS_API}/calendar`);
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

export async function getDayReservations(date, token, labId = null) {
  const url = new URL(`${RESERVATIONS_API}/day`);
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
