import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, FlaskConical, MapPin, RefreshCw, Search, Users } from 'lucide-react'

const SEARCH_DEBOUNCE_MS = 150
const DEFAULT_VISIBLE_PER_GROUP = 12
const DEFAULT_VISIBLE_FLAT = 24
const AUTO_COLLAPSE_THRESHOLD = 30

function normalizeLabSearchValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es')
    .trim()
}

function compareByName(a, b) {
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'es', { sensitivity: 'base' })
}

function LabChip({ lab, isSelected, onSelect, disabled }) {
  const subtitle = lab.area_name || lab.area || ''
  const location = lab.location || ''
  return (
    <button
      type="button"
      className={`reservations-lab-chip${isSelected ? ' is-selected' : ''}`}
      onClick={() => {
        if (disabled) return
        onSelect(String(lab.id))
      }}
      disabled={disabled}
      aria-pressed={isSelected}
    >
      <span className="reservations-lab-chip-icon" aria-hidden="true">
        <FlaskConical size={18} />
      </span>
      <span className="reservations-lab-chip-body">
        <strong className="reservations-lab-chip-name">{lab.name}</strong>
        {subtitle ? <span className="reservations-lab-chip-area">{subtitle}</span> : null}
        <span className="reservations-lab-chip-meta">
          {lab.capacity ? (
            <span>
              <Users size={12} aria-hidden="true" /> {lab.capacity}
            </span>
          ) : null}
          {location ? (
            <span>
              <MapPin size={12} aria-hidden="true" /> {location}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  )
}

function LabPicker({
  labs,
  selectedLabId,
  onSelect,
  disabled = false,
  emptyHint = '',
  title = 'Elige un laboratorio',
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('area')
  const [groupOverrides, setGroupOverrides] = useState({})
  const [groupVisible, setGroupVisible] = useState({})
  const [flatVisible, setFlatVisible] = useState(DEFAULT_VISIBLE_FLAT)
  // Colapsado por defecto cuando hay un lab pre-seleccionado: el usuario se enfoca
  // en su horario sin ver la lista entera. Se expande al pedir "Cambiar".
  const [isCollapsed, setIsCollapsed] = useState(() => Boolean(selectedLabId))

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Reseteamos los topes "Ver mas" en los handlers (no en un effect reactivo)
  // para evitar cascadas de render y para que el cambio de criterio sienta inmediato.
  const resetVisibleCounts = () => {
    setGroupVisible({})
    setFlatVisible(DEFAULT_VISIBLE_FLAT)
  }

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value)
    resetVisibleCounts()
  }

  const handleSortChange = (nextSort) => {
    if (nextSort === sort) return
    setSort(nextSort)
    resetVisibleCounts()
  }

  const handleLabClick = (labId) => {
    onSelect(labId)
    setIsCollapsed(true)
    setSearchInput('')
    setSearch('')
  }

  const handleExpand = () => {
    setIsCollapsed(false)
  }

  const normalizedSearch = useMemo(() => normalizeLabSearchValue(search), [search])

  const filteredLabs = useMemo(() => {
    if (!normalizedSearch) {
      return labs
    }
    return labs.filter((lab) => {
      const haystack = [lab?.name, lab?.area_name, lab?.area, lab?.location]
        .map((value) => normalizeLabSearchValue(value))
        .join(' ')
      return haystack.includes(normalizedSearch)
    })
  }, [labs, normalizedSearch])

  const sortedFlatLabs = useMemo(() => {
    if (sort === 'capacity') {
      return [...filteredLabs].sort((a, b) => (b.capacity || 0) - (a.capacity || 0))
    }
    return [...filteredLabs].sort(compareByName)
  }, [filteredLabs, sort])

  const groupedLabs = useMemo(() => {
    if (sort !== 'area') {
      return null
    }
    const groups = new Map()
    for (const lab of filteredLabs) {
      const key = String(lab?.area_id || lab?.area_name || lab?.area || 'sin-area')
      const label = lab?.area_name || lab?.area || 'Sin area asignada'
      if (!groups.has(key)) {
        groups.set(key, { id: key, label, labs: [] })
      }
      groups.get(key).labs.push(lab)
    }
    return [...groups.values()]
      .map((group) => ({ ...group, labs: group.labs.slice().sort(compareByName) }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'es', { sensitivity: 'base' }))
  }, [filteredLabs, sort])

  const selectedLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(selectedLabId)) || null,
    [labs, selectedLabId],
  )

  const totalVisible = filteredLabs.length
  const counterText = normalizedSearch
    ? `${totalVisible} resultado${totalVisible === 1 ? '' : 's'} para "${search.trim()}"`
    : `${totalVisible} laboratorio${totalVisible === 1 ? '' : 's'} disponible${totalVisible === 1 ? '' : 's'}`

  const shouldCollapseByDefault = labs.length > AUTO_COLLAPSE_THRESHOLD && !normalizedSearch

  const isGroupOpen = (group) => {
    if (Object.prototype.hasOwnProperty.call(groupOverrides, group.id)) {
      return groupOverrides[group.id]
    }
    if (normalizedSearch) {
      return true
    }
    if (selectedLabId && group.labs.some((lab) => String(lab.id) === String(selectedLabId))) {
      return true
    }
    return !shouldCollapseByDefault
  }

  const toggleGroup = (groupId, nextOpen) => {
    setGroupOverrides((previous) => ({ ...previous, [groupId]: nextOpen }))
  }

  const renderChip = (lab) => (
    <LabChip
      key={lab.id}
      lab={lab}
      isSelected={String(lab.id) === String(selectedLabId || '')}
      onSelect={handleLabClick}
      disabled={disabled}
    />
  )

  const renderGroup = (group) => {
    const open = isGroupOpen(group)
    const total = group.labs.length
    const visible = groupVisible[group.id] ?? DEFAULT_VISIBLE_PER_GROUP
    const chipsToShow = open ? group.labs.slice(0, visible) : []
    const remaining = open ? Math.max(0, total - chipsToShow.length) : 0

    return (
      <section className={`reservations-lab-group${open ? ' is-open' : ''}`} key={group.id}>
        <button
          type="button"
          className="reservations-lab-group-head"
          onClick={() => toggleGroup(group.id, !open)}
          aria-expanded={open}
        >
          <span className="reservations-lab-group-title">
            <ChevronDown size={14} className="reservations-lab-group-caret" aria-hidden="true" />
            <strong>{group.label}</strong>
          </span>
          <span>{total} laboratorio{total === 1 ? '' : 's'}</span>
        </button>

        {open ? (
          <>
            <div className="reservations-lab-list">{chipsToShow.map(renderChip)}</div>
            {remaining > 0 ? (
              <button
                type="button"
                className="reservations-lab-more"
                onClick={() => setGroupVisible((previous) => ({
                  ...previous,
                  [group.id]: total,
                }))}
              >
                Ver {remaining} mas
              </button>
            ) : null}
          </>
        ) : null}
      </section>
    )
  }

  const flatChips = sortedFlatLabs.slice(0, flatVisible)
  const flatRemaining = Math.max(0, sortedFlatLabs.length - flatChips.length)

  const showCollapsed = isCollapsed && selectedLab

  if (showCollapsed) {
    return (
      <div className="reservations-lab-picker is-collapsed">
        <div className="reservations-lab-collapsed-card">
          <span className="reservations-lab-chip-icon" aria-hidden="true">
            <FlaskConical size={20} />
          </span>
          <div className="reservations-lab-collapsed-body">
            <span className="reservations-lab-collapsed-kicker">Laboratorio seleccionado</span>
            <strong className="reservations-lab-collapsed-name">{selectedLab.name}</strong>
            <span className="reservations-lab-collapsed-meta">
              {selectedLab.area_name || selectedLab.area || 'Area sin asignar'}
              {selectedLab.location ? ` · ${selectedLab.location}` : ''}
              {selectedLab.capacity ? ` · Capacidad ${selectedLab.capacity}` : ''}
            </span>
          </div>
          <button
            type="button"
            className="reservations-lab-change-btn"
            onClick={handleExpand}
            disabled={disabled}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="reservations-lab-picker">
      <div className="reservations-lab-picker-head">
        <div>
          <h4>{title}</h4>
          <p>{counterText}</p>
        </div>
        <div className="reservations-sort-group" role="group" aria-label="Orden de laboratorios">
          <button
            type="button"
            className={`reservations-sort-chip ${sort === 'area' ? 'is-active' : ''}`}
            onClick={() => handleSortChange('area')}
          >
            Por area
          </button>
          <button
            type="button"
            className={`reservations-sort-chip ${sort === 'name' ? 'is-active' : ''}`}
            onClick={() => handleSortChange('name')}
          >
            Nombre
          </button>
          <button
            type="button"
            className={`reservations-sort-chip ${sort === 'capacity' ? 'is-active' : ''}`}
            onClick={() => handleSortChange('capacity')}
          >
            Capacidad
          </button>
        </div>
      </div>

      <div className="reservations-lab-finder">
        <label className="reservations-search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nombre, area o ubicacion"
            aria-label="Buscar laboratorio"
            value={searchInput}
            onChange={handleSearchChange}
          />
        </label>
      </div>

      {labs.length === 0 ? (
        <p className="reservations-empty reservations-lab-empty">{emptyHint || 'No hay laboratorios disponibles.'}</p>
      ) : totalVisible === 0 ? (
        <p className="reservations-empty reservations-lab-empty">
          No se encontraron laboratorios para "{search.trim()}".
        </p>
      ) : (
        <div className="reservations-lab-scroll">
          {groupedLabs ? (
            <div className="reservations-lab-groups">
              {groupedLabs.map(renderGroup)}
            </div>
          ) : (
            <>
              <div className="reservations-lab-list">{flatChips.map(renderChip)}</div>
              {flatRemaining > 0 ? (
                <button
                  type="button"
                  className="reservations-lab-more"
                  onClick={() => setFlatVisible((previous) => previous + DEFAULT_VISIBLE_FLAT)}
                >
                  Ver {Math.min(flatRemaining, DEFAULT_VISIBLE_FLAT)} mas ({flatRemaining} restantes)
                </button>
              ) : null}
            </>
          )}
        </div>
      )}

      {selectedLab ? (
        <div className="reservations-lab-selected-card">
          <strong>{selectedLab.name}</strong>
          <span>
            {selectedLab.area_name || selectedLab.area || 'Area sin asignar'}
            {selectedLab.location ? ` · ${selectedLab.location}` : ''}
            {selectedLab.capacity ? ` · Capacidad ${selectedLab.capacity}` : ''}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default LabPicker
