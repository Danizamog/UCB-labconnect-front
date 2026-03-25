import { useEffect, useState } from 'react'
import './AdminAssetsPage.css'

const ASSETS_ENDPOINT = `http://localhost:8000/api/inventory/assets`



function AdminAssetsPage() {
  const [assets, setAssets] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAssets = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('access_token')
        const headers = {
          'Content-Type': 'application/json',
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`${ASSETS_ENDPOINT}/`, { headers })
        const data = await response.json().catch(() => [])

        if (!response.ok) {
          throw new Error(data?.detail || 'No se pudo cargar equipos')
        }

        setAssets(Array.isArray(data) ? data : [])
        setError('')
      } catch (err) {
        setError(err.message || 'Error al cargar equipos')
        setAssets([])
      } finally {
        setLoading(false)
      }
    }

    loadAssets()
  }, [])

  const updateStatus = async (assetId, nextStatus) => {
    setError('')
    setMessage('')

    const previousAssets = assets
    setAssets((previous) =>
      previous.map((asset) =>
        asset.id === assetId ? { ...asset, status: nextStatus } : asset,
      ),
    )

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token')
      const headers = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${ASSETS_ENDPOINT}/${assetId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.detail || 'No se pudo actualizar el estado')
      }

      setMessage('Estado actualizado correctamente.')
    } catch (err) {
      setError(err.message || 'Error al actualizar estado')
      setAssets(previousAssets)
    }
  }

  const prettyStatus = (status) => {
    if (status === 'available') return 'Disponible'
    if (status === 'maintenance') return 'En mantenimiento'
    if (status === 'damaged') return 'Dañado'
    return status
  }

  return (
    <section className="assets-page" aria-label="Gestión de equipos">
      <header className="assets-header">
        <h2>Gestión de equipos</h2>
        <p>Actualiza el estado de los equipos del laboratorio.</p>
      </header>

      {message ? <p className="assets-message">{message}</p> : null}
      {error ? <p className="assets-error">{error}</p> : null}

      {loading ? (
        <p>Cargando equipos...</p>
      ) : assets.length === 0 ? (
        <p>No hay equipos registrados.</p>
      ) : (
        <div className="assets-table-wrap">
          <table className="assets-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Categoría</th>
                <th>Serie</th>
                <th>Estado actual</th>
                <th>Cambiar estado</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.name}</td>
                  <td>{asset.category || '-'}</td>
                  <td>{asset.serial_number || '-'}</td>
                  <td>
                    <span className={`badge badge-${asset.status}`}>
                      {prettyStatus(asset.status)}
                    </span>
                  </td>
                  <td>
                    <select
                      className="assets-select"
                      value={asset.status}
                      onChange={(event) => updateStatus(asset.id, event.target.value)}
                    >
                      <option value="available">Disponible</option>
                      <option value="maintenance">En mantenimiento</option>
                      <option value="damaged">Dañado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default AdminAssetsPage
