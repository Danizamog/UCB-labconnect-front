import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import { listAdminLabs, listAssetMaintenanceTickets, listAssets } from '../../admin/services/infrastructureService'
import { listUserProfiles } from '../../admin/services/profileService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import SimplePenaltyModal from './SimplePenaltyModal'
import {
  createPenalty,
  liftPenalty,
  listPenalties,
  listReservations,
  subscribeReservationsRealtime,
} from '../services/reservationsService'
import './ReservationsPages.css'

function toLocalDateTimeValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseDateTimeValue(value) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addDaysToDateTimeValue(value, days) {
  const start = parseDateTimeValue(value) || new Date()
  return toLocalDateTimeValue(new Date(start.getTime() + days * 24 * 60 * 60 * 1000))
}

function createDefaultForm() {
  const now = new Date()
  return {
    user_selection: '',
    user_id: '',
    user_name: '',
    user_email: '',
    evidence_type: 'damage_report',
    evidence_ticket_id: '',
    evidence_report_id: '',
    incident_scope: 'asset',
    incident_laboratory_id: '',
    incident_date: toLocalDateTimeValue(now).slice(0, 10),
    incident_start_time: '',
    incident_end_time: '',
    asset_id: '',
    starts_at: toLocalDateTimeValue(now),
    ends_at: addDaysToDateTimeValue(now, 3),
    reason: '',
    notes: '',
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function buildPenaltyValidation(form) {
  const errors = {}
  const email = normalizeEmail(form.user_email)
  const reason = String(form.reason || '').trim()
  const startsAt = parseDateTimeValue(form.starts_at)
  const endsAt = parseDateTimeValue(form.ends_at)

  if (!String(form.user_id || '').trim()) {
    errors.user_id = 'Selecciona o registra el usuario responsable.'
  }

  if (!email) {
    errors.user_email = 'Registra el correo institucional del usuario.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.user_email = 'El correo no tiene un formato valido.'
  } else if (!email.endsWith('@ucb.edu.bo')) {
    errors.user_email = 'Usa el correo institucional @ucb.edu.bo.'
  }

  if (!startsAt) {
    errors.starts_at = 'Indica el inicio de la penalizacion.'
  }

  if (!endsAt) {
    errors.ends_at = 'Indica el fin de la penalizacion.'
  }

  if (startsAt && endsAt && endsAt <= startsAt) {
    errors.ends_at = 'El fin debe ser posterior al inicio.'
  }

  if (endsAt && endsAt <= new Date()) {
    errors.ends_at = 'La penalizacion debe terminar en una fecha futura.'
  }

  if (reason.length < 10) {
    errors.reason = 'Describe el motivo con al menos 10 caracteres.'
  }

  if (String(form.notes || '').length > 500) {
    errors.notes = 'Las notas internas no deben superar 500 caracteres.'
  }

  if (!String(form.incident_laboratory_id || '').trim()) {
    errors.incident_laboratory_id = 'Selecciona el laboratorio donde ocurrio el incidente.'
  }

  if (!String(form.incident_date || '').trim()) {
    errors.incident_date = 'Especifica la fecha del incidente.'
  }

  if (!String(form.incident_start_time || '').trim() || !String(form.incident_end_time || '').trim()) {
    errors.incident_time = 'Selecciona el bloque horario del incidente.'
  } else if (form.incident_end_time <= form.incident_start_time) {
    errors.incident_time = 'La hora de fin del bloque debe ser posterior al inicio.'
  }

  return errors
}

function formatPenaltyDateTime(value) {
  if (!value) {
    return 'Sin fecha'
  }

  return String(value).replace('T', ' ').replace('Z', '').slice(0, 16)
}

function getAssetLabel(asset) {
  if (!asset) {
    return ''
  }

  return asset.name || asset.code || asset.serial_number || asset.id || ''
}

const STATUS_LABELS = {
  active: 'Activa',
  scheduled: 'Programada',
  expired: 'Expirada',
  lifted: 'Levantada',
}

function AdminPenaltiesPage({ user }) {
  const [penalties, setPenalties] = useState([])
  const [reservations, setReservations] = useState([])
  const [assets, setAssets] = useState([])
  const [tickets, setTickets] = useState([])
  const [labs, setLabs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(createDefaultForm)
  const [penaltyToLift, setPenaltyToLift] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLifting, setIsLifting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = hasAnyPermission(user, ['gestionar_penalizaciones'])

  const loadPenalties = useCallback(async () => {
    const data = await listPenalties()
    setPenalties(Array.isArray(data) ? data : [])
  }, [])

  const loadSupportData = useCallback(async () => {
    const [reservationsResult, assetsResult, ticketsResult, profilesResult, labsResult] = await Promise.allSettled([
      listReservations(),
      listAssets(),
      listAssetMaintenanceTickets(),
      listUserProfiles(),
      listAdminLabs(),
    ])

    if (reservationsResult.status === 'fulfilled') {
      setReservations(reservationsResult.value)
    } else {
      setReservations([])
    }

    if (assetsResult.status === 'fulfilled') {
      setAssets(Array.isArray(assetsResult.value) ? assetsResult.value : [])
    } else {
      setAssets([])
    }

    if (ticketsResult.status === 'fulfilled') {
      setTickets(Array.isArray(ticketsResult.value) ? ticketsResult.value : [])
    } else {
      setTickets([])
    }

    if (profilesResult.status === 'fulfilled') {
      setProfiles(Array.isArray(profilesResult.value) ? profilesResult.value : [])
    } else {
      setProfiles([])
    }

    if (labsResult.status === 'fulfilled') {
      setLabs(Array.isArray(labsResult.value) ? labsResult.value : [])
    } else {
      setLabs([])
    }
  }, [])

  useEffect(() => {
    Promise.all([loadPenalties(), loadSupportData()]).catch((err) => {
      setError(err?.message || 'No se pudo cargar el panel de penalizaciones.')
    })

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'user_penalty') {
        loadPenalties().catch(() => {})
      }
    })

    return () => unsubscribe?.()
  }, [loadPenalties, loadSupportData])

  const assetById = useMemo(() => {
    const mapped = new Map()
    assets.forEach((asset) => {
      if (asset?.id) {
        mapped.set(String(asset.id), asset)
      }
    })
    return mapped
  }, [assets])

  const labById = useMemo(() => {
    const mapped = new Map()
    labs.forEach((lab) => {
      if (lab?.id) {
        mapped.set(String(lab.id), lab)
      }
    })
    return mapped
  }, [labs])

  const ticketById = useMemo(() => {
    const mapped = new Map()
    tickets.forEach((ticket) => {
      if (ticket?.id) {
        mapped.set(String(ticket.id), ticket)
      }
    })
    return mapped
  }, [tickets])

  const userOptions = useMemo(() => {
    const seen = new Set()
    const options = []

    const addOption = ({ user_id, user_name, user_email, role = '', source = '' }) => {
      const normalizedUserId = String(user_id || '').trim()
      const normalizedEmail = normalizeEmail(user_email)
      const key = normalizedUserId || normalizedEmail
      if (!key || seen.has(key)) {
        return
      }
      seen.add(key)
      options.push({
        value: normalizedUserId,
        user_id: normalizedUserId,
        user_name: String(user_name || normalizedEmail || normalizedUserId).trim(),
        user_email: normalizedEmail,
        role,
        source,
        label: `${String(user_name || normalizedEmail || normalizedUserId).trim()} - ${normalizedEmail || 'sin correo'}${role ? ` - ${role}` : ''}`,
      })
    }

    profiles.forEach((profile) => {
      addOption({
        user_id: profile.id,
        user_name: profile.name,
        user_email: profile.email || profile.username,
        role: profile.role,
        source: 'Perfil',
      })
    })

    reservations.forEach((reservation) => {
      addOption({
        user_id: reservation.requested_by,
        user_name: reservation.requested_by_name,
        user_email: reservation.requested_by_email,
        source: 'Reserva previa',
      })
    })

    return options.sort((a, b) => a.user_name.localeCompare(b.user_name))
  }, [profiles, reservations])

  const selectedUser = useMemo(
    () => userOptions.find((option) => option.value === form.user_selection) || null,
    [form.user_selection, userOptions],
  )

  const selectedAsset = useMemo(
    () => assetById.get(String(form.asset_id || '')) || null,
    [assetById, form.asset_id],
  )

  const filteredEvidenceOptions = useMemo(() => {
    const expectedType = form.evidence_type === 'maintenance_report' ? 'maintenance' : 'damage'
    const selectedLabId = String(form.incident_laboratory_id || '')
    const selectedAssetId = String(form.asset_id || '')

    return tickets
      .filter((ticket) => String(ticket.ticket_type || '') === expectedType)
      .filter((ticket) => {
        if (!selectedLabId) {
          return true
        }
        const relatedAsset = assetById.get(String(ticket.asset_id || ''))
        return String(relatedAsset?.laboratory_id || '') === selectedLabId
      })
      .filter((ticket) => {
        if (form.incident_scope !== 'asset' || !selectedAssetId) {
          return true
        }
        return String(ticket.asset_id || '') === selectedAssetId
      })
      .sort((left, right) => String(right.reported_at || '').localeCompare(String(left.reported_at || '')))
  }, [assetById, form.asset_id, form.evidence_type, form.incident_laboratory_id, form.incident_scope, tickets])

  const selectedEvidence = useMemo(
    () => ticketById.get(String(form.evidence_ticket_id || '')) || null,
    [form.evidence_ticket_id, ticketById],
  )

  const selectedLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(form.incident_laboratory_id)) || null,
    [form.incident_laboratory_id, labs],
  )

  const filteredAssets = useMemo(() => {
    const labId = String(form.incident_laboratory_id || '')
    if (!labId) {
      return assets
    }
    return assets.filter((asset) => String(asset.laboratory_id || '') === labId)
  }, [assets, form.incident_laboratory_id])

  const userReservations = useMemo(() => {
    if (!selectedUser) {
      return []
    }
    const userId = String(selectedUser.user_id || '')
    return reservations
      .filter((r) => String(r.requested_by || '') === userId)
      .map((r) => {
        const labName = r.laboratory_name || (labs.find((l) => String(l.id) === String(r.laboratory_id))?.name || 'Laboratorio desconocido')
        return {
          id: r.id,
          laboratory_id: r.laboratory_id || '',
          laboratory_name: labName,
          date: r.date || r.start_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          start_time: r.start_time || r.start_at?.split('T')[1]?.slice(0, 5) || '00:00',
          end_time: r.end_time || r.end_at?.split('T')[1]?.slice(0, 5) || '00:00',
          status: r.status || 'unknown',
        }
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [selectedUser, reservations, labs])

  const formErrors = useMemo(() => buildPenaltyValidation(form), [form])
  const formValidationMessage = Object.values(formErrors)[0] || ''

  const activePenalties = penalties.filter((penalty) => penalty.is_active)
  const emailSentCount = penalties.filter((penalty) => penalty.email_sent).length

  const openModal = () => {
    setForm(createDefaultForm())
    setIsModalOpen(true)
    setError('')
    setMessage('')
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setForm(createDefaultForm())
    setIsSubmitting(false)
  }

  const handleFormChange = (field, value) => {
    if (field === 'user_selection') {
      const selected = userOptions.find((option) => option.value === value)
      setForm((previous) => ({
        ...previous,
        user_selection: value,
        user_id: selected?.user_id || '',
        user_name: selected?.user_name || '',
        user_email: selected?.user_email || '',
      }))
      return
    }

    if (field === 'starts_at') {
      setForm((previous) => {
        const start = parseDateTimeValue(value)
        const end = parseDateTimeValue(previous.ends_at)
        return {
          ...previous,
          starts_at: value,
          ends_at: start && (!end || end <= start) ? addDaysToDateTimeValue(value, 3) : previous.ends_at,
        }
      })
      return
    }

    if (field === 'incident_laboratory_id') {
      setForm((previous) => ({
        ...previous,
        incident_laboratory_id: value,
        asset_id: '',
        evidence_ticket_id: '',
        evidence_report_id: '',
      }))
      return
    }

    if (field === 'incident_scope') {
      setForm((previous) => ({
        ...previous,
        incident_scope: value,
        asset_id: value === 'asset' ? previous.asset_id : '',
        evidence_ticket_id: '',
        evidence_report_id: '',
      }))
      return
    }

    if (field === 'asset_id') {
      setForm((previous) => ({
        ...previous,
        asset_id: value,
        evidence_ticket_id: '',
        evidence_report_id: '',
      }))
      return
    }

    if (field === 'evidence_type') {
      setForm((previous) => ({
        ...previous,
        evidence_type: value,
        evidence_ticket_id: '',
        evidence_report_id: '',
      }))
      return
    }

    if (field === 'evidence_ticket_id') {
      const selected = ticketById.get(String(value || ''))
      setForm((previous) => ({
        ...previous,
        evidence_ticket_id: value,
        evidence_report_id: String(selected?.evidence_report_id || selected?.id || '').trim(),
        asset_id:
          previous.incident_scope === 'asset' && selected?.asset_id
            ? String(selected.asset_id)
            : previous.asset_id,
      }))
      return
    }

    setForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleApplyDuration = (days) => {
    setForm((previous) => ({
      ...previous,
      ends_at: addDaysToDateTimeValue(previous.starts_at, days),
    }))
  }

  const handleSelectReservation = (reservation) => {
    setForm((previous) => ({
      ...previous,
      incident_laboratory_id: reservation.laboratory_id || '',
      incident_date: reservation.date || '',
      incident_start_time: reservation.start_time || '00:00',
      incident_end_time: reservation.end_time || '00:00',
    }))
  }

  const handleCreatePenalty = async (event) => {
    event.preventDefault()
    if (!canManage) {
      return
    }

    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      const validationErrors = buildPenaltyValidation(form)
      const firstError = Object.values(validationErrors)[0]
      if (firstError) {
        throw new Error(firstError)
      }

      const created = await createPenalty(form)
      setMessage(
        created.email_sent
          ? 'Penalizacion registrada y correo enviado al usuario afectado.'
          : 'Penalizacion registrada. Revisa la configuracion SMTP si el correo no se envio.',
      )
      closeModal()
      await loadPenalties()
    } catch (err) {
      setError(err.message || 'No se pudo guardar la penalizacion.')
      setIsSubmitting(false)
    }
  }

  const handleConfirmLift = async () => {
    if (!penaltyToLift) {
      return
    }

    setIsLifting(true)
    setError('')
    setMessage('')

    try {
      await liftPenalty(penaltyToLift.id)
      setMessage('La penalizacion fue levantada. Si no existen otros bloqueos o restricciones del laboratorio, el usuario ya puede volver a reservar.')
      setPenaltyToLift(null)
      await loadPenalties()
    } catch (err) {
      setError(err.message || 'No se pudo levantar la penalizacion.')
    } finally {
      setIsLifting(false)
    }
  }

  return (
    <section className="reservations-page" aria-label="Panel de penalizaciones">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Control disciplinario</p>
          <h2>Penalizaciones por danos</h2>
          <p>Registra suspensiones con evidencia, bloquea nuevas reservas y rehabilita cuentas cuando el castigo termine.</p>
        </div>
        <div className="reservations-summary">
          <div><span>Total</span><strong>{penalties.length}</strong></div>
          <div><span>Activas</span><strong>{activePenalties.length}</strong></div>
          <div><span>Correos</span><strong>{emailSentCount}</strong></div>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Acciones rapidas</h3>
          <p className="reservations-panel-subtitle">
            Cada penalizacion puede enlazar un reporte de dano o mantenimiento, y activa el bloqueo de nuevas reservas de inmediato.
          </p>
        </div>
        <div className="reservations-actions">
          <button type="button" className="reservations-danger" disabled={!canManage} onClick={openModal}>
            Registrar penalizacion
          </button>
        </div>
      </section>

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Historial disciplinario</h3>
          <p className="reservations-panel-subtitle">
            Las penalizaciones activas bloquean nuevas solicitudes; las levantadas o expiradas se mantienen solo como historial.
          </p>
        </div>

        {penalties.length === 0 ? (
          <p className="reservations-empty">Aun no hay penalizaciones registradas.</p>
        ) : (
          <div className="penalty-card-grid">
            {penalties.map((penalty) => (
              <article key={penalty.id} className={`penalty-card${penalty.is_active ? ' is-active' : ''}`}>
                <div className="penalty-card-head">
                  <div>
                    <span className="reservation-user-card-kicker">Penalizacion</span>
                    <h4>{penalty.user_name || penalty.user_id}</h4>
                  </div>
                  <span className={`penalty-status ${penalty.status}`}>{STATUS_LABELS[penalty.status] || penalty.status}</span>
                </div>

                <div className="penalty-card-meta">
                  <span><strong>Correo:</strong> {penalty.user_email || 'Sin correo'}</span>
                  <span><strong>Motivo:</strong> {penalty.reason}</span>
                  <span><strong>Evidencia:</strong> {penalty.evidence_type} #{penalty.evidence_report_id || 'sin ID'}</span>
                  <span><strong>Ticket tecnico:</strong> {penalty.evidence_ticket_id || 'No vinculado'}</span>
                  <span><strong>Laboratorio:</strong> {labById.get(String(penalty.incident_laboratory_id || ''))?.name || 'No especificado'}</span>
                  <span><strong>Incidente:</strong> {penalty.incident_date || 'Sin fecha'} {penalty.incident_start_time && penalty.incident_end_time ? `· ${penalty.incident_start_time} - ${penalty.incident_end_time}` : ''}</span>
                  <span><strong>Alcance:</strong> {penalty.incident_scope === 'laboratory' ? 'Dano al laboratorio' : 'Dano a equipo'}</span>
                  <span><strong>Equipo:</strong> {getAssetLabel(assetById.get(String(penalty.asset_id || ''))) || penalty.asset_id || 'No especificado'}</span>
                  <span><strong>Vigencia:</strong> {formatPenaltyDateTime(penalty.starts_at)} hasta {formatPenaltyDateTime(penalty.ends_at)}</span>
                  <span><strong>Correo enviado:</strong> {penalty.email_sent ? 'Si' : 'No confirmado'}</span>
                </div>

                {penalty.notes ? <p className="reservation-inline-hint">{penalty.notes}</p> : null}
                {penalty.lift_reason ? <p className="reservation-inline-hint">Motivo de levantamiento: {penalty.lift_reason}</p> : null}

                {(penalty.is_active || penalty.status === 'scheduled') ? (
                  <div className="reservations-actions">
                    <button
                      type="button"
                      className="reservations-secondary"
                      disabled={!canManage}
                      onClick={() => setPenaltyToLift(penalty)}
                    >
                      Levantar penalizacion
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <SimplePenaltyModal
        isOpen={isModalOpen}
        form={form}
        userOptions={userOptions}
        labOptions={labs}
        selectedUser={selectedUser}
        userReservations={userReservations}
        validationErrors={formErrors}
        validationMessage={formValidationMessage}
        onApplyDuration={handleApplyDuration}
        onChange={handleFormChange}
        onSelectReservation={handleSelectReservation}
        onSubmit={handleCreatePenalty}
        onClose={closeModal}
        isSubmitting={isSubmitting}
      />

      {penaltyToLift ? (
        <ConfirmModal
          title="Levantar penalizacion"
          message={`El usuario ${penaltyToLift.user_name || penaltyToLift.user_id} dejara de estar bloqueado por esta penalizacion y volvera al flujo normal de reservas.`}
          confirmLabel={isLifting ? 'Levantando...' : 'Levantar'}
          onConfirm={isLifting ? undefined : handleConfirmLift}
          onCancel={isLifting ? undefined : () => setPenaltyToLift(null)}
        />
      ) : null}
    </section>
  )
}

export default AdminPenaltiesPage
