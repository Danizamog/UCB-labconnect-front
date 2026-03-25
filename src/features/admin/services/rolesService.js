const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const ROLES_ENDPOINT = import.meta.env.VITE_ROLES_ENDPOINT || '/roles'
const USERS_ENDPOINT = import.meta.env.VITE_ROLE_USERS_ENDPOINT || '/users'

function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `Error ${response.status}`)
  }

  return data
}

function normalizeArrayResponse(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.data)) {
    return data.data
  }

  return []
}

function mapRoleRecord(record) {
  return {
    id: record.id,
    nombre: record.nombre ?? record.name ?? '',
    descripcion: record.descripcion ?? record.description ?? '',
    permisos: record.permisos ?? record.permissions ?? [],
    created: record.created,
    updated: record.updated,
  }
}

function mapUserRecord(record) {
  const expandedRole = record.expand?.role

  return {
    id: record.id,
    name: record.name ?? '',
    email: record.email ?? '',
    roleId: record.roleId ?? (typeof record.role === 'string' ? record.role : record.role?.id) ?? null,
    role: expandedRole
      ? {
          id: expandedRole.id,
          nombre: expandedRole.nombre ?? expandedRole.name ?? '',
          descripcion: expandedRole.descripcion ?? expandedRole.description ?? '',
          permisos: expandedRole.permisos ?? expandedRole.permissions ?? [],
        }
      : record.role && typeof record.role === 'object'
        ? {
            id: record.role.id,
            nombre: record.role.nombre ?? record.role.name ?? '',
            descripcion: record.role.descripcion ?? record.role.description ?? '',
            permisos: record.role.permisos ?? record.role.permissions ?? [],
          }
        : null,
    created: record.created,
    updated: record.updated,
  }
}

export async function listRoles({ token } = {}) {
  const data = await apiRequest(ROLES_ENDPOINT, { token })
  const records = normalizeArrayResponse(data)

  return records.map(mapRoleRecord)
}

export async function createRole(role, { token } = {}) {
  const record = await apiRequest(ROLES_ENDPOINT, {
    method: 'POST',
    token,
    body: {
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: role.permisos,
    },
  })

  return mapRoleRecord(record)
}

export async function updateRole(roleId, role, { token } = {}) {
  const payload = {
    nombre: role.nombre,
    descripcion: role.descripcion,
    permisos: role.permisos,
  }

  let record

  try {
    record = await apiRequest(`${ROLES_ENDPOINT}/${roleId}`, {
      method: 'PUT',
      token,
      body: payload,
    })
  } catch {
    record = await apiRequest(`${ROLES_ENDPOINT}/${roleId}`, {
      method: 'PATCH',
      token,
      body: payload,
    })
  }

  return mapRoleRecord(record)
}

export async function deleteRole(roleId, { token } = {}) {
  await apiRequest(`${ROLES_ENDPOINT}/${roleId}`, {
    method: 'DELETE',
    token,
  })

  return true
}

export async function listUsersWithRoles({ token } = {}) {
  const data = await apiRequest(`${USERS_ENDPOINT}?expand=role`, { token })
  const records = normalizeArrayResponse(data)

  return records.map(mapUserRecord)
}

export async function assignUserRole(userId, roleId, { token } = {}) {
  let record

  try {
    record = await apiRequest(`${USERS_ENDPOINT}/${userId}/role`, {
      method: 'PATCH',
      token,
      body: {
        roleId,
      },
    })
  } catch {
    record = await apiRequest(`${USERS_ENDPOINT}/${userId}`, {
      method: 'PATCH',
      token,
      body: {
        roleId,
      },
    })
  }

  return mapUserRecord(record)
}
