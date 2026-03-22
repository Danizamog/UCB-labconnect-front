const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001/api/v1";

export type AuthUser = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: "admin" | "lab_manager" | "student";
  is_active: boolean;
  phone?: string | null;
  academic_page?: string | null;
  faculty?: string | null;
  career?: string | null;
  student_code?: string | null;
  campus?: string | null;
  bio?: string | null;
};

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

export async function updateMe(
  payload: {
    phone?: string;
    academic_page?: string;
    faculty?: string;
    career?: string;
    student_code?: string;
    campus?: string;
    bio?: string;
  },
  token: string
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PUT",
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

export async function createUser(
  payload: { username: string; full_name: string; email: string; password: string; role: "admin" | "lab_manager" | "student" },
  token: string
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/users`, {
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

export async function getUsers(token: string): Promise<AuthUser[]> {
  const response = await fetch(`${API_BASE_URL}/auth/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.detail || `Error ${response.status}`);
  }

  return data;
}

export async function updateUser(
  userId: number,
  payload: {
    full_name: string;
    email: string;
    role: "admin" | "lab_manager" | "student";
    is_active: boolean;
    password?: string;
    phone?: string;
    academic_page?: string;
    faculty?: string;
    career?: string;
    student_code?: string;
    campus?: string;
    bio?: string;
  },
  token: string
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
    method: "PUT",
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
