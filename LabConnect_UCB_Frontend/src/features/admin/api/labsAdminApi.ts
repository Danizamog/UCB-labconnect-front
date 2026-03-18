import { Lab, LabCreate } from "../types/lab";

const RESERVATIONS_API = "http://localhost:8005/api/v1";

export async function getAllLabs(token: string): Promise<Lab[]> {
  const response = await fetch(`${RESERVATIONS_API}/labs/all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data?.detail || "No se pudieron obtener los laboratorios");
  return data;
}

export async function createLab(payload: LabCreate, token: string): Promise<Lab> {
  const response = await fetch(`${RESERVATIONS_API}/labs/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo crear el laboratorio");
  return data;
}

export async function updateLab(id: number, payload: LabCreate, token: string): Promise<Lab> {
  const response = await fetch(`${RESERVATIONS_API}/labs/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo actualizar el laboratorio");
  return data;
}