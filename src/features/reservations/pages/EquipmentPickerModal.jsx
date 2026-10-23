/* Carga bajo demanda y filtrado local del catalogo de equipos. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Plus, Check } from 'lucide-react'
import { listAssetsCatalog } from '../../admin/services/infrastructureService'
import './PickerModals.css'

const ASSET_STATUS_LABELS = {
  available: 'Disponible',
  loaned: 'Prestado',
  maintenance: 'Mantenimiento',
  damaged: 'Dañado',
}

// Ventana para elegir equipos del catalogo institucional. Solo se pueden agregar
// equipos disponibles; el resto se muestra atenuado con su estado actual.
function EquipmentPickerModal({ open, onClose, selected = [], onChange }) {
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    document.body.classList.add('reservation-modal-open')
    return () => document.body.classList.remove('reservation-modal-open')
  }, [open])

  useEffect(() => {
    if (!open) return
    setSearchInput('')
    setCategory('')
    setIsLoading(true)
    setError('')
    listAssetsCatalog({ availableOnly: false })
      .then((data) => {
        setItems(Array.isArray(data) ? data : [])
      })
      .catch(() => setError('No se pudo cargar el catálogo de equipos.'))
      .finally(() => setIsLoading(false))
  }, [open])

  const categories = useMemo(() => {
    const set = new Set(items.map((asset) => String(asset.category || '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const selectedMap = useMemo(() => {
    const map = new Map()
    for (const entry of selected) map.set(String(entry.asset_id), entry)
    return map
  }, [selected])

  const filtered = useMemo(() => {
    const needle = searchInput.trim().toLowerCase()
    return items.filter((asset) => {
      const matchesCategory = !category || String(asset.category || '') === category
      const haystack = [asset.name, asset.category, asset.serial_number, asset.laboratory_name]
        .map((v) => String(v || '').toLowerCase())
        .join(' ')
      const matchesSearch = !needle || haystack.includes(needle)
      return matchesCategory && matchesSearch
    })
  }, [items, searchInput, category])

  const addAsset = (asset) => {
    if (selectedMap.has(String(asset.id))) return
    onChange([
      ...selected,
      {
        asset_id: String(asset.id),
        asset_name: asset.name || '',
        category: asset.category || '',
        serial_number: asset.serial_number || '',
        laboratory_id: String(asset.laboratory_id || ''),
        laboratory_name: asset.laboratory_name || '',
        status: asset.status || 'available',
      },
    ])
  }

  const removeAsset = (assetId) => {
    onChange(selected.filter((entry) => String(entry.asset_id) !== String(assetId)))
  }

  if (!open) return null

  const content = (
    <div className="picker-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="picker-modal is-wide" onClick={(event) => event.stopPropagation()}>
        <header className="picker-modal-header">
          <div>
            <p className="picker-modal-kicker">Equipos</p>
            <h3>Seleccionar equipos</h3>
            <p>Solo puedes agregar equipos disponibles. {selected.length} seleccionado{selected.length === 1 ? '' : 's'}.</p>
          </div>
          <button type="button" className="picker-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="picker-modal-toolbar">
          <label className="picker-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar equipo por nombre, serie o laboratorio"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
        </div>

        {categories.length > 0 ? (
          <div className="picker-category-chips">
            <button type="button" className={`picker-chip${!category ? ' is-active' : ''}`} onClick={() => setCategory('')}>
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`picker-chip${category === cat ? ' is-active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}

        <div className="picker-modal-list">
          {isLoading ? (
            <p className="reservations-empty">Cargando equipos...</p>
          ) : error ? (
            <p className="reservations-empty">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="reservations-empty">No se encontraron equipos con esos filtros.</p>
          ) : (
            filtered.map((asset) => {
              const entry = selectedMap.get(String(asset.id))
              const isAvailable = asset.status === 'available'
              return (
                <div key={asset.id} className={`picker-material-row${!isAvailable ? ' is-out' : ''}${entry ? ' is-selected' : ''}`}>
                  <div className="picker-material-info">
                    <strong>{asset.name}</strong>
                    <span className="picker-material-meta">
                      {asset.category ? <span className="picker-cat-badge">{asset.category}</span> : null}
                      {asset.serial_number ? <span>Serie {asset.serial_number}</span> : null}
                      {asset.laboratory_name ? <span>{asset.laboratory_name}</span> : null}
                      {!isAvailable ? (
                        <span className="material-badge agotado">{ASSET_STATUS_LABELS[asset.status] || asset.status}</span>
                      ) : null}
                    </span>
                  </div>
                  {entry ? (
                    <button type="button" className="reservations-secondary" onClick={() => removeAsset(asset.id)}>
                      Quitar
                    </button>
                  ) : (
                    <button type="button" className="picker-add-btn" disabled={!isAvailable} onClick={() => addAsset(asset)}>
                      <Plus size={15} /> Agregar
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="picker-modal-footer">
          <span>{filtered.length} equipo{filtered.length === 1 ? '' : 's'} en el catálogo</span>
          <button type="button" className="reservations-primary picker-done-btn" onClick={onClose}>
            <Check size={16} /> Listo ({selected.length})
          </button>
        </div>
      </section>
    </div>
  )

  return createPortal(content, document.body)
}

export default EquipmentPickerModal
