/* Efectos de carga bajo demanda, reset de filtros al abrir y busqueda con debounce; el
   estado de carga/reset es intencional. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Plus, Check } from 'lucide-react'
import { listGlobalMaterials, MATERIAL_CATEGORIES, normalizeCategory } from '../../admin/services/infrastructureService'
import './PickerModals.css'

const PER_PAGE = 12

// Ventana para elegir materiales del catalogo GLOBAL (todos los laboratorios), con buscador,
// filtro por categoria y paginacion server-side. Reutilizable para "Reactivos" y "Materiales".
function MaterialPickerModal({
  open,
  onClose,
  title = 'Seleccionar materiales',
  kicker = 'Materiales',
  initialCategory = '',
  selected = [],
  onChange,
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(initialCategory)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 0, page: 1 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    document.body.classList.add('reservation-modal-open')
    return () => document.body.classList.remove('reservation-modal-open')
  }, [open])

  // Al abrir, arrancar con la categoria inicial y sin busqueda.
  useEffect(() => {
    if (open) {
      setCategory(initialCategory)
      setSearchInput('')
      setSearch('')
      setPage(1)
    }
  }, [open, initialCategory])

  // Debounce del buscador.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const requestRef = useRef(0)
  const fetchCatalog = useCallback(() => {
    const reqId = requestRef.current + 1
    requestRef.current = reqId
    setIsLoading(true)
    setError('')
    listGlobalMaterials({ search, category, page, perPage: PER_PAGE })
      .then((result) => {
        if (reqId !== requestRef.current) return
        setData({
          items: Array.isArray(result?.items) ? result.items : [],
          totalItems: Number(result?.totalItems || 0),
          totalPages: Number(result?.totalPages || 0),
          page: Number(result?.page || 1),
        })
      })
      .catch(() => {
        if (reqId === requestRef.current) setError('No se pudo cargar el catálogo de materiales.')
      })
      .finally(() => {
        if (reqId === requestRef.current) setIsLoading(false)
      })
  }, [search, category, page])

  useEffect(() => {
    if (!open) return
    fetchCatalog()
  }, [open, fetchCatalog])

  const selectedMap = useMemo(() => {
    const map = new Map()
    for (const entry of selected) {
      map.set(String(entry.stock_item_id), entry)
    }
    return map
  }, [selected])

  const addMaterial = (material) => {
    if (selectedMap.has(String(material.id))) return
    const next = [
      ...selected,
      {
        stock_item_id: String(material.id),
        quantity: 1,
        name: material.name || '',
        unit: material.unit || '',
        category: normalizeCategory(material.category),
        quantity_available: Number(material.quantity_available || 0),
        limite_reserva_usuario: Number(material.limite_reserva_usuario || 0),
      },
    ]
    onChange(next)
  }

  const removeMaterial = (stockItemId) => {
    onChange(selected.filter((entry) => String(entry.stock_item_id) !== String(stockItemId)))
  }

  const setQuantity = (stockItemId, rawValue, effectiveMax) => {
    let value = Math.max(1, Number(rawValue) || 1)
    if (effectiveMax > 0) value = Math.min(value, effectiveMax)
    onChange(
      selected.map((entry) =>
        String(entry.stock_item_id) === String(stockItemId) ? { ...entry, quantity: value } : entry,
      ),
    )
  }

  if (!open) return null

  const totalPages = Math.max(1, data.totalPages)

  const content = (
    <div className="picker-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="picker-modal is-wide" onClick={(event) => event.stopPropagation()}>
        <header className="picker-modal-header">
          <div>
            <p className="picker-modal-kicker">{kicker}</p>
            <h3>{title}</h3>
            <p>Catálogo compartido por todos los laboratorios. {selected.length} seleccionado{selected.length === 1 ? '' : 's'}.</p>
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
              placeholder="Buscar material por nombre"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
        </div>

        <div className="picker-category-chips">
          <button
            type="button"
            className={`picker-chip${!category ? ' is-active' : ''}`}
            onClick={() => { setCategory(''); setPage(1) }}
          >
            Todas
          </button>
          {MATERIAL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`picker-chip${category === cat ? ' is-active' : ''}`}
              onClick={() => { setCategory(cat); setPage(1) }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="picker-modal-list">
          {isLoading ? (
            <p className="reservations-empty">Cargando materiales...</p>
          ) : error ? (
            <p className="reservations-empty">{error}</p>
          ) : data.items.length === 0 ? (
            <p className="reservations-empty">No se encontraron materiales con esos filtros.</p>
          ) : (
            data.items.map((material) => {
              const entry = selectedMap.get(String(material.id))
              const stock = Number(material.quantity_available || 0)
              const limit = Number(material.limite_reserva_usuario || 0)
              const out = stock <= 0
              const effectiveMax = limit > 0 ? Math.min(stock, limit) : stock
              return (
                <div key={material.id} className={`picker-material-row${out ? ' is-out' : ''}${entry ? ' is-selected' : ''}`}>
                  <div className="picker-material-info">
                    <strong>{material.name}</strong>
                    <span className="picker-material-meta">
                      <span className="picker-cat-badge">{normalizeCategory(material.category)}</span>
                      {out ? (
                        <span className="material-badge agotado">Agotado</span>
                      ) : (
                        <span>{stock} {material.unit || ''} disp.{limit > 0 ? ` · máx ${limit}` : ''}</span>
                      )}
                    </span>
                  </div>
                  {entry ? (
                    <div className="picker-material-controls">
                      <input
                        type="number"
                        min="1"
                        max={Math.max(effectiveMax, 1)}
                        value={entry.quantity}
                        disabled={out}
                        onChange={(event) => setQuantity(material.id, event.target.value, effectiveMax)}
                      />
                      <button type="button" className="reservations-secondary" onClick={() => removeMaterial(material.id)}>
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="picker-add-btn"
                      disabled={out}
                      onClick={() => addMaterial(material)}
                    >
                      <Plus size={15} /> Agregar
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="picker-modal-footer">
          <div className="picker-pagination">
            <button
              type="button"
              className="reservations-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              Anterior
            </button>
            <span>Página {data.page} de {totalPages} · {data.totalItems} materiales</span>
            <button
              type="button"
              className="reservations-secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Siguiente
            </button>
          </div>
          <button type="button" className="reservations-primary picker-done-btn" onClick={onClose}>
            <Check size={16} /> Listo ({selected.length})
          </button>
        </div>
      </section>
    </div>
  )

  return createPortal(content, document.body)
}

export default MaterialPickerModal
