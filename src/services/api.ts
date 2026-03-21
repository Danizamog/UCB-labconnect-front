const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001/api/v1";

export async function loginRequest(email: string, password: string) {
  const body = new URLSearchParams();
  body.append("username", email); // FastAPI espera "username", pero aquí enviamos el correo
  body.append("password", password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`);
  }

  return data;
}

export async function googleLoginRequest(credential: string) {
  const response = await fetch(`${API_BASE_URL}/auth/google-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`);
  }

  return data;
}

export async function getMe(token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`);
  }

  return data;
}