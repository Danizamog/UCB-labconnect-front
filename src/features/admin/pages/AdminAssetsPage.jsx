import { useEffect, useState } from 'react'
import './AdminAssetsPage.css'

const INVENTORY_API = (import.meta.env.VITE_INVENTORY_API_BASE_URL || '').replace(/\/$/, '')

const FALLBACK_ASSETS = [
  { id: 1, name: 'Osciloscopio', category: 'Electrónica', serial_number: 'OSC-001', status: 'available' },
  { id: 2, name: 'Fuente DC', category: 'Electrónica', serial_number: 'FDC-004', status: 'maintenance' },
  { id: 3, name: 'Multímetro', category: 'Instrumentación', serial_number: 'MUL-013', status: 'damaged' },
]

function AdminAssetsPage() {
  const [assets, setAssets] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const response = await fetch(`${INVENTORY_API}/`)
        const data = await response.json().catch(() => [])

        if (!response.ok) {
          throw new Error(data?.detail || 'No se pudo cargar equipos')
        }

        setAssets(Array.isArray(data) ? data : [])
      } catch {
        setAssets(FALLBACK_ASSETS)
        setMessage('Mostrando datos de prueba. El servicio de inventario no respondió.')
      }
    }

    loadAssets()
  }, [])

  const updateStatus = async (assetId, nextStatus) => {
    setError('')
    setMessage('')

    setAssets((previous) =>
      previous.map((asset) =>
        asset.id === assetId ? { ...asset, status: nextStatus } : asset,
      ),
    )

    try {
      const response = await fetch(`${INVENTORY_API}/${assetId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.detail || 'No se pudo actualizar el estado en backend')
      }

      setMessage('Estado actualizado correctamente.')
    } catch {
      setMessage('Estado actualizado solo en vista local (sin conexión al backend).')
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
    </section>
  )
}

export default AdminAssetsPage
