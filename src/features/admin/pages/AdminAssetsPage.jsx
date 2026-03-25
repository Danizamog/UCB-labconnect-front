import { useCallback, useEffect, useState } from 'react'
import './AdminAssetsPage.css'

const ASSETS_ENDPOINT = `http://localhost:8000/api/inventory/assets`

function AdminAssetsPage() {
  const [assets, setAssets] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formValues, setFormValues] = useState({
    name: '',
    category: 'Equipos',
    description: '',
    serial_number: '',
    laboratory_id: '',
    location: '',
    status: 'available',
  })
  const [formErrors, setFormErrors] = useState({
    name: false,
    location: false,
    status: false,
  })

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token')
    const headers = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }, [])

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${ASSETS_ENDPOINT}/`, { headers: getHeaders() })
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
  }, [getHeaders])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const validateForm = () => {
    const nextErrors = {
      name: !formValues.name.trim(),
      location: !formValues.location.trim(),
      status: !formValues.status,
    }

    setFormErrors(nextErrors)
    return !Object.values(nextErrors).some(Boolean)
  }

  const handleCreateAsset = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!validateForm()) {
      setError('Completa los campos obligatorios: Nombre, Estado y Ubicación.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${ASSETS_ENDPOINT}/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: formValues.name.trim(),
          category: formValues.category,
          description: formValues.description.trim() || null,
          serial_number: formValues.serial_number.trim() || null,
          laboratory_id: formValues.laboratory_id ? parseInt(formValues.laboratory_id, 10) : null,
          location: formValues.location.trim(),
          status: formValues.status,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = Array.isArray(data?.detail)
          ? data.detail.map((item) => item?.msg).filter(Boolean).join(' | ')
          : data?.detail
        throw new Error(detail || 'No se pudo registrar el equipo')
      }

      setFormValues({
        name: '',
        category: 'Equipos',
        description: '',
        serial_number: '',
        laboratory_id: '',
        location: '',
        status: 'available',
      })
      setFormErrors({ name: false, location: false, status: false })
      setMessage('Equipo registrado correctamente. Inventario actualizado.')
      await loadAssets()
    } catch (err) {
      setError(err.message || 'Error al registrar el equipo')
    } finally {
      setSubmitting(false)
    }
  }

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
      const response = await fetch(`${ASSETS_ENDPOINT}/${assetId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
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
        <p>Registra equipos y actualiza su estado en el inventario del laboratorio.</p>
      </header>

      <form className="assets-form" onSubmit={handleCreateAsset} noValidate>
        <h3>Registrar nuevo elemento</h3>

        <div className="assets-form-grid">
          <label className="assets-field">
            <span>Nombre del Equipo *</span>
            <input
              type="text"
              value={formValues.name}
              onChange={(event) => {
                const value = event.target.value
                setFormValues((prev) => ({ ...prev, name: value }))
                if (value.trim()) {
                  setFormErrors((prev) => ({ ...prev, name: false }))
                }
              }}
              className={formErrors.name ? 'field-error' : ''}
              placeholder="Ej: Microscopio"
            />
          </label>

          <label className="assets-field">
            <span>Categoría</span>
            <select
              value={formValues.category}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, category: event.target.value }))
              }
            >
              <option value="Equipos">Equipos</option>
              <option value="Herramientas">Herramientas</option>
              <option value="Reactivos">Reactivos</option>
            </select>
          </label>

          <label className="assets-field">
            <span>Descripción</span>
            <input
              type="text"
              value={formValues.description}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Ej: Equipo de prueba"
            />
          </label>

          <label className="assets-field">
            <span>Nro. de serie</span>
            <input
              type="text"
              value={formValues.serial_number}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, serial_number: event.target.value }))
              }
              placeholder="Ej: MIC-001"
            />
          </label>

          <label className="assets-field">
            <span>ID de laboratorio</span>
            <input
              type="number"
              min="0"
              value={formValues.laboratory_id}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, laboratory_id: event.target.value }))
              }
              placeholder="Ej: 1"
            />
          </label>

          <label className="assets-field">
            <span>Estado Inicial *</span>
            <select
              value={formValues.status}
              onChange={(event) => {
                const value = event.target.value
                setFormValues((prev) => ({ ...prev, status: value }))
                if (value) {
                  setFormErrors((prev) => ({ ...prev, status: false }))
                }
              }}
              className={formErrors.status ? 'field-error' : ''}
            >
              <option value="available">Operativo (Disponible)</option>
              <option value="maintenance">En mantenimiento</option>
              <option value="damaged">Dañado</option>
            </select>
          </label>

          <label className="assets-field">
            <span>Ubicación *</span>
            <input
              type="text"
              value={formValues.location}
              onChange={(event) => {
                const value = event.target.value
                setFormValues((prev) => ({ ...prev, location: value }))
                if (value.trim()) {
                  setFormErrors((prev) => ({ ...prev, location: false }))
                }
              }}
              className={formErrors.location ? 'field-error' : ''}
              placeholder="Ej: Laboratorio A"
            />
          </label>

        </div>

        <button className="assets-save-button" type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
      </form>

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
                <th>Descripción</th>
                <th>Serie</th>
                <th>Lab ID</th>
                <th>Ubicación</th>
                <th>Estado actual</th>
                <th>Cambiar estado</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.name}</td>
                  <td>{asset.category || '-'}</td>
                  <td>{asset.description || '-'}</td>
                  <td>{asset.serial_number || '-'}</td>
                  <td>{asset.laboratory_id ?? '-'}</td>
                  <td>{asset.location || '-'}</td>
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
