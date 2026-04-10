import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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
const defaultAssetFilters = { status: 'all', laboratory_id: '', category: 'all' }
const ASSET_PAGE_SIZE = 6

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

function resolveProfileInternalId(profile) {
  return profile?.id || ''
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
  const [selectedBorrowerProfileId, setSelectedBorrowerProfileId] = useState('')
  const [assetSearch, setAssetSearch] = useState('')
  const [assetFilters, setAssetFilters] = useState(defaultAssetFilters)
  const [assetPage, setAssetPage] = useState(0)
  const [resolutionDrafts, setResolutionDrafts] = useState({})
  const [savingTicket, setSavingTicket] = useState(false)
  const [savingLoan, setSavingLoan] = useState(false)
  const [closingTicketId, setClosingTicketId] = useState('')
  const [returningLoanId, setReturningLoanId] = useState('')
  const [returnModalLoan, setReturnModalLoan] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [activeModal, setActiveModal] = useState(null)
  const [selectedManagedAssetId, setSelectedManagedAssetId] = useState(null)
  const [userDirectoryMessage, setUserDirectoryMessage] = useState('')

  const canManage = hasAnyPermission(user, ['gestionar_inventario'])
  const canManageStatus = hasAnyPermission(user, ['gestionar_estado_equipos', 'gestionar_mantenimiento'])
  const canManageLoans = hasAnyPermission(user, ['gestionar_prestamos', 'gestionar_inventario', 'gestionar_estado_equipos'])

  const loadData = useCallback(async () => {
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
        setUserDirectoryMessage('No se pudo abrir el directorio institucional. Para proteger la trazabilidad, los prestamos quedan bloqueados hasta recuperar el directorio.')
      }

      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los equipos')
    } finally {
      setLoading(false)
    }
  }, [canManageLoans])

  useEffect(() => {
    loadData()
  }, [loadData])

  const labNameById = useMemo(() => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])), [labs])
  const assetNameById = useMemo(() => Object.fromEntries(assets.map((asset) => [String(asset.id), asset.name])), [assets])
  const selectedLoanAsset = useMemo(() => assets.find((asset) => String(asset.id) === String(loanForm.asset_id)) || null, [assets, loanForm.asset_id])
  const activeUserProfiles = useMemo(
    () => userProfiles.filter((profile) => profile?.is_active !== false),
    [userProfiles],
  )
  const selectedBorrowerProfile = useMemo(
    () => userProfiles.find((profile) => String(profile?.id) === String(selectedBorrowerProfileId)) || null,
    [userProfiles, selectedBorrowerProfileId],
  )
  const selectedHistoryAsset = useMemo(
    () => assets.find((asset) => String(asset.id) === String(selectedAssetHistoryId)) || null,
    [assets, selectedAssetHistoryId],
  )
  const selectedManagedAsset = useMemo(
    () => assets.find((asset) => String(asset.id) === String(selectedManagedAssetId)) || null,
    [assets, selectedManagedAssetId],
  )
  const filteredUsers = useMemo(() => {
    const needle = normalizeText(userSearch)
    if (!needle) return activeUserProfiles.slice(0, 6)
    return activeUserProfiles
      .filter((profile) => [profile?.name, profile?.username, profile?.student_code, profile?.id, profile?.role]
        .some((value) => normalizeText(value).includes(needle)))
      .slice(0, 6)
  }, [activeUserProfiles, userSearch])
  const assetCategories = useMemo(
    () => Array.from(new Set(assets.map((asset) => String(asset.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [assets],
  )
  const filteredAssets = useMemo(
    () => assets.filter((asset) => {
      const matchesSearch = assetMatchesSearch(asset, assetSearch)
      const matchesStatus = assetFilters.status === 'all' || asset.status === assetFilters.status
      const matchesLab = !assetFilters.laboratory_id || String(asset.laboratory_id || '') === String(assetFilters.laboratory_id)
      const matchesCategory = assetFilters.category === 'all' || String(asset.category || '') === assetFilters.category
      return matchesSearch && matchesStatus && matchesLab && matchesCategory
    }),
    [assetFilters.category, assetFilters.laboratory_id, assetFilters.status, assetSearch, assets],
  )
  const paginatedAssets = useMemo(() => {
    const start = assetPage * ASSET_PAGE_SIZE
    return filteredAssets.slice(start, start + ASSET_PAGE_SIZE)
  }, [assetPage, filteredAssets])
  const assetTotalPages = Math.max(Math.ceil(filteredAssets.length / ASSET_PAGE_SIZE), 1)
  const assetVisibleStart = filteredAssets.length === 0 ? 0 : assetPage * ASSET_PAGE_SIZE + 1
  const assetVisibleEnd = Math.min((assetPage + 1) * ASSET_PAGE_SIZE, filteredAssets.length)
  const canSubmitAssetForm = useMemo(() => {
    const nameOk = String(form.name || '').trim().length >= 3
    const categoryOk = String(form.category || '').trim().length >= 3
    const locationOk = String(form.location || '').trim().length >= 3
    return canManage && nameOk && categoryOk && locationOk
  }, [canManage, form.category, form.location, form.name])
  const canSubmitTicketForm = useMemo(() => {
    const hasAsset = String(ticketForm.asset_id || '').trim().length > 0
    const titleOk = String(ticketForm.title || '').trim().length >= 5
    const descriptionOk = String(ticketForm.description || '').trim().length >= 10
    return canManageStatus && hasAsset && titleOk && descriptionOk && !savingTicket
  }, [canManageStatus, savingTicket, ticketForm.asset_id, ticketForm.description, ticketForm.title])

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
    setSelectedBorrowerProfileId('')
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
      setActiveModal(null)
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
    const normalizedTitle = ticketForm.title.trim()
    const normalizedDescription = ticketForm.description.trim()
    const normalizedEvidenceId = ticketForm.evidence_report_id.trim()

    if (!normalizedTitle || !normalizedDescription) {
      setError('Debes completar el titulo y la descripcion del ticket.')
      return
    }
    if (normalizedTitle.length < 5) {
      setError('El titulo debe tener al menos 5 caracteres.')
      return
    }
    if (normalizedDescription.length < 10) {
      setError('La descripcion debe tener al menos 10 caracteres.')
      return
    }
    setSavingTicket(true)
    try {
      await createAssetMaintenanceTicket(ticketForm.asset_id, {
        ticket_type: ticketForm.ticket_type,
        title: normalizedTitle,
        description: normalizedDescription,
        severity: ticketForm.severity,
        evidence_report_id: normalizedEvidenceId,
      })
      setMessage(ticketForm.ticket_type === 'damage' ? 'Dano registrado. El equipo paso automaticamente a mantenimiento y el ID de reporte se genero automaticamente.' : 'Mantenimiento registrado con ID de reporte automatico.')
      resetTicketForm()
      setActiveModal(null)
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
    if (userDirectoryMessage) {
      setError('El directorio institucional no esta disponible. No se puede registrar el prestamo hasta recuperarlo.')
      return
    }
    if (!selectedBorrowerProfile || selectedBorrowerProfile.is_active === false) {
      setError('Debes seleccionar un usuario valido y activo del directorio institucional antes de registrar la salida.')
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
        borrower_id: resolveProfileInternalId(selectedBorrowerProfile),
        borrower_name: loanForm.borrower_name.trim(),
        borrower_email: loanForm.borrower_email.trim(),
        borrower_role: loanForm.borrower_role.trim(),
        purpose: loanForm.purpose.trim(),
        notes: loanForm.notes.trim(),
      })
      setMessage(`Prestamo registrado correctamente. ${createdLoan.asset_name} paso a estado Prestado.`)
      resetLoanForm()
      setActiveModal(null)
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

  const handleToggleHistory = async (assetId) => {
    if (selectedAssetHistoryId === assetId && activeModal === 'history') {
      setActiveModal(null)
      setSelectedAssetHistoryId(null)
      return
    }
    setSelectedAssetHistoryId(assetId)
    setActiveModal('history')
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
    if (resolutionNotes.length < 5) {
      setError('La resolucion debe tener al menos 5 caracteres.')
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

  const clearBorrowerSelection = (nextSearch = '') => {
    setSelectedBorrowerProfileId('')
    setLoanForm((previous) => ({
      ...previous,
      borrower_id: '',
      borrower_name: '',
      borrower_email: '',
      borrower_role: '',
    }))
    setUserSearch(nextSearch)
  }

  const handleUserSearchChange = (value) => {
    if (
      selectedBorrowerProfile &&
      normalizeText(value) !== normalizeText(resolveProfileDisplayName(selectedBorrowerProfile))
    ) {
      clearBorrowerSelection(value)
      return
    }
    setUserSearch(value)
  }

  const handleSelectBorrower = (profile) => {
    setSelectedBorrowerProfileId(resolveProfileInternalId(profile))
    setLoanForm((previous) => ({
      ...previous,
      borrower_id: resolveProfileInternalId(profile),
      borrower_name: resolveProfileDisplayName(profile),
      borrower_email: resolveProfileEmail(profile),
      borrower_role: resolveProfileRole(profile),
    }))
    setUserSearch(resolveProfileDisplayName(profile))
  }

  const renderBorrowerDirectoryFields = () => (
    <>
      <label>
        <span>Buscar usuario por codigo, nombre o correo</span>
        <input
          value={userSearch}
          onChange={(event) => handleUserSearchChange(event.target.value)}
          placeholder="Ej. 20230001, juan.perez@ucb.edu.bo o Juan Perez"
        />
      </label>
      {userDirectoryMessage ? <p className="infra-inline-error">{userDirectoryMessage}</p> : null}

      {selectedBorrowerProfile ? (
        <article className="infra-user-selected">
          <div>
            <strong>{resolveProfileDisplayName(selectedBorrowerProfile)}</strong>
            <p>{resolveProfileEmail(selectedBorrowerProfile) || 'Sin correo institucional visible'}</p>
          </div>
          <div className="infra-user-selected-meta">
            <span>{selectedBorrowerProfile.student_code ? `Codigo ${selectedBorrowerProfile.student_code}` : 'Sin codigo academico'}</span>
            <span>{resolveProfileRole(selectedBorrowerProfile) || 'Perfil sin rol visible'}</span>
            <span>ID interno {resolveProfileInternalId(selectedBorrowerProfile)}</span>
          </div>
          <div className="infra-actions">
            <button type="button" className="infra-secondary" onClick={() => clearBorrowerSelection()}>
              Cambiar usuario
            </button>
          </div>
        </article>
      ) : (
        <p className="infra-muted">Selecciona un usuario real del directorio institucional para registrar una salida valida y trazable.</p>
      )}

      {filteredUsers.length > 0 ? (
        <div className="infra-user-search">
          {filteredUsers.map((profile) => (
            <button key={profile.id} type="button" className="infra-user-result" onClick={() => handleSelectBorrower(profile)}>
              <strong>{resolveProfileDisplayName(profile)}</strong>
              <span>{resolveProfileEmail(profile) || resolveProfileIdentifier(profile)}</span>
              <small>{resolveProfileIdentifier(profile)}{resolveProfileRole(profile) ? ` - ${resolveProfileRole(profile)}` : ''}</small>
            </button>
          ))}
        </div>
      ) : userSearch ? (
        <p className="infra-inline-error">No encontramos un usuario activo con ese dato. Selecciona un perfil valido del directorio institucional.</p>
      ) : null}

      <div className="infra-form-grid">
        <label>
          <span>ID verificado del usuario</span>
          <input value={loanForm.borrower_id} readOnly placeholder="Se completa al seleccionar un usuario" required />
        </label>
        <label>
          <span>Nombre del usuario</span>
          <input value={loanForm.borrower_name} readOnly placeholder="Selecciona un usuario del directorio" required />
        </label>
        <label>
          <span>Correo institucional</span>
          <input value={loanForm.borrower_email} readOnly placeholder="Selecciona un usuario del directorio" />
        </label>
        <label>
          <span>Rol o perfil</span>
          <input value={loanForm.borrower_role} readOnly placeholder="Selecciona un usuario del directorio" />
        </label>
      </div>
    </>
  )

  const handleOpenReturnModal = (loan) => {
    setReturnModalLoan(loan)
  }

  const handleOpenManageAsset = (asset) => {
    setSelectedManagedAssetId(asset.id)
    setActiveModal('manage')
  }

  const handleOpenAssetEditor = (asset) => {
    setEditingId(asset.id)
    setForm({
      name: asset.name,
      category: asset.category,
      location: asset.location || '',
      description: asset.description || '',
      serial_number: asset.serial_number || '',
      laboratory_id: asset.laboratory_id ? String(asset.laboratory_id) : '',
      status: asset.status,
    })
    setSelectedManagedAssetId(asset.id)
    setActiveModal('asset')
  }

  const handleOpenTicketForAsset = (assetId) => {
    setTicketForm((previous) => ({ ...previous, asset_id: assetId }))
    setSelectedManagedAssetId(assetId)
    setActiveModal('ticket')
  }

  const handleOpenLoanForAsset = (assetId) => {
    setLoanForm((previous) => ({ ...previous, asset_id: assetId }))
    setError('')
    setMessage('')
    setSelectedManagedAssetId(assetId)
    setActiveModal('loan')
  }

  const handleResetAssetFilters = () => {
    setAssetSearch('')
    setAssetFilters(defaultAssetFilters)
    setAssetPage(0)
  }

  const handleAssetPageChange = (nextPage) => {
    if (nextPage < 0 || nextPage >= assetTotalPages) {
      return
    }
    setAssetPage(nextPage)
  }

  const handleCloseWorkflowModal = () => {
    if (activeModal === 'asset') resetForm()
    if (activeModal === 'ticket') resetTicketForm()
    if (activeModal === 'loan') resetLoanForm()
    if (activeModal === 'history') setSelectedAssetHistoryId(null)
    if (activeModal === 'manage') setSelectedManagedAssetId(null)
    setActiveModal(null)
  }

  useEffect(() => {
    if (!activeModal) {
      document.body.classList.remove('infra-workflow-open')
      return undefined
    }

    document.body.classList.add('infra-workflow-open')
    return () => {
      document.body.classList.remove('infra-workflow-open')
    }
  }, [activeModal])

  useEffect(() => {
    setAssetPage(0)
  }, [assetSearch, assetFilters])

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

      {activeModal ? createPortal(
        <div className="infra-workflow-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) handleCloseWorkflowModal()
        }}>
          <section className={`infra-workflow-modal${activeModal === 'history' ? ' is-history' : ''}`} role="dialog" aria-modal="true" aria-label={activeModal === 'history' ? 'Historial de equipo' : 'Flujo de inventario'}>
            <header className="infra-workflow-modal-head">
              <div>
                <p className="infra-kicker">{activeModal === 'history' ? 'Historial tecnico' : 'Inventario guiado'}</p>
                <h3>
                  {activeModal === 'manage' ? (selectedManagedAsset ? `Gestionar ${selectedManagedAsset.name}` : 'Gestionar equipo') : null}
                  {activeModal === 'asset' ? (editingId ? 'Editar equipo' : 'Nuevo equipo') : null}
                  {activeModal === 'ticket' ? 'Registrar ticket tecnico' : null}
                  {activeModal === 'loan' ? 'Registrar prestamo' : null}
                  {activeModal === 'history' ? (selectedHistoryAsset ? `Bitacora de ${selectedHistoryAsset.name}` : 'Historial del equipo') : null}
                </h3>
                <p>
                  {activeModal === 'manage' ? 'Desde aqui puedes revisar el estado del equipo y elegir una sola accion sin saturar la tabla.' : null}
                  {activeModal === 'asset' ? 'Completa la informacion esencial para mantener el catalogo claro y actualizado.' : null}
                  {activeModal === 'ticket' ? 'Documenta el mantenimiento o dano para que el historial tecnico quede trazable.' : null}
                  {activeModal === 'loan' ? 'Identifica al usuario, selecciona el equipo y registra la salida de forma segura.' : null}
                  {activeModal === 'history' ? 'Consulta el recorrido completo del equipo: incidentes, mantenimientos, prestamos y responsables asociados.' : null}
                </p>
              </div>
              <button type="button" className="infra-workflow-close" onClick={handleCloseWorkflowModal} aria-label="Cerrar">x</button>
            </header>

            {error ? <p className="infra-alert infra-error">{error}</p> : null}

            {activeModal === 'manage' ? (
              <div className="infra-manage-shell">
                <section className="infra-manage-hero">
                  <div className="infra-manage-copy">
                    <span className={`infra-status-badge ${assetStatusBadgeClass(selectedManagedAsset?.status || 'neutral')}`}>
                      {assetStatusLabel(selectedManagedAsset?.status || 'Sin estado')}
                    </span>
                    <h4>{selectedManagedAsset?.name || 'Equipo sin seleccionar'}</h4>
                    <p>{selectedManagedAsset?.serial_number ? `Serie ${selectedManagedAsset.serial_number}` : 'Sin numero de serie registrado'}</p>
                  </div>
                  <div className="infra-manage-meta">
                    <span><strong>Categoria:</strong> {selectedManagedAsset?.category || 'Sin categoria'}</span>
                    <span><strong>Ubicacion:</strong> {selectedManagedAsset?.location || 'Sin ubicacion'}</span>
                    <span><strong>Laboratorio:</strong> {selectedManagedAsset?.laboratory_id ? labNameById[String(selectedManagedAsset.laboratory_id)] || `Lab ${selectedManagedAsset.laboratory_id}` : 'General'}</span>
                    <span><strong>Ultimo cambio:</strong> {selectedManagedAsset?.status_updated_at ? formatDateTime(selectedManagedAsset.status_updated_at) : 'Sin cambios registrados'}</span>
                  </div>
                </section>

                <div className="infra-manage-grid">
                  <button type="button" className="infra-manage-card" onClick={() => {
                    if (!selectedManagedAsset) return
                    handleToggleHistory(selectedManagedAsset.id)
                  }}>
                    <strong>Ver historial</strong>
                    <span>Revisa prestamos, tickets y cambios de estado del equipo.</span>
                  </button>
                  {canManageLoans ? (
                    <button type="button" className="infra-manage-card" onClick={() => {
                      if (!selectedManagedAsset) return
                      handleOpenLoanForAsset(selectedManagedAsset.id)
                    }}>
                      <strong>Registrar prestamo</strong>
                      <span>Asigna este equipo a un usuario del directorio institucional.</span>
                    </button>
                  ) : null}
                  {canManageStatus ? (
                    <button type="button" className="infra-manage-card" onClick={() => {
                      if (!selectedManagedAsset) return
                      handleOpenTicketForAsset(selectedManagedAsset.id)
                    }}>
                      <strong>Reportar ticket</strong>
                      <span>Documenta mantenimiento o dano sin buscar el equipo otra vez.</span>
                    </button>
                  ) : null}
                  {canManage ? (
                    <button type="button" className="infra-manage-card" onClick={() => {
                      if (!selectedManagedAsset) return
                      handleOpenAssetEditor(selectedManagedAsset)
                    }}>
                      <strong>Editar equipo</strong>
                      <span>Actualiza nombre, serie, ubicacion, laboratorio o estado.</span>
                    </button>
                  ) : null}
                  {canManage ? (
                    <button type="button" className="infra-manage-card danger" onClick={() => {
                      if (!selectedManagedAsset) return
                      handleCloseWorkflowModal()
                      handleDelete(selectedManagedAsset.id)
                    }}>
                      <strong>Eliminar equipo</strong>
                      <span>Quita este registro del inventario si ya no corresponde conservarlo.</span>
                    </button>
                  ) : null}
                </div>

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={handleCloseWorkflowModal}>Cerrar</button>
                </div>
              </div>
            ) : null}

            {activeModal === 'asset' ? (
              <form className="infra-form infra-workflow-form" onSubmit={handleSubmit}>
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

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={handleCloseWorkflowModal}>Cerrar</button>
                  <button type="submit" className="infra-primary" disabled={!canSubmitAssetForm}>{editingId ? 'Guardar cambios' : 'Crear equipo'}</button>
                </div>
              </form>
            ) : null}

            {activeModal === 'ticket' ? (
              <form className="infra-form infra-workflow-form" onSubmit={handleCreateTicket}>
                <div className="infra-form-section">
                  <span className="infra-form-section-label">1 - Equipo y tipo de reporte</span>
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
                      <input value="Se genera automaticamente al guardar" readOnly />
                    </label>
                  </div>
                </div>

                <div className="infra-form-section">
                  <span className="infra-form-section-label">2 - Detalle tecnico</span>
                  <label>
                    <span>Titulo</span>
                    <input value={ticketForm.title} onChange={(event) => setTicketForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Ej. Pantalla rota, calibracion preventiva, cambio de fuente" required />
                  </label>
                  <label>
                    <span>Descripcion tecnica</span>
                    <textarea rows="4" value={ticketForm.description} onChange={(event) => setTicketForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Describe el dano o mantenimiento requerido." required />
                  </label>
                </div>

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={handleCloseWorkflowModal}>Cerrar</button>
                  <button type="submit" className="infra-primary" disabled={!canSubmitTicketForm}>{savingTicket ? 'Guardando ticket...' : 'Registrar ticket'}</button>
                </div>
              </form>
            ) : null}

            {activeModal === 'loan' ? (
              <form className="infra-form infra-workflow-form" onSubmit={handleCreateLoan}>
                <div className="infra-form-section">
                  <span className="infra-form-section-label">1 - Usuario solicitante</span>
                  {renderBorrowerDirectoryFields()}
                </div>

                <div className="infra-form-section">
                  <span className="infra-form-section-label">2 - Equipo y salida</span>
                  <div className="infra-form-grid">
                    <label>
                      <span>Equipo</span>
                      <select value={loanForm.asset_id} onChange={(event) => setLoanForm((previous) => ({ ...previous, asset_id: event.target.value }))} required>
                        <option value="">Selecciona un equipo</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name} {asset.serial_number ? `- ${asset.serial_number}` : ''} - {assetStatusLabel(asset.status)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Estado actual</span>
                      <input value={selectedLoanAsset ? assetStatusLabel(selectedLoanAsset.status) : 'Sin seleccionar'} readOnly />
                    </label>
                  </div>
                  <label>
                    <span>Motivo del prestamo</span>
                    <textarea rows="3" value={loanForm.purpose} onChange={(event) => setLoanForm((previous) => ({ ...previous, purpose: event.target.value }))} placeholder="Ej. Practica de electronica, apoyo en laboratorio, demostracion docente" />
                  </label>
                  <label>
                    <span>Observaciones de salida</span>
                    <textarea rows="3" value={loanForm.notes} onChange={(event) => setLoanForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Accesorios incluidos, condiciones iniciales o notas de entrega" />
                  </label>
                  {selectedLoanAsset && selectedLoanAsset.status !== 'available' ? <p className="infra-inline-error">Este equipo no esta disponible para prestamo. Estado actual: {assetStatusLabel(selectedLoanAsset.status)}.</p> : null}
                </div>

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={handleCloseWorkflowModal}>Cerrar</button>
                  <button type="submit" className="infra-primary" disabled={!canManageLoans || savingLoan || !selectedBorrowerProfile || Boolean(userDirectoryMessage)}>{savingLoan ? 'Registrando...' : 'Registrar prestamo'}</button>
                </div>
              </form>
            ) : null}

            {activeModal === 'history' ? (
              <div className="infra-history-modal-shell">
                <section className="infra-history-modal-overview">
                  <article className="infra-history-modal-stat is-highlight">
                    <span>Equipo</span>
                    <strong>{selectedHistoryAsset?.name || 'Sin seleccionar'}</strong>
                    <small>{selectedHistoryAsset?.serial_number ? `Serie ${selectedHistoryAsset.serial_number}` : 'Sin numero de serie'}</small>
                  </article>
                  <article className="infra-history-modal-stat">
                    <span>Estado actual</span>
                    <strong>{selectedHistoryAsset ? assetStatusLabel(selectedHistoryAsset.status) : 'Sin datos'}</strong>
                    <small>{selectedHistoryAsset?.status_updated_at ? formatDateTime(selectedHistoryAsset.status_updated_at) : 'Sin cambios registrados'}</small>
                  </article>
                  <article className="infra-history-modal-stat">
                    <span>Laboratorio</span>
                    <strong>{selectedHistoryAsset?.laboratory_id ? labNameById[String(selectedHistoryAsset.laboratory_id)] || `Lab ${selectedHistoryAsset.laboratory_id}` : 'General'}</strong>
                    <small>{selectedHistoryAsset?.location || 'Sin ubicacion fija'}</small>
                  </article>
                  <article className="infra-history-modal-stat">
                    <span>Actividad registrada</span>
                    <strong>{assetHistoryLoadingId === selectedAssetHistoryId ? 'Cargando...' : `${(assetStatusHistory[selectedAssetHistoryId] || []).length} tickets`}</strong>
                    <small>{assetHistoryLoadingId === selectedAssetHistoryId ? 'Obteniendo prestamos...' : `${(assetLoanHistory[selectedAssetHistoryId] || []).length} prestamos historicos`}</small>
                  </article>
                </section>

                {assetHistoryLoadingId === selectedAssetHistoryId ? (
                  <p className="infra-empty">Cargando historial...</p>
                ) : (
                  <div className="infra-detail-grid">
                    <section className="infra-subsection">
                      <div className="infra-subsection-head">
                        <h4>Mantenimiento y danos</h4>
                        <p>Listado cronologico de reparaciones, incidentes y resoluciones registradas sobre este equipo.</p>
                      </div>
                      {(assetStatusHistory[selectedAssetHistoryId] || []).length === 0 ? (
                        <p className="infra-empty">Aun no hay reparaciones ni mantenimientos registrados para este equipo.</p>
                      ) : (
                        <div className="infra-history-list">
                          {(assetStatusHistory[selectedAssetHistoryId] || []).map((entry) => (
                            <article key={entry.id} className="infra-history-item">
                              <div>
                                <span className={`infra-status-badge ${entry.status === 'closed' ? 'available' : 'maintenance'}`}>{maintenanceTypeLabel(entry.ticket_type)} - {entry.status === 'closed' ? 'Cerrado' : 'Activo'}</span>
                                <small>{formatDateTime(entry.reported_at)}</small>
                              </div>
                              <div>
                                <strong>{entry.title}</strong>
                                <small>ID reporte: {entry.evidence_report_id || 'Sin ID registrado'}</small>
                                <small>{entry.description}</small>
                                <small>Estado: {assetStatusLabel(entry.asset_status_before || 'available')} {' -> '} {assetStatusLabel(entry.asset_status_after_open || 'maintenance')}</small>
                                {entry.resolved_at ? <small>Resuelto: {formatDateTime(entry.resolved_at)} por {entry.resolved_by || 'Sistema'}{entry.resolved_by_email ? ` (${entry.resolved_by_email})` : ''}</small> : null}
                                {entry.resolution_notes ? <small>Resolucion: {entry.resolution_notes}</small> : null}
                                {entry.is_responsibility_flagged ? <small className="infra-negative">Ultimo prestamo asociado: {entry.responsible_borrower_name || entry.responsible_borrower_email || 'Responsable no identificado'}</small> : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="infra-subsection">
                      <div className="infra-subsection-head">
                        <h4>Historial de prestamos</h4>
                        <p>Usuarios que utilizaron este activo, fechas de salida y condiciones de devolucion registradas.</p>
                      </div>
                      {(assetLoanHistory[selectedAssetHistoryId] || []).length === 0 ? (
                        <p className="infra-empty">Este equipo aun no registra prestamos historicos.</p>
                      ) : (
                        <div className="infra-history-table-wrap">
                          <table className="infra-table">
                            <thead>
                              <tr>
                                <th>Usuario</th>
                                <th>Salida</th>
                                <th>Devolucion</th>
                                <th>Estado</th>
                                <th>Detalle</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(assetLoanHistory[selectedAssetHistoryId] || []).map((loan) => (
                                <tr key={loan.id}>
                                  <td>
                                    <strong>{loan.borrower_name || loan.borrower_id}</strong>
                                    <small>{loan.borrower_email || loan.borrower_id}</small>
                                  </td>
                                  <td>
                                    {formatDateTime(loan.loaned_at)}
                                    <small>Registrado por {loan.loaned_by || 'Sistema'}</small>
                                  </td>
                                  <td>
                                    {loan.returned_at ? formatDateTime(loan.returned_at) : 'Pendiente'}
                                    <small>{loan.returned_by ? `Recibido por ${loan.returned_by}` : 'Sin cierre'}</small>
                                  </td>
                                  <td>
                                    <span className={`infra-status-badge ${loan.status === 'returned' ? 'available' : 'loaned'}`}>{formatStatus(loan.status)}</span>
                                    {loan.status === 'returned' ? <small>{returnConditionLabel(loan.return_condition)}</small> : null}
                                  </td>
                                  <td>
                                    <small>{loan.purpose || 'Sin motivo registrado'}</small>
                                    {loan.return_notes ? <small>Observacion: {loan.return_notes}</small> : null}
                                    {loan.incident_notes ? <small className="infra-negative">Dano: {loan.incident_notes}</small> : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                <div className="infra-actions infra-workflow-actions">
                  <button type="button" className="infra-secondary" onClick={handleCloseWorkflowModal}>Cerrar historial</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>,
        document.body,
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
          <section className="infra-command-panel infra-card-full">
            <div className="infra-command-copy">
              <p className="infra-kicker">Centro de operaciones</p>
              <h3>Que necesitas hacer ahora?</h3>
              <p>Usa acciones guiadas para crear equipos, registrar incidentes o prestar recursos sin mostrar todos los formularios al mismo tiempo.</p>
            </div>
            <div className="infra-action-grid">
              {canManage ? (
                <button type="button" className="infra-action-card" onClick={() => { resetForm(); setActiveModal('asset') }}>
                  <span>1</span>
                  <strong>Nuevo equipo</strong>
                  <small>Registra nombre, serie, ubicacion y laboratorio.</small>
                </button>
              ) : null}
              {canManageStatus ? (
                <button type="button" className="infra-action-card" onClick={() => { resetTicketForm(); setActiveModal('ticket') }}>
                  <span>2</span>
                  <strong>Ticket tecnico</strong>
                  <small>Documenta mantenimiento o dano y deja historial.</small>
                </button>
              ) : null}
              {canManageLoans ? (
                <button type="button" className="infra-action-card is-primary" onClick={() => { resetLoanForm(); setActiveModal('loan') }}>
                  <span>3</span>
                  <strong>Registrar prestamo</strong>
                  <small>Selecciona usuario y equipo disponible.</small>
                </button>
              ) : null}
            </div>
          </section>

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
                  <button type="submit" className="infra-primary" disabled={!canSubmitAssetForm}>{editingId ? 'Actualizar equipo' : 'Crear equipo'}</button>
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
                    <input value="Se genera automaticamente al guardar" readOnly />
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
                <button type="submit" className="infra-primary" disabled={!canSubmitTicketForm}>{savingTicket ? 'Guardando ticket...' : 'Registrar ticket'}</button>
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
                      <span><strong>ID reporte:</strong> {ticket.evidence_report_id || 'Pendiente de generar'}</span>
                      <span><strong>Equipo:</strong> {ticket.asset_name || assetNameById[String(ticket.asset_id)] || 'Equipo no identificado'} · ID {ticket.asset_id || 'Sin ID'}</span>
                      <span><strong>Abierto:</strong> {formatDateTime(ticket.reported_at)} por {ticket.reported_by || 'Sin registro'}{ticket.reported_by_email ? ` (${ticket.reported_by_email})` : ''}</span>
                      {ticket.is_responsibility_flagged ? <span className="infra-negative">Responsable asociado: {ticket.responsible_borrower_name || ticket.responsible_borrower_email || 'Prestamo previo'}</span> : null}
                    </div>
                    <label className="infra-ticket-resolution">
                      <span>Resolucion para cierre</span>
                      <textarea rows="3" value={resolutionDrafts[ticket.id] || ''} onChange={(event) => setResolutionDrafts((previous) => ({ ...previous, [ticket.id]: event.target.value }))} placeholder="Describe la reparacion realizada y el resultado." />
                    </label>
                    <div className="infra-actions infra-actions-start">
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
                    {renderBorrowerDirectoryFields()}
                  </div>

                  <div className="infra-form-section">
                    <span className="infra-form-section-label">2 - Equipo y salida</span>
                    <div className="infra-form-grid">
                      <label>
                        <span>Equipo</span>
                        <select value={loanForm.asset_id} onChange={(event) => setLoanForm((previous) => ({ ...previous, asset_id: event.target.value }))} required>
                          <option value="">Selecciona un equipo</option>
                          {assets.map((asset) => (
                            <option key={asset.id} value={asset.id}>{asset.name} {asset.serial_number ? `- ${asset.serial_number}` : ''} - {assetStatusLabel(asset.status)}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Estado actual</span>
                        <input value={selectedLoanAsset ? assetStatusLabel(selectedLoanAsset.status) : 'Sin seleccionar'} readOnly />
                      </label>
                    </div>
                    <label>
                      <span>Motivo del prestamo</span>
                      <textarea rows="3" value={loanForm.purpose} onChange={(event) => setLoanForm((previous) => ({ ...previous, purpose: event.target.value }))} placeholder="Ej. Practica de electronica, apoyo en laboratorio, demostracion docente" />
                    </label>
                    <label>
                      <span>Observaciones de salida</span>
                      <textarea rows="3" value={loanForm.notes} onChange={(event) => setLoanForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Accesorios incluidos, condiciones iniciales o notas de entrega" />
                    </label>
                    {selectedLoanAsset && selectedLoanAsset.status !== 'available' ? <p className="infra-inline-error">Este equipo no esta disponible para prestamo. Estado actual: {assetStatusLabel(selectedLoanAsset.status)}.</p> : null}
                  </div>

                  <div className="infra-actions">
                    <button type="submit" className="infra-primary" disabled={!canManageLoans || savingLoan || !selectedBorrowerProfile || Boolean(userDirectoryMessage)}>{savingLoan ? 'Registrando...' : 'Registrar prestamo'}</button>
                    <button type="button" className="infra-secondary" onClick={resetLoanForm}>Limpiar</button>
                  </div>
                </form>
              </section>

              <section className="infra-loan-panel">
                <div className="infra-section-head">
                  <div>
                    <h3>Prestamos activos</h3>
                    <p>Devuelve aqui los equipos prestados o revisa quien tiene cada recurso en este momento.</p>
                  </div>
                  <div className="infra-chip-list">
                    <span className="infra-chip">Activos {loanDashboard.active_count}</span>
                    <span className="infra-chip">Historial {loanDashboard.total_records}</span>
                  </div>
                </div>

                {loanDashboard.active_loans.length === 0 ? (
                  <p className="infra-empty">No hay prestamos activos en este momento.</p>
                ) : (
                  <div className="infra-list">
                    {loanDashboard.active_loans.map((loan) => (
                      <article key={loan.id} className="infra-ticket-card">
                        <div className="infra-ticket-head">
                          <div>
                            <strong>{loan.asset_name}</strong>
                            <p>{loan.borrower_name || loan.borrower_id}</p>
                          </div>
                          <div className="infra-chip-list">
                            <span className="infra-chip">{formatStatus(loan.status)}</span>
                            {loan.asset_serial_number ? <span className="infra-chip">{loan.asset_serial_number}</span> : null}
                          </div>
                        </div>
                        <div className="infra-ticket-meta">
                          <span><strong>Salida:</strong> {formatDateTime(loan.loaned_at)}</span>
                          <span><strong>Registrado por:</strong> {loan.loaned_by || 'Sistema'}</span>
                          <span><strong>Correo:</strong> {loan.borrower_email || 'Sin correo'}</span>
                          <span><strong>Motivo:</strong> {loan.purpose || 'Sin motivo registrado'}</span>
                        </div>
                        {loan.notes ? <p className="infra-ticket-copy">{loan.notes}</p> : null}
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
                <h3>Equipos</h3>
                <p>Filtra primero y luego abre cada equipo en una ventana para gestionarlo con calma.</p>
              </div>
              <div className="infra-equipment-results">
                <strong>{filteredAssets.length}</strong>
                <span>{filteredAssets.length === 1 ? 'equipo encontrado' : 'equipos encontrados'}</span>
              </div>
            </div>

            <section className="infra-filter-panel" aria-label="Filtros de equipos">
              <div className="infra-filter-primary">
                <label>
                  <span>Buscar</span>
                  <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Ej. OSC-01, SN-2004, osciloscopio" />
                </label>
              </div>
              <div className="infra-filter-row">
                <label>
                  <span>Estado</span>
                  <select
                    value={assetFilters.status}
                    onChange={(event) => setAssetFilters((previous) => ({ ...previous, status: event.target.value }))}
                  >
                    <option value="all">Todos</option>
                    <option value="available">Disponible</option>
                    <option value="loaned">Prestado</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="damaged">Danado</option>
                  </select>
                </label>
                <label>
                  <span>Laboratorio</span>
                  <select
                    value={assetFilters.laboratory_id}
                    onChange={(event) => setAssetFilters((previous) => ({ ...previous, laboratory_id: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>Categoria</span>
                  <select
                    value={assetFilters.category}
                    onChange={(event) => setAssetFilters((previous) => ({ ...previous, category: event.target.value }))}
                  >
                    <option value="all">Todas</option>
                    {assetCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <button type="button" className="infra-secondary" onClick={handleResetAssetFilters}>
                  Limpiar
                </button>
              </div>
            </section>

            <div className="infra-table-meta">
              <span>
                Mostrando {assetVisibleStart}-{assetVisibleEnd} de {filteredAssets.length} equipos
              </span>
              <span>
                Pagina {filteredAssets.length === 0 ? 0 : assetPage + 1} de {filteredAssets.length === 0 ? 0 : assetTotalPages}
              </span>
            </div>

            <div className="infra-table-wrap">
              <table className="infra-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Categoria</th>
                    <th>Ubicacion</th>
                    <th>Laboratorio</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <p className="infra-empty">No hay equipos para este filtro.</p>
                      </td>
                    </tr>
                  ) : paginatedAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <strong>{asset.name}</strong>
                        {asset.serial_number ? <small>Serie {asset.serial_number}</small> : null}
                      </td>
                      <td>{asset.category}</td>
                      <td>{asset.location || 'Sin ubicacion'}</td>
                      <td>{asset.laboratory_id ? labNameById[String(asset.laboratory_id)] || `Lab ${asset.laboratory_id}` : 'General'}</td>
                      <td>
                        <div className="infra-status-cell">
                          <span className={`infra-status-badge ${assetStatusBadgeClass(asset.status)}`}>{assetStatusLabel(asset.status)}</span>
                          <small>{asset.status_updated_by ? `Ultimo cambio: ${asset.status_updated_by} - ${formatDateTime(asset.status_updated_at)}` : 'Sin cambios registrados'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="infra-actions compact">
                          <button type="button" className="infra-secondary infra-secondary-strong" onClick={() => handleOpenManageAsset(asset)}>
                            Gestionar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredAssets.length > 0 ? (
              <div className="infra-pagination">
                <button
                  type="button"
                  className="infra-secondary"
                  onClick={() => handleAssetPageChange(assetPage - 1)}
                  disabled={assetPage <= 0}
                >
                  Anterior
                </button>
                <div className="infra-pagination-pages">
                  {Array.from({ length: assetTotalPages }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`infra-page-chip ${assetPage === index ? 'is-active' : ''}`}
                      onClick={() => handleAssetPageChange(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="infra-secondary"
                  onClick={() => handleAssetPageChange(assetPage + 1)}
                  disabled={assetPage >= assetTotalPages - 1}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminEquiposPage
