import { useEffect, useState } from 'react'
import { listOperationalUsers } from '../services/profileService'
import './AdminAssetsPage.css'

export default function OperationalDirectoryPage() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    listOperationalUsers('directory').then((rows) => { if (active) setUsers(rows) }).catch((err) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [])
  const filtered = users.filter((user) => `${user.name || ''} ${user.username} ${user.role || ''}`.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20))
  return <section className="infra-page">
    <header className="infra-header"><div><p className="infra-kicker">Consulta operativa</p><h2>Directorio institucional</h2><p>Datos basicos de identificacion para las operaciones de laboratorio.</p></div></header>
    {error ? <p role="alert" className="infra-alert infra-error">{error}</p> : null}
    <section className="infra-card"><label>Buscar<input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Nombre, correo o rol" /></label>
      <table className="infra-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>{filtered.slice((page - 1) * 20, page * 20).map((user) => <tr key={user.id}><td>{user.name || 'Sin nombre'}</td><td>{user.username}</td><td>{user.role || 'Sin rol'}</td></tr>)}</tbody></table>
      <div className="infra-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Pagina {page} de {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div>
    </section>
  </section>
}
