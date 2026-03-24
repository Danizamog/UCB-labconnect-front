import PocketBase from 'pocketbase'

const POCKETBASE_URL = (import.meta.env.VITE_POCKETBASE_URL || 'https://bd-labconnect.zamoranogamarra.online').replace(/\/$/, '')
const pb = new PocketBase(POCKETBASE_URL)

const ROLES_COLLECTION = 'role'
const USERS_COLLECTION = 'users'

function buildRequestOptions(token) {
  if (!token) {
    return undefined
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}

function mapRoleRecord(record) {
  return {
    id: record.id,
    nombre: record.nombre ?? '',
    descripcion: record.descripcion ?? '',
    permisos: record.permisos ?? [],
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
    roleId: record.role ?? null,
    role: expandedRole
      ? {
          id: expandedRole.id,
          nombre: expandedRole.nombre ?? '',
          descripcion: expandedRole.descripcion ?? '',
          permisos: expandedRole.permisos ?? [],
        }
      : null,
    created: record.created,
    updated: record.updated,
  }
}

export async function listRoles({ token } = {}) {
  const records = await pb.collection(ROLES_COLLECTION).getFullList({
    sort: 'nombre',
    ...buildRequestOptions(token),
  })

  return records.map(mapRoleRecord)
}

export async function createRole(role, { token } = {}) {
  const record = await pb.collection(ROLES_COLLECTION).create(
    {
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: role.permisos,
    },
    buildRequestOptions(token),
  )

  return mapRoleRecord(record)
}

export async function updateRole(roleId, role, { token } = {}) {
  const record = await pb.collection(ROLES_COLLECTION).update(
    roleId,
    {
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: role.permisos,
    },
    buildRequestOptions(token),
  )

  return mapRoleRecord(record)
}

export async function deleteRole(roleId, { token } = {}) {
  await pb.collection(ROLES_COLLECTION).delete(roleId, buildRequestOptions(token))

  return true
}

export async function listUsersWithRoles({ token } = {}) {
  const records = await pb.collection(USERS_COLLECTION).getFullList({
    sort: 'name,email',
    expand: 'role',
    ...buildRequestOptions(token),
  })

  return records.map(mapUserRecord)
}

export async function assignUserRole(userId, roleId, { token } = {}) {
  const record = await pb.collection(USERS_COLLECTION).update(
    userId,
    {
      role: roleId || null,
    },
    buildRequestOptions(token),
  )

  return mapUserRecord(record)
}
