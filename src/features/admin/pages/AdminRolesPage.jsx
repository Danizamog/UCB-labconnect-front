import { useMemo, useState } from 'react'
import './AdminRolesPage.css'

const STORAGE_KEY = 'labconnect:users:roles'

const DEFAULT_USERS = [
  {
    id: 'u-001',
    fullName: 'Ariel Vargas',
    email: 'ariel.vargas@ucb.edu.bo',
    role: 'user',
  },
  {
    id: 'u-002',
    fullName: 'Paola Gutiérrez',
    email: 'paola.gutierrez@ucb.edu.bo',
    role: 'admin',
  },
  {
    id: 'u-003',
    fullName: 'Luis Fernández',
    email: 'luis.fernandez@ucb.edu.bo',
    role: 'assistant',
  },
]

function loadInitialUsers() {
  try {
    const storedUsers = localStorage.getItem(STORAGE_KEY)

    if (!storedUsers) {
      return DEFAULT_USERS
    }

    const parsedUsers = JSON.parse(storedUsers)

    if (!Array.isArray(parsedUsers)) {
      return DEFAULT_USERS
    }

    return parsedUsers
  } catch {
    return DEFAULT_USERS
  }
}

function AdminRolesPage() {
  const [users, setUsers] = useState(loadInitialUsers)
  const [savedUsers, setSavedUsers] = useState(loadInitialUsers)
  const [successMessage, setSuccessMessage] = useState('')

  const pendingChanges = useMemo(() => {
    return users.filter((user, index) => user.role !== savedUsers[index]?.role).length
  }, [users, savedUsers])

  const handleRoleChange = (userId, newRole) => {
    setSuccessMessage('')
    setUsers((previousUsers) =>
      previousUsers.map((user) => {
        if (user.id !== userId) {
          return user
        }

        return { ...user, role: newRole }
      }),
    )
  }

  const handleSaveChanges = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
    setSavedUsers(users)
    setSuccessMessage('Roles actualizados correctamente.')
  }

  return (
    <section className="roles-page" aria-label="Administración de roles">
      <header className="roles-header">
        <h2>Administración de roles</h2>
        <p>Asigna y actualiza los permisos de acceso para cada usuario.</p>
      </header>

      <div className="roles-toolbar">
        <span className="roles-counter">
          {pendingChanges} cambio{pendingChanges === 1 ? '' : 's'} pendiente
          {pendingChanges === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className="roles-save-button"
          disabled={pendingChanges === 0}
          onClick={handleSaveChanges}
        >
          Guardar cambios
        </button>
      </div>

      {successMessage ? <p className="roles-success">{successMessage}</p> : null}

      <div className="roles-table-wrap">
        <table className="roles-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>
                  <select
                    className="roles-select"
                    value={user.role}
                    onChange={(event) => handleRoleChange(user.id, event.target.value)}
                  >
                    <option value="admin">Administrador</option>
                    <option value="assistant">Asistente</option>
                    <option value="user">Usuario</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminRolesPage