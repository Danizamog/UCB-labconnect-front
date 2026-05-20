import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import {
  createLab,
  deleteLab,
  listAdminAreas,
  listAdminLabsPaginated,
  updateLab,
} from '../services/infrastructureService'
import { listUsersWithRoles } from '../services/rolesService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import './AdminAssetsPage.css'

const defaultForm = {
  name: '',
  location: '',
  capacity: 20,
  description: '',
  area_id: '',
  manager: '',
  is_active: true,
}

const LAB_PAGE_SIZE_OPTIONS = [8, 12, 20, 40]

function AdminLaboratoriosPage({ user }) {
  const [areas, setAreas] = useState([])
  const [labs, setLabs] = useState([])
  const [managers, setManagers] = useState([])
  const [managerQuery, setManagerQuery] = useState('')
  const [showManagerOptions, setShowManagerOptions] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [confirmModal, setConfirmModal] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [labsPerPage, setLabsPerPage] = useState(12)
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [initialLoad, setInitialLoad] = useState(true)

  const canManage = hasAnyPermission(user, ['gestionar_reservas', 'gestionar_reglas_reserva', 'gestionar_accesos_laboratorio'])

  const loadReferenceData = async () => {
    try {
      const [areasData, usersData] = await Promise.all([
        listAdminAreas(),
        listUsersWithRoles(),
      ])
      setAreas(areasData)
      const potentialManagers = usersData.filter(
        (u) => u.role?.nombre === 'Encargado de Laboratorio' || u.role?.nombre === 'Administrador'
      )
      setManagers(potentialManagers)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las areas o encargados')
    }
  }

  const loadLabs = async ({ page: nextPage = page, perPage = labsPerPage, search = debouncedSearch } = {}) => {
    setLoading(true)
    try {
      const result = await listAdminLabsPaginated({ page: nextPage, perPage, search })
      setLabs(result.items)
      setTotalItems(result.total_items)
      setTotalPages(result.total_pages)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los laboratorios')
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }

  const refreshAll = async () => {
    await Promise.all([loadReferenceData(), loadLabs({ page, perPage: labsPerPage, search: debouncedSearch })])
  }

  useEffect(() => { loadReferenceData() }, [])

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(handle)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, labsPerPage])

  useEffect(() => {
    loadLabs({ page, perPage: labsPerPage, search: debouncedSearch })
  }, [page, labsPerPage, debouncedSearch])

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [totalPages, page])

  const areaNameById = useMemo(
    () => Object.fromEntries(areas.map((area) => [String(area.id), area.name])),
    [areas],
  )

  const managerNameById = useMemo(
    () => Object.fromEntries(managers.map((u) => [String(u.id), u.name || u.email || 'Usuario'])),
    [managers],
  )

  const safeTotalPages = Math.max(totalPages, 1)

  const resetForm = () => {
    setEditingId(null)
    setForm(defaultForm)
    setIsFormOpen(false)
    setManagerQuery('')
    setShowManagerOptions(false)
  }

  const handleCreateNew = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canManage) return
    setError('')
    setMessage('')
    const payload = { 
      ...form, 
      area_id: String(form.area_id || ''), 
      manager: form.manager ? String(form.manager) : '',
      capacity: Number(form.capacity) 
    }
    try {
      if (editingId) {
        await updateLab(editingId, payload)
        setMessage('Laboratorio actualizado correctamente.')
      } else {
        await createLab(payload)
        setMessage('Laboratorio creado correctamente.')
      }
      resetForm()
      setIsFormOpen(false)
      await refreshAll()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el laboratorio')
    }
  }

  const handleDelete = (labId) => {
    setConfirmModal({
      message: 'Esta accion no se puede deshacer.',
      onConfirm: async () => {
        setConfirmModal(null)
        setError('')
        setMessage('')
        try {
          await deleteLab(labId)
          setMessage('Laboratorio eliminado correctamente.')
          await refreshAll()
        } catch (err) {
          setError(err.message || 'No se pudo eliminar el laboratorio')
        }
      },
    })
  }

  return (
    <section className="infra-page" aria-label="Laboratorios">
      {confirmModal ? (
        <ConfirmModal
          title="Eliminar laboratorio"
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}
      <header className="infra-header">
        <div>
          <p className="infra-kicker">Estructura academica</p>
          <h2>Espacios de laboratorio</h2>
          <p>Define capacidad, ubicacion y area para que cada reserva use datos confiables.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total</span><strong>{totalItems}</strong></div>
          <div><span>En esta pagina</span><strong>{labs.length}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {initialLoad ? (
        <p className="infra-empty" style={{margin: '24px 40px'}}>Cargando laboratorios...</p>
      ) : (
        <div className="infra-grid">
          <section className="infra-card infra-card-full">
            <div className="infra-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Laboratorios</h3>
                <p>Cada laboratorio pertenece a un area y puede recibir reservas.</p>
              </div>
              <button
                type="button"
                className="infra-primary"
                disabled={!canManage}
                onClick={handleCreateNew}
              >
                Crear laboratorio
              </button>
            </div>

            <div className="infra-toolbar">
              <label className="infra-search">
                <Search size={16} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre, ubicacion, area o encargado"
                />
              </label>
              <div className="infra-directory-controls">
                <label className="infra-select-control">
                  <span>Mostrar</span>
                  <select
                    value={labsPerPage}
                    onChange={(event) => setLabsPerPage(Number(event.target.value) || 12)}
                  >
                    {LAB_PAGE_SIZE_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <span className="infra-inline-hint">
                  Pagina {page} de {safeTotalPages} · {totalItems} laboratorio{totalItems === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {labs.length === 0 ? (
              <p className="infra-empty" style={{ margin: '24px 40px' }}>
                {debouncedSearch ? 'No encontramos laboratorios con ese criterio.' : 'Aun no hay laboratorios registrados.'}
              </p>
            ) : (
            <div className="infra-list">
              {labs.map((lab) => (
                <article key={lab.id} className="infra-item">
                  <div>
                    <strong>{lab.name}</strong>
                    <p>{lab.location} · Capacidad {lab.capacity}</p>
                      <small>
                        {lab.area_name || areaNameById[String(lab.area_id)] || 'Sin area'}
                        {lab.manager ? ` · Encargado: ${lab.manager_name || managerNameById[String(lab.manager)] || 'Desconocido'}` : ''}
                      </small>

                  </div>
                  <div className="infra-actions compact">
                    <button
                      type="button"
                      className="infra-secondary"
                      disabled={!canManage}
                      onClick={() => {
                        setEditingId(lab.id)
                        setForm({
                          name: lab.name,
                          location: lab.location,
                          capacity: lab.capacity,
                          description: lab.description || '',
                          manager: lab.manager || '',
                          area_id: String(lab.area_id),
                          is_active: lab.is_active !== false,
                          allowed_roles: Array.isArray(lab.allowed_roles) ? lab.allowed_roles : [],
                          allowed_user_ids: Array.isArray(lab.allowed_user_ids) ? lab.allowed_user_ids : [],
                          required_permissions: Array.isArray(lab.required_permissions) ? lab.required_permissions : [],
                        })
                        setManagerQuery(lab.manager_name || managerNameById[String(lab.manager)] || '')
                        setIsFormOpen(true)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="infra-danger"
                      disabled={!canManage}
                      onClick={() => handleDelete(lab.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
            )}

            {totalPages > 1 ? (
              <div className="infra-pagination">
                <button
                  type="button"
                  className="infra-secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Anterior
                </button>
                <span className="infra-inline-hint">Pagina {page} de {safeTotalPages}</span>
                <button
                  type="button"
                  className="infra-secondary"
                  disabled={page >= safeTotalPages || loading}
                  onClick={() => setPage((current) => Math.min(current + 1, safeTotalPages))}
                >
                  Siguiente
                </button>
              </div>
            ) : null}

            {isFormOpen && createPortal(
              <div className="infra-modal-backdrop" onClick={resetForm} role="dialog" aria-modal="true">
                <div className="infra-modal-content" onClick={(e) => e.stopPropagation()}>
                  <header className="infra-modal-header">
                    <h3>{editingId ? 'Editar laboratorio' : 'Crear laboratorio'}</h3>
                    <button type="button" className="infra-modal-close" onClick={resetForm}>×</button>
                  </header>
                  <div className="infra-modal-body">
                    <form className="infra-form" onSubmit={handleSubmit}>
                      <div className="infra-form-section">
                        <span className="infra-form-section-label">1 — Identificacion y area</span>
                        <div className="infra-form-grid">
                          <label>
                            <span>Nombre</span>
                            <input
                              value={form.name}
                              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                              required
                              disabled={!canManage}
                            />
                          </label>
                          <label>
                            <span>Area</span>
                            <select
                              value={form.area_id}
                              onChange={(event) => setForm((prev) => ({ ...prev, area_id: event.target.value }))}
                              required
                              disabled={!canManage}
                            >
                              <option value="">Selecciona un area</option>
                              {areas.map((area) => (
                                <option key={area.id} value={area.id}>{area.name}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                      <div className="infra-form-section">
                        <span className="infra-form-section-label">2 — Ubicacion y capacidad</span>
                        <div className="infra-form-grid">
                          <label>
                            <span>Ubicacion</span>
                            <input
                              value={form.location}
                              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                              required
                              disabled={!canManage}
                            />
                          </label>
                          <label>
                            <span>Capacidad</span>
                            <input
                              type="number"
                              min="1"
                              value={form.capacity}
                              onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
                              required
                              disabled={!canManage}
                            />
                          </label>
                        </div>
                        <label>
                          <span>Descripcion</span>
                          <textarea
                            rows="3"
                            value={form.description}
                            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                            disabled={!canManage}
                          />
                        </label>
                      </div>
                      <div className="infra-form-section">
                        <span className="infra-form-section-label">3 — Configuracion</span>
                        <div className="infra-form-grid" style={{ alignItems: 'end' }}>
                          <label className="infra-checkbox">
                            <input
                              type="checkbox"
                              checked={form.is_active}
                              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                              disabled={!canManage}
                            />
                            <span>Laboratorio activo para reservas</span>
                          </label>
                            <label>
                              <span>Encargado del laboratorio</span>
                              <div className="infra-autocomplete" style={{ position: 'relative' }}>
                                <input
                                  value={managerQuery}
                                  onChange={(e) => { setManagerQuery(e.target.value); setForm((prev) => ({ ...prev, manager: '' })); setShowManagerOptions(true) }}
                                  onFocus={() => setShowManagerOptions(true)}
                                  placeholder="Buscar encargado..."
                                  disabled={!canManage}
                                  aria-autocomplete="list"
                                />
                                {showManagerOptions && (
                                  <ul className="infra-autocomplete-list" role="listbox">

                                    {managers
                                      .filter((m) => ((m.name || m.email || m.id) || '').toLowerCase().includes((managerQuery || '').toLowerCase()))
                                      .slice(0, 12)
                                      .map((m) => (
                                        <li
                                          key={m.id}
                                          className="infra-autocomplete-item"
                                          onMouseDown={(e) => { e.preventDefault(); setForm((prev) => ({ ...prev, manager: m.id })); setManagerQuery(m.name || m.email || m.id); setShowManagerOptions(false) }}
                                        >
                                          {m.name || m.email || m.id}
                                        </li>
                                      ))}
                                  </ul>
                                )}
                              </div>
                            </label>
                        </div>
                      </div>
                      <div className="infra-actions">
                        <button type="submit" className="infra-primary" disabled={!canManage}>
                          {editingId ? 'Actualizar laboratorio' : 'Crear laboratorio'}
                        </button>
                        <button type="button" className="infra-secondary" onClick={resetForm} disabled={!canManage}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminLaboratoriosPage
