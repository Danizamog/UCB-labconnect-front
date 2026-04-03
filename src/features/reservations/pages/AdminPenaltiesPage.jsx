import { useEffect, useMemo, useState } from 'react'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import { listAssets } from '../../admin/services/infrastructureService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import PenaltyModal from './PenaltyModal'
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

function createDefaultForm() {
  const now = new Date()
  const later = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  return {
    user_selection: '',
    user_id: '',
    user_name: '',
    user_email: '',
    evidence_type: 'damage_report',
    evidence_report_id: '',
    asset_id: '',
    starts_at: toLocalDateTimeValue(now),
    ends_at: toLocalDateTimeValue(later),
    reason: '',
    notes: '',
  }
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(createDefaultForm)
  const [penaltyToLift, setPenaltyToLift] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLifting, setIsLifting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = hasAnyPermission(user, ['gestionar_penalizaciones'])

  const loadData = async () => {
    const [penaltiesResult, reservationsResult, assetsResult] = await Promise.allSettled([
      listPenalties(),
      listReservations(),
      listAssets(),
    ])

    if (penaltiesResult.status === 'fulfilled') {
      setPenalties(penaltiesResult.value)
    } else {
      setPenalties([])
    }

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

    if (penaltiesResult.status === 'rejected') {
      throw penaltiesResult.reason
    }
  }

  useEffect(() => {
    loadData().catch((err) => {
      setError(err?.message || 'No se pudo cargar el panel de penalizaciones.')
    })

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'user_penalty' || event?.topic === 'lab_reservation') {
        loadData().catch(() => {})
      }
    })

    return () => unsubscribe?.()
  }, [])

  const userOptions = useMemo(() => {
    const seen = new Set()
    return reservations
      .filter((reservation) => reservation.requested_by)
      .map((reservation) => {
        const userId = String(reservation.requested_by)
        if (seen.has(userId)) {
          return null
        }
        seen.add(userId)
        return {
          value: userId,
          user_id: userId,
          user_name: reservation.requested_by_name || '',
          user_email: reservation.requested_by_email || '',
          label: `${reservation.requested_by_name || userId} · ${reservation.requested_by_email || 'sin correo'}`,
        }
      })
      .filter(Boolean)
  }, [reservations])

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
      const selectedUser = userOptions.find((option) => option.value === value)
      setForm((previous) => ({
        ...previous,
        user_selection: value,
        user_id: selectedUser?.user_id || previous.user_id,
        user_name: selectedUser?.user_name || previous.user_name,
        user_email: selectedUser?.user_email || previous.user_email,
      }))
      return
    }

    setForm((previous) => ({ ...previous, [field]: value }))
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
      const created = await createPenalty(form)
      setMessage(
        created.email_sent
          ? 'Penalizacion registrada y correo enviado al usuario afectado.'
          : 'Penalizacion registrada. Revisa la configuracion SMTP si el correo no se envio.',
      )
      closeModal()
      await loadData()
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
      setMessage('La penalizacion fue levantada y el usuario recupero sus privilegios de reserva.')
      setPenaltyToLift(null)
      await loadData()
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
                  <span><strong>Equipo:</strong> {penalty.asset_id || 'No especificado'}</span>
                  <span><strong>Vigencia:</strong> {penalty.starts_at} hasta {penalty.ends_at}</span>
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

      <PenaltyModal
        isOpen={isModalOpen}
        form={form}
        userOptions={userOptions}
        assetOptions={assets}
        onChange={handleFormChange}
        onSubmit={handleCreatePenalty}
        onClose={closeModal}
        isSubmitting={isSubmitting}
      />

      {penaltyToLift ? (
        <ConfirmModal
          title="Levantar penalizacion"
          message={`El usuario ${penaltyToLift.user_name || penaltyToLift.user_id} recuperara inmediatamente la capacidad de crear nuevas reservas.`}
          confirmLabel={isLifting ? 'Levantando...' : 'Levantar'}
          onConfirm={isLifting ? undefined : handleConfirmLift}
          onCancel={isLifting ? undefined : () => setPenaltyToLift(null)}
        />
      ) : null}
    </section>
  )
}

export default AdminPenaltiesPage
