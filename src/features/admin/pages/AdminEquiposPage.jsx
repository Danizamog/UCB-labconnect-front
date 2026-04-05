import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  closeAssetMaintenanceTicket,
  createAsset,
  createAssetMaintenanceTicket,
  createLoanRecord,
  deleteAsset,
  listAdminLabs,
  listAssetLoanHistory,
  listAssetMaintenanceTickets,
  listAssets,
  listAssetStatusHistory,
  listLoansDashboard,
  returnLoanRecord,
  updateAsset,
  updateAssetStatus,
} from '../services/infrastructureService'
import { listUserProfiles } from '../services/profileService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import { assetStatusBadgeClass, assetStatusLabel, formatDateTime, formatStatus } from '../../../shared/utils/formatters'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import LoanReturnModal from './LoanReturnModal'
import './AdminAssetsPage.css'

const defaultForm = { name: '', category: '', location: '', description: '', serial_number: '', laboratory_id: '', status: 'available' }
const defaultTicketForm = { asset_id: '', ticket_type: 'maintenance', title: '', description: '', severity: 'medium', evidence_report_id: '' }
const defaultLoanForm = { asset_id: '', borrower_id: '', borrower_name: '', borrower_email: '', borrower_role: '', purpose: '', notes: '' }
const defaultLoanDashboard = { total_records: 0, active_count: 0, returned_count: 0, damaged_returns_count: 0, active_loans: [] }

function normalizeLabId(value) {
  return value === '' ? '' : String(value)
}

function maintenanceTypeLabel(value) {
  return value === 'damage' ? 'Dano' : 'Mantenimiento'
}

function severityLabel(value) {
  const map = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Critica' }
  return map[value] || value
}

function returnConditionLabel(value) {
  return value === 'damaged' ? 'Devuelto con danos' : 'Devuelto sin danos'
}

function resolveProfileDisplayName(profile) {
  return profile?.name || profile?.username || profile?.student_code || 'Usuario'
}

function resolveProfileIdentifier(profile) {
  return profile?.student_code || profile?.id || profile?.username || ''
}

function resolveProfileEmail(profile) {
  return profile?.email || profile?.username || ''
}

function resolveProfileRole(profile) {
  return profile?.role || profile?.profile_type || ''
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function assetMatchesSearch(asset, query) {
  const needle = normalizeText(query)
  if (!needle) return true
  return [asset?.name, asset?.category, asset?.serial_number, asset?.location, asset?.laboratory_name]
    .some((value) => normalizeText(value).includes(needle))
}

function AdminEquiposPage({ user }) {
  const [labs, setLabs] = useState([])
  const [assets, setAssets] = useState([])
  const [activeTickets, setActiveTickets] = useState([])
  const [loanDashboard, setLoanDashboard] = useState(defaultLoanDashboard)
  const [userProfiles, setUserProfiles] = useState([])
  const [assetStatusHistory, setAssetStatusHistory] = useState({})
  const [assetLoanHistory, setAssetLoanHistory] = useState({})
  const [selectedAssetHistoryId, setSelectedAssetHistoryId] = useState(null)
  const [assetHistoryLoadingId, setAssetHistoryLoadingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [ticketForm, setTicketForm] = useState(defaultTicketForm)
  const [loanForm, setLoanForm] = useState(defaultLoanForm)
  const [userSearch, setUserSearch] = useState('')
  const [assetSearch, setAssetSearch] = useState('')
  const [resolutionDrafts, setResolutionDrafts] = useState({})
  const [savingTicket, setSavingTicket] = useState(false)
  const [savingLoan, setSavingLoan] = useState(false)
  const [closingTicketId, setClosingTicketId] = useState('')
  const [returningLoanId, setReturningLoanId] = useState('')
  const [returnModalLoan, setReturnModalLoan] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [userDirectoryMessage, setUserDirectoryMessage] = useState('')
  const [statusDrafts, setStatusDrafts] = useState({})

  const canManage = hasAnyPermission(user, ['gestionar_inventario'])
  const canManageStatus = hasAnyPermission(user, ['gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageLoans = hasAnyPermission(user, ['gestionar_prestamos', 'gestionar_inventario', 'gestionar_estado_equipos'])

  const loadData = async () => {
    setLoading(true)
    try {
      const [labsResult, assetsResult, ticketsResult, loansResult, profilesResult] = await Promise.allSettled([
        listAdminLabs(),
        listAssets(),
        listAssetMaintenanceTickets({ status: 'open' }),
        listLoansDashboard(),
        canManageLoans ? listUserProfiles() : Promise.resolve([]),
      ])

      if (labsResult.status !== 'fulfilled' || assetsResult.status !== 'fulfilled' || ticketsResult.status !== 'fulfilled' || loansResult.status !== 'fulfilled') {
        throw new Error('No se pudieron cargar los equipos')
      }

      const nextAssets = assetsResult.value
      setLabs(labsResult.value)
      setAssets(nextAssets)
      setActiveTickets(ticketsResult.value)
      setLoanDashboard(loansResult.value)
      setLoanForm((previous) => ({
        ...previous,
        asset_id: previous.asset_id || nextAssets.find((asset) => asset.status === 'available')?.id || '',
      }))

      if (profilesResult.status === 'fulfilled') {
        setUserProfiles(Array.isArray(profilesResult.value) ? profilesResult.value : [])
        setUserDirectoryMessage('')
      } else {
        setUserProfiles([])
        setUserDirectoryMessage('No se pudo abrir el directorio institucional. Puedes registrar el prestamo ingresando manualmente los datos del usuario.')
      }

      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los equipos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const labNameById = useMemo(() => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])), [labs])
  const assetNameById = useMemo(() => Object.fromEntries(assets.map((asset) => [String(asset.id), asset.name])), [assets])
  const selectedLoanAsset = useMemo(() => assets.find((asset) => String(asset.id) === String(loanForm.asset_id)) || null, [assets, loanForm.asset_id])
  const filteredUsers = useMemo(() => {
    const needle = normalizeText(userSearch)
    if (!needle) return userProfiles.slice(0, 6)
    return userProfiles
      .filter((profile) => [profile?.name, profile?.username, profile?.student_code, profile?.id, profile?.role]
        .some((value) => normalizeText(value).includes(needle)))
      .slice(0, 6)
  }, [userProfiles, userSearch])
  const filteredAssets = useMemo(() => assets.filter((asset) => assetMatchesSearch(asset, assetSearch)), [assets, assetSearch])

  const resetForm = () => {
    setEditingId(null)
    setForm(defaultForm)
  }

  const resetTicketForm = () => {
    setTicketForm(defaultTicketForm)
    setSavingTicket(false)
  }

  const resetLoanForm = () => {
    setLoanForm({ ...defaultLoanForm, asset_id: assets.find((asset) => asset.status === 'available')?.id || '' })
    setUserSearch('')
    setSavingLoan(false)
  }

  const loadAssetDetailHistory = async (assetId) => {
    setAssetHistoryLoadingId(assetId)
    try {
      const [maintenanceHistory, loanHistory] = await Promise.all([listAssetStatusHistory(assetId), listAssetLoanHistory(assetId)])
      setAssetStatusHistory((previous) => ({ ...previous, [assetId]: maintenanceHistory }))
      setAssetLoanHistory((previous) => ({ ...previous, [assetId]: loanHistory }))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial del equipo')
    } finally {
      setAssetHistoryLoadingId(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canManage) return
    setError('')
    setMessage('')
    if (!form.location.trim()) {
      setError('La ubicacion del equipo es obligatoria.')
      return
    }
    const payload = { ...form, location: form.location.trim(), laboratory_id: normalizeLabId(form.laboratory_id) }
    try {
      if (editingId) {
        await updateAsset(editingId, payload)
        setMessage('Equipo actualizado correctamente.')
      } else {
        await createAsset(payload)
        setMessage('Equipo creado correctamente.')
      }
      resetForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el equipo')
    }
  }

  const handleCreateTicket = async (event) => {
    event.preventDefault()
    if (!canManageStatus) return
    setError('')
    setMessage('')
    if (!ticketForm.asset_id) {
      setError('Debes seleccionar el equipo afectado.')
      return
    }
    if (!ticketForm.title.trim() || !ticketForm.description.trim()) {
      setError('Debes completar el titulo y la descripcion del ticket.')
      return
    }
    setSavingTicket(true)
    try {
      await createAssetMaintenanceTicket(ticketForm.asset_id, {
        ticket_type: ticketForm.ticket_type,
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim(),
        severity: ticketForm.severity,
        evidence_report_id: ticketForm.evidence_report_id.trim(),
      })
      setMessage(ticketForm.ticket_type === 'damage' ? 'Dano registrado. El equipo paso automaticamente a mantenimiento.' : 'Mantenimiento registrado correctamente.')
      resetTicketForm()
      await loadData()
      if (selectedAssetHistoryId === ticketForm.asset_id) await loadAssetDetailHistory(ticketForm.asset_id)
    } catch (err) {
      setError(err.message || 'No se pudo registrar el ticket de mantenimiento.')
      setSavingTicket(false)
    }
  }

  const handleCreateLoan = async (event) => {
    event.preventDefault()
    if (!canManageLoans) return
    setError('')
    setMessage('')
    if (!loanForm.asset_id) {
      setError('Debes seleccionar un equipo para registrar el prestamo.')
      return
    }
    if (!loanForm.borrower_id.trim() || !loanForm.borrower_name.trim()) {
      setError('Debes identificar al usuario con codigo y nombre antes de registrar la salida.')
      return
    }
    if (selectedLoanAsset?.status === 'maintenance') {
      setError('No puedes prestar un equipo que esta en mantenimiento.')
      return
    }
    if (selectedLoanAsset && selectedLoanAsset.status !== 'available') {
      setError('Solo puedes registrar prestamos sobre equipos disponibles.')
      return
    }
    setSavingLoan(true)
    try {
      const createdLoan = await createLoanRecord({
        asset_id: loanForm.asset_id,
        borrower_id: loanForm.borrower_id.trim(),
        borrower_name: loanForm.borrower_name.trim(),
        borrower_email: loanForm.borrower_email.trim(),
        borrower_role: loanForm.borrower_role.trim(),
        purpose: loanForm.purpose.trim(),
        notes: loanForm.notes.trim(),
      })
      setMessage(`Prestamo registrado correctamente. ${createdLoan.asset_name} paso a estado Prestado.`)
      resetLoanForm()
      await loadData()
      if (selectedAssetHistoryId === createdLoan.asset_id) await loadAssetDetailHistory(createdLoan.asset_id)
    } catch (err) {
      setError(err.message || 'No se pudo registrar el prestamo.')
      setSavingLoan(false)
    }
  }

  const handleDelete = (assetId) => {
    setConfirmModal({
      message: 'Esta accion no se puede deshacer.',
      onConfirm: async () => {
        setConfirmModal(null)
        setError('')
        setMessage('')
        try {
          await deleteAsset(assetId)
          setMessage('Equipo eliminado correctamente.')
          await loadData()
        } catch (err) {
          setError(err.message || 'No se pudo eliminar el equipo')
        }
      },
    })
  }

  const getStatusDraft = (asset) => {
    const existingDraft = statusDrafts[asset.id]
    if (existingDraft) {
      return existingDraft
    }
    return { status: asset.status, notes: '' }
  }

  const handleStatusDraftChange = (assetId, field, value) => {
    setStatusDrafts((prev) => ({
      ...prev,
      [assetId]: {
        status: prev[assetId]?.status ?? assets.find((asset) => asset.id === assetId)?.status ?? 'available',
        notes: prev[assetId]?.notes ?? '',
        [field]: value,
      },
    }))
  }

  const handleStatusChange = async (asset) => {
    if (!canManageStatus) return

    const draft = getStatusDraft(asset)
    const nextStatus = draft.status
    const notes = (draft.notes || '').trim()

    if ((nextStatus === 'maintenance' || nextStatus === 'damaged') && notes.length < 8) {
      setError('Para registrar mantenimiento o daño, agrega una observacion de al menos 8 caracteres.')
      return
    }

    setError('')
    setMessage('')
    try {
      const updated = await updateAssetStatus(asset.id, nextStatus, notes)
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)))
      setStatusDrafts((prev) => ({
        ...prev,
        [asset.id]: { status: updated.status, notes: '' },
      }))
      
      if (selectedAssetHistoryId === asset.id) await loadAssetDetailHistory(asset.id)
      
      setMessage('Estado del equipo actualizado y registrado en historial.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado del equipo')
    }
  }

  const handleToggleHistory = async (assetId) => {
    if (selectedAssetHistoryId === assetId) {
      setSelectedAssetHistoryId(null)
      return
    }
    setSelectedAssetHistoryId(assetId)
    if (assetStatusHistory[assetId] && assetLoanHistory[assetId]) return
    await loadAssetDetailHistory(assetId)
  }

  const handleCloseTicket = async (ticketId) => {
    if (!canManageStatus) return
    const resolutionNotes = String(resolutionDrafts[ticketId] || '').trim()
    if (!resolutionNotes) {
      setError('Debes registrar la resolucion antes de cerrar el ticket.')
      return
    }

    setClosingTicketId(ticketId)
    setError('')
    setMessage('')
    try {
      const ticket = activeTickets.find((entry) => entry.id === ticketId)
      await closeAssetMaintenanceTicket(ticketId, { resolution_notes: resolutionNotes })
      setResolutionDrafts((previous) => ({ ...previous, [ticketId]: '' }))
      setMessage('Ticket cerrado. El equipo retorno inmediatamente al estado Disponible.')
      await loadData()
      if (ticket?.asset_id) await loadAssetDetailHistory(ticket.asset_id)
    } catch (err) {
      setError(err.message || 'No se pudo cerrar el ticket de mantenimiento.')
    } finally {
      setClosingTicketId('')
    }
  }

  const handleSelectBorrower = (profile) => {
    setLoanForm((previous) => ({
      ...previous,
      borrower_id: resolveProfileIdentifier(profile),
      borrower_name: resolveProfileDisplayName(profile),
      borrower_email: resolveProfileEmail(profile),
      borrower_role: resolveProfileRole(profile),
    }))
    setUserSearch(resolveProfileDisplayName(profile))
  }

  const handleOpenReturnModal = (loan) => {
    setReturnModalLoan(loan)
  }

  const handleSubmitReturn = async (event) => {
    event.preventDefault()
    if (!returnModalLoan || !canManageLoans) return

    const formData = new FormData(event.currentTarget)
    const payload = {
      return_condition: String(formData.get('return_condition') || 'ok'),
      return_notes: String(formData.get('return_notes') || '').trim(),
      incident_notes: String(formData.get('incident_notes') || '').trim(),
    }

    if (payload.return_condition === 'damaged' && !payload.incident_notes) {
      setError('Debes describir el problema antes de registrar una devolucion con danos.')
      return
    }

    setReturningLoanId(returnModalLoan.id)
    setError('')
    setMessage('')
    try {
      const returnedLoan = await returnLoanRecord(returnModalLoan.id, payload)
      setReturnModalLoan(null)
      setMessage(
        payload.return_condition === 'damaged'
          ? 'Devolucion registrada con danos. El equipo paso a mantenimiento y se abrio un ticket tecnico.'
          : 'Devolucion registrada correctamente. El equipo quedo disponible nuevamente.',
      )
      await loadData()
      await loadAssetDetailHistory(returnedLoan.asset_id)
    } catch (err) {
      setError(err.message || 'No se pudo registrar la devolucion del equipo.')
    } finally {
      setReturningLoanId('')
    }
  }

  return (
    <section className="infra-page" aria-label="Equipos">
      {confirmModal ? (
        <ConfirmModal
          title="Eliminar equipo"
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}

      {returnModalLoan ? (
        <LoanReturnModal
          loan={returnModalLoan}
          onCancel={() => {
            if (!returningLoanId) setReturnModalLoan(null)
          }}
          onSubmit={handleSubmitReturn}
          submitting={returningLoanId === returnModalLoan.id}
        />
      ) : null}

      <header className="infra-header">
        <div>
          <p className="infra-kicker">Inventario</p>
          <h2>Equipos</h2>
          <p>Gestiona el inventario, registra prestamos, procesa devoluciones y sigue el historial tecnico de cada equipo.</p>
        </div>
        <div className="infra-summary">
          <div><span>Total</span><strong>{assets.length}</strong></div>
          <div><span>Disponibles</span><strong>{assets.filter((asset) => asset.status === 'available').length}</strong></div>
          <div><span>Prestamos activos</span><strong>{loanDashboard.active_count}</strong></div>
          <div><span>Tickets activos</span><strong>{activeTickets.length}</strong></div>
        </div>
      </header>

      {message ? <p className="infra-alert infra-success">{message}</p> : null}
      {error ? <p className="infra-alert infra-error">{error}</p> : null}

      {loading ? (
        <p className="infra-empty">Cargando equipos...</p>
      ) : (
        <div className="infra-grid">
          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Catalogo de equipos</h3>
                <p>Registra cada equipo con su ubicacion, laboratorio y estado actual.</p>
              </div>
            </div>

            {canManage ? (
              <form className="infra-form" onSubmit={handleSubmit}>
                <div className="infra-form-section">
                  <span className="infra-form-section-label">1 - Datos del equipo</span>
                  <div className="infra-form-grid">
                    <label>
                      <span>Nombre del equipo</span>
                      <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} required />
                    </label>
                    <label>
                      <span>Categoria</span>
                      <input value={form.category} onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))} required />
                    </label>
                    <label>
                      <span>Numero de serie</span>
                      <input value={form.serial_number} onChange={(event) => setForm((previous) => ({ ...previous, serial_number: event.target.value }))} />
                    </label>
                    <label>
                      <span>Ubicacion</span>
                      <input value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} placeholder="Mesa 4, gabinete 2 o estante A" required />
                    </label>
                  </div>
                  <label>
                    <span>Descripcion</span>
                    <textarea rows="3" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} />
                  </label>
                </div>

                <div className="infra-form-section">
                  <span className="infra-form-section-label">2 - Asignacion y estado</span>
                  <div className="infra-form-grid">
                    <label>
                      <span>Laboratorio</span>
                      <select value={form.laboratory_id} onChange={(event) => setForm((previous) => ({ ...previous, laboratory_id: event.target.value }))}>
                        <option value="">Sin laboratorio fijo</option>
                        {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Estado</span>
                      <select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}>
                        <option value="available">Disponible</option>
                        <option value="loaned">Prestado</option>
                        <option value="maintenance">Mantenimiento</option>
                        <option value="damaged">Danado</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="infra-actions">
                  <button type="submit" className="infra-primary">{editingId ? 'Actualizar equipo' : 'Crear equipo'}</button>
                  {editingId ? <button type="button" className="infra-secondary" onClick={resetForm}>Cancelar edicion</button> : null}
                </div>
              </form>
            ) : null}
          </section>

          <section className="infra-card">
            <div className="infra-section-head">
              <div>
                <h3>Registrar mantenimiento o dano</h3>
                <p>Crear un ticket cambia automaticamente el equipo a mantenimiento y guarda el historial tecnico.</p>
              </div>
            </div>

            <form className="infra-form" onSubmit={handleCreateTicket}>
              <div className="infra-form-section">
                <span className="infra-form-section-label">1 - Ticket tecnico</span>
                <div className="infra-form-grid">
                  <label>
                    <span>Equipo afectado</span>
                    <select value={ticketForm.asset_id} onChange={(event) => setTicketForm((previous) => ({ ...previous, asset_id: event.target.value }))} required>
                      <option value="">Selecciona un equipo</option>
                      {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Tipo de ticket</span>
                    <select value={ticketForm.ticket_type} onChange={(event) => setTicketForm((previous) => ({ ...previous, ticket_type: event.target.value }))}>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="damage">Dano</option>
                    </select>
                  </label>
                  <label>
                    <span>Severidad</span>
                    <select value={ticketForm.severity} onChange={(event) => setTicketForm((previous) => ({ ...previous, severity: event.target.value }))}>
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="critical">Critica</option>
                    </select>
                  </label>
                  <label>
                    <span>ID de reporte</span>
                    <input value={ticketForm.evidence_report_id} onChange={(event) => setTicketForm((previous) => ({ ...previous, evidence_report_id: event.target.value }))} placeholder="Ej. MTTO-204 o DANO-031" />
                  </label>
                </div>
                <label>
                  <span>Titulo</span>
                  <input value={ticketForm.title} onChange={(event) => setTicketForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Ej. Pantalla rota, calibracion preventiva, cambio de fuente" required />
                </label>
                <label>
                  <span>Descripcion tecnica</span>
                  <textarea rows="4" value={ticketForm.description} onChange={(event) => setTicketForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Describe el dano o mantenimiento requerido." required />
                </label>
              </div>

              <div className="infra-actions">
                <button type="submit" className="infra-primary" disabled={!canManageStatus || savingTicket}>{savingTicket ? 'Guardando ticket...' : 'Registrar ticket'}</button>
                <button type="button" className="infra-secondary" onClick={resetTicketForm}>Limpiar</button>
              </div>
            </form>

            <div className="infra-section-head">
              <div>
                <h3>Tickets activos</h3>
                <p>Cierra cada ticket con su resolucion para devolver el equipo a disponible.</p>
              </div>
            </div>

            {activeTickets.length === 0 ? (
              <p className="infra-empty">No hay tickets activos en este momento.</p>
            ) : (
              <div className="infra-list">
                {activeTickets.map((ticket) => (
                  <article key={ticket.id} className="infra-ticket-card">
                    <div className="infra-ticket-head">
                      <div>
                        <strong>{ticket.title}</strong>
                        <p>{ticket.asset_name || assetNameById[String(ticket.asset_id)] || 'Equipo'}</p>
                      </div>
                      <div className="infra-chip-list">
                        <span className="infra-chip">{maintenanceTypeLabel(ticket.ticket_type)}</span>
                        <span className="infra-chip">{severityLabel(ticket.severity)}</span>
                      </div>
                    </div>
                    <p className="infra-ticket-copy">{ticket.description}</p>
                    <div className="infra-ticket-meta">
                      <span><strong>Reporte:</strong> {ticket.evidence_report_id || 'Sin ID'}</span>
                      <span><strong>Abierto:</strong> {formatDateTime(ticket.reported_at)}</span>
                      <span><strong>Por:</strong> {ticket.reported_by}</span>
                      {ticket.is_responsibility_flagged ? <span className="infra-negative">Responsable asociado: {ticket.responsible_borrower_name || ticket.responsible_borrower_email || 'Prestamo previo'}</span> : null}
                    </div>
                    <label>
                      <span>Resolucion para cierre</span>
                      <textarea rows="3" value={resolutionDrafts[ticket.id] || ''} onChange={(event) => setResolutionDrafts((previous) => ({ ...previous, [ticket.id]: event.target.value }))} placeholder="Describe la reparacion realizada y el resultado." />
                    </label>
                    <div className="infra-actions">
                      <button type="button" className="infra-primary" disabled={closingTicketId === ticket.id || !canManageStatus} onClick={() => handleCloseTicket(ticket.id)}>
                        {closingTicketId === ticket.id ? 'Cerrando...' : 'Cerrar ticket'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="infra-card infra-card-full">
            <div className="infra-section-head">
              <div>
                <h3>Prestamos de equipos</h3>
                <p>Registra salidas, procesa devoluciones y consulta el historial de usuarios por cada activo.</p>
              </div>
            </div>

            <div className="infra-loan-ops">
              <section className="infra-loan-panel">
                <form className="infra-form" onSubmit={handleCreateLoan}>
                  <div className="infra-form-section">
                    <span className="infra-form-section-label">1 - Usuario solicitante</span>
                    <label>
                      <span>Buscar usuario por codigo, nombre o correo</span>
                      <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Ej. 20230001, juan.perez@ucb.edu.bo o Juan Perez" />
                    </label>
                    {userDirectoryMessage ? <p className="infra-inline-error">{userDirectoryMessage}</p> : null}

                    {filteredUsers.length > 0 ? (
                      <div className="infra-user-search">
                        {filteredUsers.map((profile) => (
                          <button key={profile.id} type="button" className="infra-user-result" onClick={() => handleSelectBorrower(profile)}>
                            <strong>{resolveProfileDisplayName(profile)}</strong>
                            <span>{resolveProfileEmail(profile) || resolveProfileIdentifier(profile)}</span>
                            <small>{resolveProfileIdentifier(profile)}{resolveProfileRole(profile) ? ` · ${resolveProfileRole(profile)}` : ''}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="infra-form-grid">
                      <label>
                        <span>Codigo o ID del usuario</span>
                        <input value={loanForm.borrower_id} onChange={(event) => setLoanForm((previous) => ({ ...previous, borrower_id: event.target.value }))} placeholder="Ej. 20230001" required />
                      </label>
                      <label>
                        <span>Nombre del usuario</span>
                        <input value={loanForm.borrower_name} onChange={(event) => setLoanForm((previous) => ({ ...previous, borrower_name: event.target.value }))} required />
                      </label>
                      <label>
                        <span>Correo</span>
                        <input value={loanForm.borrower_email} onChange={(event) => setLoanForm((previous) => ({ ...previous, borrower_email: event.target.value }))} placeholder="correo institucional" />
                      </label>
                      <label>
                        <span>Rol o perfil</span>
                        <input value={loanForm.borrower_role} onChange={(event) => setLoanForm((previous) => ({ ...previous, borrower_role: event.target.value }))} placeholder="Estudiante, docente, auxiliar" />
                      </label>
                    </div>
                  </div>

                  <div className="infra-form-section">
                    <span className="infra-form-section-label">2 - Equipo y salida</span>
                    <div className="infra-form-grid">
                      <label>
                        <span>Equipo</span>
                        <select value={loanForm.asset_id} onChange={(event) => setLoanForm((previous) => ({ ...previous, asset_id: event.target.value }))} required>
                          <option value="">Selecciona un equipo</option>
                          {assets.filter(a => a.status === 'available' || a.id === loanForm.asset_id).map((asset) => (
                            <option key={asset.id} value={asset.id}>{asset.name} ({asset.serial_number || 'Sin serie'})</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Proposito del prestamo</span>
                        <input value={loanForm.purpose} onChange={(event) => setLoanForm((previous) => ({ ...previous, purpose: event.target.value }))} placeholder="Clase, laboratorio, proyecto..." />
                      </label>
                    </div>
                    <label>
                      <span>Notas adicionales</span>
                      <textarea rows="2" value={loanForm.notes} onChange={(event) => setLoanForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Cables extra, condiciones especificas..." />
                    </label>
                  </div>

                  <div className="infra-actions">
                    <button type="submit" className="infra-primary" disabled={!canManageLoans || savingLoan}>{savingLoan ? 'Registrando...' : 'Registrar salida'}</button>
                    <button type="button" className="infra-secondary" onClick={resetLoanForm}>Limpiar</button>
                  </div>
                </form>
              </section>

              <section className="infra-loan-active">
                <div className="infra-section-head">
                  <h4>Prestamos activos ({loanDashboard.active_count})</h4>
                </div>
                {loanDashboard.active_loans.length === 0 ? (
                  <p className="infra-empty">No hay prestamos activos.</p>
                ) : (
                  <div className="infra-list">
                    {loanDashboard.active_loans.map((loan) => (
                      <article key={loan.id} className="infra-loan-card">
                        <div className="infra-loan-info">
                          <strong>{loan.asset_name}</strong>
                          <span>{loan.borrower_name} ({loan.borrower_id})</span>
                          <small>Prestado el: {formatDateTime(loan.loaned_at)}</small>
                        </div>
                        <div className="infra-actions">
                          <button type="button" className="infra-primary" onClick={() => handleOpenReturnModal(loan)}>Registrar devolucion</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>

          <section className="infra-card infra-card-full">
            <div className="infra-section-head">
              <div>
                <h3>Inventario detallado</h3>
                <p>Filtra y administra todos los equipos registrados en el sistema.</p>
              </div>
              <input
                type="search"
                placeholder="Buscar equipo..."
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                className="infra-search-input"
              />
            </div>

            <div className="infra-table-wrapper">
              <table className="infra-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Laboratorio</th>
                    <th>Ubicacion</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="infra-empty">No se encontraron equipos.</td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => (
                      <Fragment key={asset.id}>
                        <tr>
                          <td>
                            <strong>{asset.name}</strong>
                            <br />
                            <small className="infra-text-muted">{asset.category} {asset.serial_number ? `· SN: ${asset.serial_number}` : ''}</small>
                          </td>
                          <td>{asset.laboratory_name || labNameById[asset.laboratory_id] || 'N/A'}</td>
                          <td>{asset.location}</td>
                          <td>
                            {canManageStatus ? (
                              <div className="infra-status-editor">
                                <select
                                  className={`infra-badge ${assetStatusBadgeClass(getStatusDraft(asset).status)}`}
                                  value={getStatusDraft(asset).status}
                                  onChange={(event) => handleStatusDraftChange(asset.id, 'status', event.target.value)}
                                >
                                  <option value="available">Disponible</option>
                                  <option value="loaned" disabled>Prestado</option>
                                  <option value="maintenance">Mantenimiento</option>
                                  <option value="damaged">Danado</option>
                                </select>
                                {getStatusDraft(asset).status !== asset.status ? (
                                  <div className="infra-status-draft">
                                    {(getStatusDraft(asset).status === 'maintenance' || getStatusDraft(asset).status === 'damaged') && (
                                      <input
                                        type="text"
                                        placeholder="Motivo (min 8 car.)"
                                        value={getStatusDraft(asset).notes}
                                        onChange={(e) => handleStatusDraftChange(asset.id, 'notes', e.target.value)}
                                      />
                                    )}
                                    <button type="button" className="infra-btn-icon" onClick={() => handleStatusChange(asset)}>Guardar</button>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className={`infra-badge ${assetStatusBadgeClass(asset.status)}`}>{assetStatusLabel(asset.status)}</span>
                            )}
                          </td>
                          <td>
                            <div className="infra-actions-row">
                              <button type="button" className="infra-btn-text" onClick={() => handleToggleHistory(asset.id)}>
                                {selectedAssetHistoryId === asset.id ? 'Ocultar historial' : 'Ver historial'}
                              </button>
                              {canManage ? (
                                <>
                                  <button
                                    type="button"
                                    className="infra-btn-text"
                                    onClick={() => {
                                      setEditingId(asset.id)
                                      setForm({
                                        name: asset.name,
                                        category: asset.category,
                                        location: asset.location,
                                        description: asset.description || '',
                                        serial_number: asset.serial_number || '',
                                        laboratory_id: asset.laboratory_id || '',
                                        status: asset.status,
                                      })
                                      window.scrollTo({ top: 0, behavior: 'smooth' })
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button type="button" className="infra-btn-text infra-negative" onClick={() => handleDelete(asset.id)}>Eliminar</button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {selectedAssetHistoryId === asset.id ? (
                          <tr className="infra-history-row">
                            <td colSpan="5">
                              <div className="infra-history-panel">
                                {assetHistoryLoadingId === asset.id ? (
                                  <p>Cargando historial...</p>
                                ) : (
                                  <div className="infra-history-grid">
                                    <div>
                                      <h5>Historial de estados y mantenimiento</h5>
                                      {!assetStatusHistory[asset.id]?.length ? (
                                        <p className="infra-empty-small">No hay registros de estado.</p>
                                      ) : (
                                        <ul className="infra-timeline">
                                          {assetStatusHistory[asset.id].map((record) => (
                                            <li key={record.id}>
                                              <span className={`infra-badge ${assetStatusBadgeClass(record.status)}`}>{assetStatusLabel(record.status)}</span>
                                              <small>{formatDateTime(record.changed_at)} por {record.changed_by_name || 'Sistema'}</small>
                                              {record.notes ? <p>Nota: {record.notes}</p> : null}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                    <div>
                                      <h5>Historial de prestamos</h5>
                                      {!assetLoanHistory[asset.id]?.length ? (
                                        <p className="infra-empty-small">No hay registros de prestamo.</p>
                                      ) : (
                                        <ul className="infra-timeline">
                                          {assetLoanHistory[asset.id].map((record) => (
                                            <li key={record.id}>
                                              <strong>{record.borrower_name}</strong> ({record.status})
                                              <small>{formatDateTime(record.loaned_at)} {record.returned_at ? `- Devuelto: ${formatDateTime(record.returned_at)}` : ''}</small>
                                              {record.incident_notes ? <p className="infra-negative">Incidente: {record.incident_notes}</p> : null}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminEquiposPage