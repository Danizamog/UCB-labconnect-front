import { Area } from "../types/area";

const RESERVATIONS_API = "http://localhost:8005/api/v1";

export async function getAllAreas(token: string): Promise<Area[]> {
  const response = await fetch(`${RESERVATIONS_API}/areas/all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudieron obtener las areas");
  }

  return data;
}

export async function createArea(
  payload: { name: string; description?: string; is_active: boolean },
  token: string
): Promise<Area> {
  const response = await fetch(`${RESERVATIONS_API}/areas/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo crear el area");
  }

  return data;
}

export async function updateArea(
  id: number,
  payload: { name: string; description?: string; is_active: boolean },
  token: string
): Promise<Area> {
  const response = await fetch(`${RESERVATIONS_API}/areas/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo actualizar el area");
  }

  return data;
}
