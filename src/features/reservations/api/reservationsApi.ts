import {
  AreaOption,
  LabOption,
  MaterialOption,
  PracticeRequestCreate,
  PracticeRequestResponse,
  ReservationNotification,
} from "../types/reservation";

const API_BASE_URL = (import.meta.env.VITE_RESERVATIONS_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const REALTIME_WS_URL = (
  import.meta.env.VITE_RESERVATIONS_WS_URL ||
  "ws://localhost:8005/v1/ws/reservations"
).replace(/\/$/, "");

async function parseResponse<T>(response: Response, fallback: T): Promise<T> {
  return response.json().catch(() => fallback);
}

export async function createPracticePlanning(payload: PracticeRequestCreate, token: string) {
  const response = await fetch(`${API_BASE_URL}/practice-planning/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse<any>(response, null);
  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`);
  }

  return data;
}

export async function getAllPracticePlannings(token: string): Promise<PracticeRequestResponse[]> {
  const response = await fetch(`${API_BASE_URL}/practice-planning/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<PracticeRequestResponse[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudieron obtener las reservas");
  }
  return data;
}

export async function getMyPracticePlannings(token: string): Promise<PracticeRequestResponse[]> {
  const response = await fetch(`${API_BASE_URL}/practice-planning/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<PracticeRequestResponse[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudieron obtener tus reservas");
  }
  return data;
}

export async function getMyNotifications(token: string): Promise<ReservationNotification[]> {
  const response = await fetch(`${API_BASE_URL}/practice-planning/my/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<ReservationNotification[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudieron obtener las notificaciones");
  }
  return data;
}

export async function markNotificationAsRead(practiceId: number, token: string) {
  const response = await fetch(`${API_BASE_URL}/practice-planning/${practiceId}/notifications/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<any>(response, { ok: false });
  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo actualizar la notificacion");
  }
  return data;
}

export async function updatePracticeStatus(
  practiceId: number,
  status: string,
  token: string,
  reviewComment?: string,
): Promise<PracticeRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/practice-planning/${practiceId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, review_comment: reviewComment }),
  });

  const data = await parseResponse<any>(response, null);
  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo actualizar el estado");
  }

  return data;
}

export async function getAreas(token?: string): Promise<AreaOption[]> {
  const response = await fetch(`${API_BASE_URL}/areas/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await parseResponse<AreaOption[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudieron obtener las areas");
  }
  return data;
}

export async function getLabs(token?: string): Promise<LabOption[]> {
  const response = await fetch(`${API_BASE_URL}/labs/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await parseResponse<LabOption[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudieron obtener los laboratorios");
  }
  return data;
}

export async function getMaterials(token?: string, laboratoryId?: number | null): Promise<MaterialOption[]> {
  const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
  const apiBase = gatewayBase.endsWith("/v1") ? gatewayBase.slice(0, -3) : gatewayBase;
  const search = new URLSearchParams();
  if (laboratoryId) {
    search.set("laboratory_id", String(laboratoryId));
  }
  search.set("available_only", "true");

  const response = await fetch(`${apiBase}/inventory/stock-items/?${search.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await parseResponse<any[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudieron obtener los materiales");
  }

  return data.map((item) => ({
    id: Number(item.id),
    name: item.name,
    category: item.category,
    unit: item.unit,
    availableQuantity: Number(item.quantity_available || 0),
    minimumStock: Number(item.minimum_stock || 0),
    laboratory_id: item.laboratory_id ?? null,
    description: item.description,
  }));
}

export const getMaterialsMock = getMaterials;

export async function getDayAvailability(
  date: string,
  token?: string,
  options?: { laboratoryId?: number | null; areaId?: number | null },
) {
  const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
  const apiBase = gatewayBase.endsWith("/v1") ? gatewayBase.slice(0, -3) : gatewayBase;
  const search = new URLSearchParams();
  search.set("date", date);
  if (options?.laboratoryId) {
    search.set("lab_id", String(options.laboratoryId));
  }
  if (options?.areaId) {
    search.set("area_id", String(options.areaId));
  }

  const response = await fetch(`${apiBase}/availability/day?${search.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await parseResponse<any[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudo cargar la disponibilidad diaria");
  }
  return data;
}

export async function getWeekAvailability(
  startDate: string,
  token?: string,
  options?: { laboratoryId?: number | null; areaId?: number | null },
) {
  const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
  const apiBase = gatewayBase.endsWith("/v1") ? gatewayBase.slice(0, -3) : gatewayBase;
  const search = new URLSearchParams();
  search.set("start_date", startDate);
  if (options?.laboratoryId) {
    search.set("lab_id", String(options.laboratoryId));
  }
  if (options?.areaId) {
    search.set("area_id", String(options.areaId));
  }

  const response = await fetch(`${apiBase}/availability/week?${search.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await parseResponse<any[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudo cargar la disponibilidad semanal");
  }
  return data;
}

export async function getClassTutorials(
  token?: string,
  options?: { laboratoryId?: number | null; date?: string; sessionType?: string | null },
) {
  const gatewayBase = (import.meta.env.VITE_GATEWAY_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
  const apiBase = gatewayBase.endsWith("/v1") ? gatewayBase.slice(0, -3) : gatewayBase;
  const search = new URLSearchParams();
  if (options?.laboratoryId) {
    search.set("laboratory_id", String(options.laboratoryId));
  }
  if (options?.date) {
    search.set("date", options.date);
  }
  if (options?.sessionType) {
    search.set("session_type", options.sessionType);
  }

  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await fetch(`${apiBase}/class-tutorials${suffix}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await parseResponse<any[]>(response, []);
  if (!response.ok) {
    throw new Error((data as any)?.detail || "No se pudieron obtener las clases y tutorías");
  }
  return data;
}

export function subscribeReservationsRealtime(
  token: string,
  handlers: {
    onMessage?: (message: any) => void;
    onOpen?: () => void;
    onClose?: () => void;
  } = {},
) {
  if (!token || typeof window === "undefined") {
    return () => {};
  }

  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let closedManually = false;

  const connect = () => {
    socket = new WebSocket(`${REALTIME_WS_URL}?token=${encodeURIComponent(token)}`);

    socket.addEventListener("open", () => {
      handlers.onOpen?.();
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        handlers.onMessage?.(payload);
      } catch {
        // Ignore malformed realtime frames and keep the socket alive.
      }
    });

    socket.addEventListener("close", () => {
      handlers.onClose?.();
      if (!closedManually) {
        reconnectTimer = window.setTimeout(connect, 1500);
      }
    });
  };

  connect();

  return () => {
    closedManually = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
    }
    if (socket && socket.readyState <= WebSocket.OPEN) {
      socket.close();
    }
  };
}
