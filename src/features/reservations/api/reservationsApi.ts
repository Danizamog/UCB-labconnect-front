import {
  AreaOption,
  PracticeRequestCreate,
  LabOption,
  MaterialOption,
  PracticeRequestResponse,
  ReservationNotification,
} from "../types/reservation";

const RESERVATIONS_API_BASE_URL = "http://localhost:8005/api/v1";

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
  token: string,
  reviewComment?: string
): Promise<PracticeRequestResponse> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/practice-planning/${practiceId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, review_comment: reviewComment || undefined }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo actualizar el estado");
  }

  return data;
}

export async function getAreas(token: string): Promise<AreaOption[]> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/areas/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudieron obtener las areas");
  }

  return data;
}

export async function getLabs(token: string): Promise<LabOption[]> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/labs/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudieron obtener los laboratorios");
  }

  return data;
}

export async function getLabById(labId: number, token: string): Promise<LabOption> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/labs/${labId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo obtener el laboratorio");
  }

  return data;
}

export async function getMyNotifications(token: string): Promise<ReservationNotification[]> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/practice-planning/my/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || "No se pudieron obtener las notificaciones");
  }

  return data;
}

export async function markNotificationAsRead(practiceId: number, token: string): Promise<void> {
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/practice-planning/${practiceId}/notifications/read`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "No se pudo marcar la notificacion");
  }
}

export async function getMaterialsMock(): Promise<MaterialOption[]> {
  return [
    { id: 1, name: "Multímetro", availableQuantity: 10 },
    { id: 2, name: "Cable UTP", availableQuantity: 40 },
    { id: 3, name: "Protoboard", availableQuantity: 15 },
    { id: 4, name: "Microscopio", availableQuantity: 8 },
  ];
}
