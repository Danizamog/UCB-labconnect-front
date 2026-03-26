import { useEffect, useMemo, useState } from 'react'
import {
  createLoanRecord,
  listAdminLabs,
  listAssets,
  listLoanRecords,
  listLoansDashboard,
  listMaterials,
  returnLoanRecord,
} from '../services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import './AdminLoansPage.css'

function getDefaultDueAt() {
  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(18, 0, 0, 0)
  return nextDay.toISOString().slice(0, 16)
}

const defaultLoanForm = {
  loan_type: 'asset',
  asset_id: '',
  stock_item_id: '',
  borrower_name: '',
  borrower_email: '',
  borrower_role: 'Estudiante',
  purpose: '',
  quantity: 1,
  due_at: getDefaultDueAt(),
  notes: '',
}

const statusLabels = {
  active: 'Activo',
  overdue: 'Vencido',
  returned: 'Devuelto',
}

const typeLabels = {
  asset: 'Equipo',
  material: 'Material',
}

const sourceLabels = {
  manual: 'Manual',
  practice_request: 'Desde reserva',
}

const returnConditionLabels = {
  ok: 'Sin novedades',
  issues: 'Con observaciones',
  cancelled: 'Cerrado por cancelacion',
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function AdminLoansPage({ user }) {
  const [dashboard, setDashboard] = useState(null)
  const [loans, setLoans] = useState([])
  const [assets, setAssets] = useState([])
  const [materials, setMaterials] = useState([])
  const [labs, setLabs] = useState([])
  const [filters, setFilters] = useState({ status: '', loan_type: '', source_type: 'practice_request', search: '' })
  const [loanForm, setLoanForm] = useState(defaultLoanForm)
  const [selectedReturnLoan, setSelectedReturnLoan] = useState(null)
  const [returnForm, setReturnForm] = useState({ return_condition: 'ok', return_notes: '', incident_notes: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManageLoans = hasAnyPermission(user, ['gestionar_prestamos'])
  const canViewReports = hasAnyPermission(user, ['gestionar_prestamos', 'generar_reportes', 'consultar_estadisticas'])

  const loadData = async () => {
    setLoading(true)
    try {
      const [dashboardResult, loansResult, assetsResult, materialsResult, labsResult] = await Promise.allSettled([
        listLoansDashboard(),
        listLoanRecords(filters),
        listAssets(),
        listMaterials(),
        listAdminLabs(),
      ])

      const issues = []

      if (dashboardResult.status === 'fulfilled') {
        setDashboard(dashboardResult.value)
      } else {
        setDashboard(null)
        issues.push(dashboardResult.reason?.message || 'No se pudo cargar el dashboard de prestamos')
      }

      if (loansResult.status === 'fulfilled') {
        setLoans(loansResult.value)
      } else {
        setLoans([])
        issues.push(loansResult.reason?.message || 'No se pudo cargar el historial de prestamos')
      }

      setAssets(assetsResult.status === 'fulfilled' ? assetsResult.value : [])
      setMaterials(materialsResult.status === 'fulfilled' ? materialsResult.value : [])
      setLabs(labsResult.status === 'fulfilled' ? labsResult.value : [])
      setError(issues[0] || '')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canViewReports) return
    loadData()
  }, [filters.status, filters.loan_type, filters.source_type, filters.search])

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [Number(lab.id), lab.name])),
    [labs],
  )

  const availableAssets = useMemo(
    () => assets.filter((asset) => asset.status === 'available'),
    [assets],
  )

  const availableMaterials = useMemo(
    () => materials.filter((material) => Number(material.quantity_available) > 0),
    [materials],
  )

  const selectedMaterial = useMemo(
    () => availableMaterials.find((material) => String(material.id) === String(loanForm.stock_item_id)),
    [availableMaterials, loanForm.stock_item_id],
  )

  const summaryCards = useMemo(() => ([
    { label: 'Prestamos activos', value: dashboard?.total_active || 0, tone: 'deep' },
    { label: 'Vencidos', value: dashboard?.overdue_count || 0, tone: 'danger' },
    { label: 'Vencen hoy', value: dashboard?.due_today_count || 0, tone: 'warning' },
    { label: 'Devueltos este mes', value: dashboard?.returned_this_month || 0, tone: 'calm' },
  ]), [dashboard])

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const resetForm = () => {
    setLoanForm({ ...defaultLoanForm, due_at: getDefaultDueAt() })
  }

  const handleCreateLoan = async (event) => {
    event.preventDefault()
    if (!canManageLoans) return

    resetFeedback()
    setSubmitting(true)
    try {
      const payload = {
        ...loanForm,
        quantity: Number(loanForm.quantity),
        asset_id: loanForm.loan_type === 'asset' ? Number(loanForm.asset_id) : null,
        stock_item_id: loanForm.loan_type === 'material' ? Number(loanForm.stock_item_id) : null,
      }

      await createLoanRecord(payload)
      setMessage('Prestamo registrado correctamente.')
      resetForm()
      await loadData()
    } catch (requestError) {
      setError(requestError.message || 'No se pudo registrar el prestamo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturnLoan = async (loan) => {
    if (!canManageLoans) return

    resetFeedback()
    try {
      await returnLoanRecord(loan.id, returnForm)
      setMessage(`Prestamo de ${loan.item_name} marcado como devuelto.`)
      setSelectedReturnLoan(null)
      setReturnForm({ return_condition: 'ok', return_notes: '', incident_notes: '' })
      await loadData()
    } catch (requestError) {
      setError(requestError.message || 'No se pudo registrar la devolucion')
    }
  }

  if (!canViewReports) {
    return (
      <section className="loans-page">
        <p className="loans-alert error">No tienes permisos para ver la gestion de prestamos.</p>
      </section>
    )
  }

  return (
    <section className="loans-page" aria-label="Control de prestamos">
      <header className="loans-hero">
        <div>
          <p className="loans-kicker">Operacion de inventario</p>
          <h2>Materiales vinculados a reservas y prestamos manuales</h2>
          <p>
            Cuando una practica aprobada incluye materiales, el seguimiento aparece aqui automaticamente. Desde esta bandeja puedes cerrar devoluciones y registrar incidencias.
          </p>
        </div>
        <div className="loans-hero-side">
          <strong>{dashboard?.asset_loans_active || 0} equipos activos</strong>
          <span>{dashboard?.material_loans_active || 0} materiales activos</span>
        </div>
      </header>

      {message ? <p className="loans-alert success">{message}</p> : null}
      {error ? <p className="loans-alert error">{error}</p> : null}

      <section className="loans-summary">
        {summaryCards.map((card) => (
          <article key={card.label} className={`loans-stat tone-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      {loading ? <p className="loans-empty">Cargando panel de prestamos...</p> : null}

      {!loading ? (
        <>
          <section className="loans-grid">
            <article className="loans-card">
              <div className="loans-card-head">
                <div>
                  <p className="loans-card-kicker">Radar operativo</p>
                  <h3>Estado actual del modulo</h3>
                </div>
              </div>

              <div className="loans-pill-grid">
                {(dashboard?.status_breakdown || []).length ? (
                  dashboard.status_breakdown.map((item) => (
                    <div key={item.label} className={`loans-pill status-${item.label}`}>
                      <span>{statusLabels[item.label] || item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))
                ) : (
                  <p className="loans-empty compact">Aprueba una reserva con materiales o registra un prestamo manual para activar este radar.</p>
                )}
              </div>

              <div className="loans-chart">
                <div className="loans-chart-head">
                  <h4>Movimiento de los ultimos 7 dias</h4>
                </div>
                <div className="loans-chart-bars">
                  {(dashboard?.loan_trend || []).map((point) => (
                    <div key={point.date} className="loans-chart-bar">
                      <span style={{ height: `${Math.max(point.value * 18, point.value ? 24 : 8)}px` }} />
                      <strong>{point.value}</strong>
                      <small>{point.date.slice(5)}</small>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="loans-card">
              <div className="loans-card-head">
                <div>
                  <p className="loans-card-kicker">Alertas de stock</p>
                  <h3>Materiales que requieren atencion</h3>
                </div>
                <strong>{dashboard?.low_stock_materials || 0}</strong>
              </div>

              <div className="loans-alert-list">
                {(dashboard?.low_stock_alerts || []).length ? (
                  dashboard.low_stock_alerts.map((item) => (
                    <article key={item.id} className="loans-alert-item">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.category}</p>
                      </div>
                      <div className="loans-alert-qty">
                        <span>{item.quantity_available} {item.unit}</span>
                        <small>Minimo {item.minimum_stock}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="loans-empty compact">No hay alertas criticas de stock en este momento.</p>
                )}
              </div>
            </article>
          </section>

          <section className="loans-grid secondary">
            {canManageLoans ? (
              <article className="loans-card">
                <div className="loans-card-head">
                  <div>
                    <p className="loans-card-kicker">Nuevo movimiento</p>
                    <h3>Registrar prestamo</h3>
                  </div>
                </div>

                <form className="loans-form" onSubmit={handleCreateLoan}>
                  <div className="loans-form-grid">
                    <label>
                      <span>Tipo de prestamo</span>
                      <select
                        value={loanForm.loan_type}
                        onChange={(event) => setLoanForm((previous) => ({
                          ...previous,
                          loan_type: event.target.value,
                          asset_id: '',
                          stock_item_id: '',
                          quantity: 1,
                        }))}
                      >
                        <option value="asset">Equipo</option>
                        <option value="material">Material</option>
                      </select>
                    </label>

                    {loanForm.loan_type === 'asset' ? (
                      <label>
                        <span>Equipo disponible</span>
                        <select
                          value={loanForm.asset_id}
                          onChange={(event) => setLoanForm((previous) => ({ ...previous, asset_id: event.target.value }))}
                          required
                        >
                          <option value="">Selecciona un equipo</option>
                          {availableAssets.map((asset) => (
                            <option key={asset.id} value={asset.id}>{asset.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        <span>Material disponible</span>
                        <select
                          value={loanForm.stock_item_id}
                          onChange={(event) => setLoanForm((previous) => ({ ...previous, stock_item_id: event.target.value }))}
                          required
                        >
                          <option value="">Selecciona un material</option>
                          {availableMaterials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.name} ({material.quantity_available} {material.unit})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label>
                      <span>Responsable</span>
                      <input
                        value={loanForm.borrower_name}
                        onChange={(event) => setLoanForm((previous) => ({ ...previous, borrower_name: event.target.value }))}
                        required
                      />
                    </label>

                    <label>
                      <span>Correo institucional</span>
                      <input
                        type="email"
                        value={loanForm.borrower_email}
                        onChange={(event) => setLoanForm((previous) => ({ ...previous, borrower_email: event.target.value }))}
                        required
                      />
                    </label>

                    <label>
                      <span>Perfil academico</span>
                      <select
                        value={loanForm.borrower_role}
                        onChange={(event) => setLoanForm((previous) => ({ ...previous, borrower_role: event.target.value }))}
                      >
                        <option value="Estudiante">Estudiante</option>
                        <option value="Docente">Docente</option>
                        <option value="Encargado">Encargado</option>
                        <option value="Invitado">Invitado</option>
                      </select>
                    </label>

                    <label>
                      <span>Fecha limite</span>
                      <input
                        type="datetime-local"
                        value={loanForm.due_at}
                        onChange={(event) => setLoanForm((previous) => ({ ...previous, due_at: event.target.value }))}
                        required
                      />
                    </label>

                    {loanForm.loan_type === 'material' ? (
                      <label>
                        <span>Cantidad</span>
                        <input
                          type="number"
                          min="1"
                          max={selectedMaterial?.quantity_available || 1}
                          value={loanForm.quantity}
                          onChange={(event) => setLoanForm((previous) => ({ ...previous, quantity: event.target.value }))}
                          required
                        />
                      </label>
                    ) : null}
                  </div>

                  <label>
                    <span>Motivo o practica asociada</span>
                    <textarea
                      rows="3"
                      value={loanForm.purpose}
                      onChange={(event) => setLoanForm((previous) => ({ ...previous, purpose: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    <span>Observaciones</span>
                    <textarea
                      rows="2"
                      value={loanForm.notes}
                      onChange={(event) => setLoanForm((previous) => ({ ...previous, notes: event.target.value }))}
                    />
                  </label>

                  <div className="loans-actions">
                    <button type="submit" className="loans-primary" disabled={submitting}>
                      {submitting ? 'Registrando...' : 'Registrar prestamo'}
                    </button>
                    <button type="button" className="loans-secondary" onClick={resetForm} disabled={submitting}>
                      Limpiar formulario
                    </button>
                  </div>
                </form>
              </article>
            ) : null}

            <article className="loans-card">
              <div className="loans-card-head">
                <div>
                  <p className="loans-card-kicker">Actividad reciente</p>
                  <h3>Ultimos movimientos registrados</h3>
                </div>
              </div>

              <div className="loans-list">
                {dashboard?.recent_loans?.length ? (
                  dashboard.recent_loans.map((loan) => (
                    <article key={loan.id} className={`loans-activity status-${loan.status}`}>
                      <div className="loans-activity-head">
                        <div>
                          <strong>{loan.item_name}</strong>
                          <p>{loan.borrower_name} · {typeLabels[loan.loan_type] || loan.loan_type}</p>
                        </div>
                        <span className={`loans-badge status-${loan.status}`}>
                          {statusLabels[loan.status] || loan.status}
                        </span>
                      </div>
                      <div className="loans-activity-meta">
                        <span>Salida: {formatDateTime(loan.loaned_at)}</span>
                        <span>Limite: {formatDateTime(loan.due_at)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="loans-empty compact">Cuando apruebes una reserva con materiales, el movimiento aparecera aqui automaticamente.</p>
                )}
              </div>
            </article>
          </section>

          {selectedReturnLoan ? (
            <article className="loans-card">
              <div className="loans-card-head">
                <div>
                  <p className="loans-card-kicker">Cierre de seguimiento</p>
                  <h3>Registrar devolucion de {selectedReturnLoan.item_name}</h3>
                </div>
              </div>

              <form className="loans-form" onSubmit={(event) => {
                event.preventDefault()
                handleReturnLoan(selectedReturnLoan)
              }}>
                <div className="loans-form-grid">
                  <label>
                    <span>Resultado</span>
                    <select
                      value={returnForm.return_condition}
                      onChange={(event) => setReturnForm((previous) => ({ ...previous, return_condition: event.target.value }))}
                    >
                      <option value="ok">Devuelto correctamente</option>
                      <option value="issues">Devuelto con observaciones</option>
                      <option value="cancelled">Cerrado por cancelacion</option>
                    </select>
                  </label>
                  <label>
                    <span>Comentario de cierre</span>
                    <input
                      value={returnForm.return_notes}
                      onChange={(event) => setReturnForm((previous) => ({ ...previous, return_notes: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Incidencias</span>
                    <input
                      value={returnForm.incident_notes}
                      onChange={(event) => setReturnForm((previous) => ({ ...previous, incident_notes: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="loans-actions">
                  <button type="submit" className="loans-primary">Cerrar seguimiento</button>
                  <button type="button" className="loans-secondary" onClick={() => setSelectedReturnLoan(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </article>
          ) : null}

          <article className="loans-card">
            <div className="loans-card-head">
              <div>
                <p className="loans-card-kicker">Historial operativo</p>
                <h3>Consulta, filtra y sigue materiales por reserva</h3>
              </div>
            </div>

            <div className="loans-filters">
              <label>
                <span>Buscar</span>
                <input
                  placeholder="Equipo, material, responsable o motivo"
                  value={filters.search}
                  onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
                />
              </label>
              <label>
                <span>Estado</span>
                <select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="active">Activos</option>
                  <option value="overdue">Vencidos</option>
                  <option value="returned">Devueltos</option>
                </select>
              </label>
              <label>
                <span>Tipo</span>
                <select value={filters.loan_type} onChange={(event) => setFilters((previous) => ({ ...previous, loan_type: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="asset">Equipos</option>
                  <option value="material">Materiales</option>
                </select>
              </label>
              <label>
                <span>Origen</span>
                <select value={filters.source_type} onChange={(event) => setFilters((previous) => ({ ...previous, source_type: event.target.value }))}>
                  <option value="practice_request">Reservas aprobadas</option>
                  <option value="manual">Manual</option>
                  <option value="">Todos</option>
                </select>
              </label>
            </div>

            <div className="loans-table-wrap">
              <table className="loans-table">
                <thead>
                  <tr>
                    <th>Recurso</th>
                    <th>Solicitante</th>
                    <th>Detalle</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.length ? (
                    loans.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          <strong>{loan.item_name}</strong>
                          <small>
                            {typeLabels[loan.loan_type] || loan.loan_type}
                            {' · '}
                            {sourceLabels[loan.source_type] || loan.source_type}
                            {loan.practice_request_id ? ` · Reserva #${loan.practice_request_id}` : ''}
                          </small>
                        </td>
                        <td>
                          <strong>{loan.borrower_name}</strong>
                          <small>{loan.borrower_email}</small>
                        </td>
                        <td>
                          <div className="loans-table-copy">
                            <span>{labNameById[Number(loan.laboratory_id)] || 'General'}</span>
                            <span>{loan.quantity} unidad(es)</span>
                            <span>Limite {formatDateTime(loan.due_at)}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`loans-badge status-${loan.status}`}>
                            {statusLabels[loan.status] || loan.status}
                          </span>
                          {loan.return_condition ? (
                            <small>{returnConditionLabels[loan.return_condition] || loan.return_condition}</small>
                          ) : null}
                        </td>
                        <td>
                          <div className="loans-actions compact">
                            {canManageLoans && loan.raw_status === 'active' ? (
                              <button
                                type="button"
                                className="loans-primary ghost"
                                onClick={() => {
                                  setSelectedReturnLoan(loan)
                                  setReturnForm({ return_condition: 'ok', return_notes: '', incident_notes: '' })
                                }}
                              >
                                Registrar devolucion
                              </button>
                            ) : null}
                            {loan.return_notes ? <small>{loan.return_notes}</small> : null}
                            {loan.incident_notes ? <small>{loan.incident_notes}</small> : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        <p className="loans-empty compact">No hay prestamos que coincidan con los filtros actuales.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}

export default AdminLoansPage
