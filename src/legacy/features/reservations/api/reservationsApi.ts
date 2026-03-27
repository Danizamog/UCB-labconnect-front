import {
  PracticeRequestCreate,
  LabOption,
  MaterialOption,
  PracticeRequestResponse,
} from "../types/reservation";

const RESERVATIONS_API_BASE_URL = (import.meta.env.VITE_RESERVATIONS_API_BASE_URL || "").replace(/\/$/, "");

export async function createPracticePlanning(payload: PracticeRequestCreate, token: string) {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/practice-planning/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`);
  }

  return data;
}

export async function getAllPracticePlannings(token: string): Promise<PracticeRequestResponse[]> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/practice-planning/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudieron obtener las reservas");
  }

  return data;
}

export async function getMyPracticePlannings(token: string): Promise<PracticeRequestResponse[]> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/practice-planning/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudieron obtener tus reservas");
  }

  return data;
}

export async function updatePracticeStatus(
  practiceId: number,
  status: string,
  token: string
): Promise<PracticeRequestResponse> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/practice-planning/${practiceId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo actualizar el estado");
  }

  return data;
}

export async function getLabs(): Promise<LabOption[]> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/labs/`);
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los laboratorios");
  }

  return data;
}

export async function getMaterialsMock(): Promise<MaterialOption[]> {
  return [
    { id: 1, name: "Multímetro", availableQuantity: 10 },
    { id: 2, name: "Cable UTP", availableQuantity: 40 },
    { id: 3, name: "Protoboard", availableQuantity: 15 },
    { id: 4, name: "Microscopio", availableQuantity: 8 },
  ];
}