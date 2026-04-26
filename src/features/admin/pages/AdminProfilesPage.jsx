import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Search, ShieldAlert, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { deleteUserProfile, listUserProfiles, updateUserProfile } from '../services/profileService'
import { listAssetResponsibilityFlags } from '../services/infrastructureService'
import { assignUserRole, listRoles } from '../services/rolesService'
import {
  getPenaltyReactivationContext,
  listPenalties,
  reactivateUserAccount,
} from '../../reservations/services/reservationsService'
import { hasAnyPermission } from '../../../shared/lib/permissions'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import './AdminProfilesPage.css'

const defaultForm = {
  name: '',
  roleId: '',
  password: '',
  is_active: true,
}

const defaultReactivationForm = {
  lift_reason: 'Situacion regularizada y bloqueo levantado por administracion.',
  resolution_notes: '',
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function formatDateTime(value) {
  if (!value) {
    return 'Sin registro'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getProfileState(profile, penalty) {
  if (penalty?.is_active) {
    return {
      key: 'blocked',
      label: 'Bloqueado',
      description: 'Tiene una penalizacion activa y no puede solicitar reservas.',
    }
  }

  if (profile?.is_active === false) {
    return {
      key: 'inactive',
      label: 'Inactivo',
      description: 'La cuenta esta deshabilitada y requiere reactivacion manual.',
    }
  }

  return {
    key: 'active',
    label: 'Activo',
    description: 'La cuenta puede operar normalmente dentro de sus permisos.',
  }
}

function mapProfileForm(profile, roles) {
  const matchedRole = roles.find((role) => role.nombre === profile.role)
  return {
    name: profile.name || '',
    roleId: matchedRole?.id || '',
    password: '',
    is_active: profile.is_active !== false,
  }
}

function AdminProfilesPage({ user }) {
  const [profiles, setProfiles] = useState([])
  const [responsibilityFlags, setResponsibilityFlags] = useState([])
  const [roles, setRoles] = useState([])
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmModal, setConfirmModal] = useState(null)
  const [reactivationContext, setReactivationContext] = useState(null)
  const [reactivationForm, setReactivationForm] = useState(defaultReactivationForm)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)

  const canManage = hasAnyPermission(user, ['gestionar_roles_permisos'])
  const canReactivate = hasAnyPermission(user, ['reactivar_cuentas', 'gestionar_penalizaciones'])

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [profileResult, roleResult, flagResult, penaltyResult] = await Promise.allSettled([
        listUserProfiles(),
        listRoles(),
        listAssetResponsibilityFlags(),
        listPenalties({ active_only: true }),
      ])

      if (profileResult.status !== 'fulfilled' || roleResult.status !== 'fulfilled') {
        throw new Error('No se pudieron cargar los perfiles')
      }

      const nextProfiles = Array.isArray(profileResult.value) ? profileResult.value : []
      const nextRoles = Array.isArray(roleResult.value) ? roleResult.value : []
      const nextFlags = flagResult.status === 'fulfilled' && Array.isArray(flagResult.value) ? flagResult.value : []
      const nextPenalties = penaltyResult.status === 'fulfilled' && Array.isArray(penaltyResult.value) ? penaltyResult.value : []

      setProfiles(nextProfiles)
      setRoles(nextRoles)
      setResponsibilityFlags(nextFlags)
      setPenalties(nextPenalties)
      setError('')

      return {
        profiles: nextProfiles,
        roles: nextRoles,
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los perfiles')
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const flagsByEmail = useMemo(
    () => Object.fromEntries(responsibilityFlags.map((flag) => [normalizeEmail(flag.borrower_email), flag])),
    [responsibilityFlags],
  )

  const activePenaltyByUserId = useMemo(() => {
    const mapped = {}
    penalties.forEach((penalty) => {
      if (!penalty?.user_id || mapped[penalty.user_id]) {
        return
      }
      mapped[penalty.user_id] = penalty
    })
    return mapped
  }, [penalties])

  const filteredProfiles = useMemo(() => {
    const needle = String(searchTerm || '').trim().toLowerCase()
    const source = [...profiles].sort((left, right) => String(left.name || left.username).localeCompare(String(right.name || right.username)))
    if (!needle) {
      return source
    }

    return source.filter((profile) => {
      const haystack = [
        profile.name,
        profile.username,
        profile.role,
        activePenaltyByUserId[profile.id]?.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [activePenaltyByUserId, profiles, searchTerm])

  const summary = useMemo(() => {
    const blockedUsers = new Set(penalties.filter((penalty) => penalty.is_active).map((penalty) => penalty.user_id))
    const byRole = {}

    profiles.forEach((profile) => {
      const roleName = profile.role || 'Sin rol'
      byRole[roleName] = (byRole[roleName] || 0) + 1
    })

    return {
      total: profiles.length,
      active: profiles.filter((profile) => profile.is_active !== false).length,
      inactive: profiles.filter((profile) => profile.is_active === false).length,
      blocked: blockedUsers.size,
      flagged: responsibilityFlags.filter((flag) => Number(flag.active_damage_count || 0) > 0).length,
      byRole,
    }
  }, [penalties, profiles, responsibilityFlags])

  const selectedPenalty = editingUser ? activePenaltyByUserId[editingUser.id] || null : null
  const selectedProfileState = editingUser ? getProfileState(editingUser, selectedPenalty) : null

  const loadReactivationContext = async (userId, { silent = false } = {}) => {
    if (!userId || !canReactivate) {
      setReactivationContext(null)
      return
    }

    if (!silent) {
      setIsLoadingContext(true)
    }

    try {
      const context = await getPenaltyReactivationContext(userId)
      setReactivationContext(context)
    } catch (err) {
      setReactivationContext(null)
      setError(err.message || 'No se pudo cargar el contexto de reactivacion.')
    } finally {
      if (!silent) {
        setIsLoadingContext(false)
      }
    }
  }

  const syncSelectedProfile = (nextProfiles, nextRoles, userId) => {
    const refreshedProfile = nextProfiles.find((profile) => profile.id === userId) || null
    if (!refreshedProfile) {
      setEditingUser(null)
      setForm(defaultForm)
      return
    }

    setEditingUser(refreshedProfile)
    setForm(mapProfileForm(refreshedProfile, nextRoles))
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setForm(defaultForm)
    setReactivationContext(null)
    setReactivationForm(defaultReactivationForm)
    resetFeedback()
  }

  const handleEdit = (profile) => {
    resetFeedback()
    setEditingUser(profile)
    setForm(mapProfileForm(profile, roles))
    setReactivationForm(defaultReactivationForm)
    if (canReactivate) {
      loadReactivationContext(profile.id)
    } else {
      setReactivationContext(null)
    }
  }

  const handleDelete = (profile) => {
    setConfirmModal({
      title: 'Eliminar cuenta',
      message: `Se eliminara la cuenta de ${profile.name || profile.username}. Esta accion no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmModal(null)
        resetFeedback()
        try {
          await deleteUserProfile(profile.id)
          setMessage('Usuario eliminado correctamente.')
          if (editingUser?.id === profile.id) {
            cancelEdit()
          }
          await loadData()
        } catch (err) {
          setError(err.message || 'No se pudo eliminar el usuario')
        }
      },
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!editingUser) {
      return
    }

    resetFeedback()

    try {
      const payload = {}
      const currentName = String(editingUser.name || '').trim()
      const nextName = String(form.name || '').trim()
      const currentIsActive = editingUser.is_active !== false

      if (canManage && nextName && nextName !== currentName) {
        payload.name = nextName
      }
      if (canReactivate && form.is_active !== currentIsActive) {
        payload.is_active = form.is_active
      }
      if (canManage && form.password.trim()) {
        payload.password = form.password.trim()
      }

      if (Object.keys(payload).length > 0) {
        await updateUserProfile(editingUser.id, payload)
      }

      if (canManage && form.roleId) {
        await assignUserRole(editingUser.id, form.roleId)
      }

      const data = await loadData()
      if (data) {
        syncSelectedProfile(data.profiles, data.roles, editingUser.id)
      }
      if (canReactivate) {
        await loadReactivationContext(editingUser.id, { silent: true })
      }
      setMessage(Object.keys(payload).length > 0 || form.roleId ? 'Perfil actualizado correctamente.' : 'No habia cambios pendientes para guardar.')
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil')
    }
  }

  const handleReactivate = async () => {
    const activePenalty = reactivationContext?.active_penalty
    if (!editingUser || !activePenalty) {
      return
    }

    resetFeedback()
    setIsReactivating(true)

    try {
      const result = await reactivateUserAccount(activePenalty.id, {
        ...reactivationForm,
        action_source: 'admin_profile',
      })
      const data = await loadData()
      if (data) {
        syncSelectedProfile(data.profiles, data.roles, editingUser.id)
      }
      await loadReactivationContext(editingUser.id, { silent: true })
      setMessage(
        result.privileges_restored
          ? 'Cuenta reactivada correctamente. El bloqueo activo desaparecio y el usuario ya puede volver a reservar.'
          : 'La penalizacion fue levantada, pero el usuario aun conserva restricciones adicionales.',
      )
      setReactivationForm(defaultReactivationForm)
    } catch (err) {
      setError(err.message || 'No se pudo reactivar la cuenta del usuario.')
    } finally {
      setIsReactivating(false)
    }
  }

  return (
    <section className="profiles-page" aria-label="Gestion de perfiles y reactivacion de cuentas">
      {confirmModal ? (
        <ConfirmModal
          title={confirmModal.title || 'Eliminar usuario'}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}

      <header className="profiles-header">
        <div className="profiles-header-copy">
          <p className="profiles-kicker">Gestion de usuarios</p>
          <h2>Cuentas de usuarios</h2>
          <p>
            Revisa datos, bloqueos y reactivaciones con una vista clara del estado de cada persona.
          </p>
        </div>

        <div className="profiles-summary">
          <div><span>Total</span><strong>{summary.total}</strong></div>
          <div><span>Activos</span><strong>{summary.active}</strong></div>
          <div><span>Bloqueados</span><strong>{summary.blocked}</strong></div>
          <div><span>Danos abiertos</span><strong>{summary.flagged}</strong></div>
        </div>
      </header>

      {message ? <p className="profiles-alert success">{message}</p> : null}
      {error ? <p className="profiles-alert error">{error}</p> : null}

      <div className="profiles-grid">
        <section className="profiles-card profiles-directory-card">
          <div className="profiles-card-head">
            <div>
              <h3>Directorio institucional</h3>
              <p>Busca un usuario y entra a su expediente operativo.</p>
            </div>
            <label className="profiles-search">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nombre, correo, rol o motivo"
              />
            </label>
          </div>

          {loading ? (
            <p className="profiles-empty">Cargando perfiles...</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="profiles-empty">No encontramos usuarios con ese criterio.</p>
          ) : (
            <div className="profiles-list">
              {filteredProfiles.map((profile) => {
                const activePenalty = activePenaltyByUserId[profile.id] || null
                const flag = flagsByEmail[normalizeEmail(profile.username)] || null
                const state = getProfileState(profile, activePenalty)
                return (
                  <article
                    key={profile.id}
                    className={`profiles-item${editingUser?.id === profile.id ? ' editing' : ''} ${state.key}`}
                  >
                    <div className="profiles-item-head">
                      <div>
                        <strong>{profile.name || profile.username}</strong>
                        <p>{profile.username}</p>
                      </div>
                      <span className={`profiles-badge ${state.key}`}>{state.label}</span>
                    </div>

                    <div className="profiles-meta">
                      <span>{profile.role || 'Sin rol'}</span>
                      {profile.is_active === false ? <span>Acceso deshabilitado</span> : <span>Sesion habilitada</span>}
                    </div>

                    {activePenalty ? (
                      <div className="profiles-inline-banner warning">
                        <ShieldAlert size={16} />
                        <div>
                          <strong>Bloqueo activo</strong>
                          <p>{activePenalty.reason}</p>
                        </div>
                      </div>
                    ) : null}

                    {flag && Number(flag.active_damage_count || 0) > 0 ? (
                      <div className="profiles-inline-banner danger">
                        <AlertTriangle size={16} />
                        <div>
                          <strong>Incidentes pendientes</strong>
                          <p>{flag.active_damage_count} dano(s) abierto(s) en historial de activos.</p>
                        </div>
                      </div>
                    ) : null}

                    <div className="profiles-actions compact">
                      <button type="button" className="profiles-secondary" onClick={() => handleEdit(profile)}>
                        Ver expediente
                      </button>
                      {activePenalty && canReactivate ? (
                        <button type="button" className="profiles-primary" onClick={() => handleEdit(profile)}>
                          Reactivar cuenta
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="profiles-danger"
                        onClick={() => handleDelete(profile)}
                        disabled={!canManage}
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="profiles-card profiles-detail-card">
          {editingUser ? (
            <div className="profiles-detail-shell">
              <div className="profiles-detail-hero">
                <div>
                  <p className="profiles-kicker">Expediente del usuario</p>
                  <h3>{editingUser.name || editingUser.username}</h3>
                  <p>{editingUser.username}</p>
                </div>
                <span className={`profiles-badge ${selectedProfileState?.key || 'active'}`}>
                  {selectedProfileState?.label || 'Activo'}
                </span>
              </div>

              <div className="profiles-spotlight-grid">
                <article className={`profiles-spotlight-card ${selectedProfileState?.key || 'active'}`}>
                  <div className="profiles-spotlight-icon">
                    {selectedProfileState?.key === 'blocked' ? <ShieldAlert size={18} /> : null}
                    {selectedProfileState?.key === 'inactive' ? <Clock3 size={18} /> : null}
                    {selectedProfileState?.key === 'active' ? <ShieldCheck size={18} /> : null}
                  </div>
                  <div>
                    <span>Estado actual</span>
                    <strong>{selectedProfileState?.label}</strong>
                    <p>{selectedProfileState?.description}</p>
                  </div>
                </article>

                <article className="profiles-spotlight-card">
                  <div className="profiles-spotlight-icon">
                    <UserRoundCheck size={18} />
                  </div>
                  <div>
                    <span>Rol</span>
                    <strong>{editingUser.role || 'Sin rol'}</strong>
                    <p>La cuenta mantiene sus permisos institucionales segun el rol asignado.</p>
                  </div>
                </article>

                <article className={`profiles-spotlight-card ${selectedPenalty ? 'blocked' : 'active'}`}>
                  <div className="profiles-spotlight-icon">
                    {selectedPenalty ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                  </div>
                  <div>
                    <span>Bloqueo operativo</span>
                    <strong>{selectedPenalty ? 'Penalizacion activa' : 'Sin bloqueo activo'}</strong>
                    <p>{selectedPenalty ? selectedPenalty.reason : 'El usuario puede reservar si su cuenta continua activa.'}</p>
                  </div>
                </article>
              </div>

              <form className="profiles-form" onSubmit={handleSubmit}>
                <div className="profiles-form-section">
                  <span className="profiles-form-section-label">Datos del usuario</span>
                  <div className="profiles-form-grid">
                    <label>
                      <span>Nombre completo</span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                        required
                        disabled={!canManage}
                      />
                    </label>

                    <label>
                      <span>Rol</span>
                      <select
                        value={form.roleId}
                        onChange={(event) => setForm((previous) => ({ ...previous, roleId: event.target.value }))}
                        disabled={!canManage}
                      >
                        <option value="">Sin rol asignado</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>{role.nombre}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="profiles-form-section">
                  <span className="profiles-form-section-label">Seguridad y acceso</span>
                  <div className="profiles-form-grid">
                    <label>
                      <span>Nueva contrasena</span>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                        placeholder="Solo si deseas cambiarla"
                        disabled={!canManage}
                      />
                    </label>

                    <label className="profiles-checkbox">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(event) => setForm((previous) => ({ ...previous, is_active: event.target.checked }))}
                        disabled={!canReactivate}
                      />
                      <span>Cuenta activa</span>
                    </label>
                  </div>
                </div>

                <div className="profiles-actions">
                  <button type="submit" className="profiles-secondary" disabled={!canManage && !canReactivate}>
                    Guardar cambios
                  </button>
                  <button type="button" className="profiles-ghost" onClick={cancelEdit}>
                    Cerrar expediente
                  </button>
                </div>
              </form>

              {canReactivate ? (
                <section className="profiles-reactivation-card">
                  <div className="profiles-section-head">
                    <div>
                      <h4>Reactivacion de cuenta</h4>
                      <p>Valida el estado del bloqueo, confirma la regularizacion y deja un registro trazable de la decision.</p>
                    </div>
                    {reactivationContext?.regularization?.is_regularized ? (
                      <span className="profiles-status-pill success">Regularizado</span>
                    ) : (
                      <span className="profiles-status-pill warning">Con observaciones</span>
                    )}
                  </div>

                  {isLoadingContext ? (
                    <p className="profiles-empty">Cargando contexto de reactivacion...</p>
                  ) : reactivationContext ? (
                    <>
                      <div className="profiles-validation-grid">
                        <article className={`profiles-validation-card ${reactivationContext.block_status}`}>
                          <span>Estado de bloqueo</span>
                          <strong>
                            {reactivationContext.block_status === 'blocked'
                              ? 'Bloqueado'
                              : reactivationContext.block_status === 'inactive'
                                ? 'Inactivo'
                                : 'Activo'}
                          </strong>
                          <p>
                            {reactivationContext.active_penalty
                              ? 'Existe una penalizacion activa asociada a este usuario.'
                              : 'No se detecta un bloqueo activo pendiente.'}
                          </p>
                        </article>

                        <article className={`profiles-validation-card ${reactivationContext.regularization.is_regularized ? 'success' : 'warning'}`}>
                          <span>Regularizacion</span>
                          <strong>
                            {reactivationContext.regularization.is_regularized
                              ? 'Situacion regularizada'
                              : `${reactivationContext.regularization.active_damage_count} incidente(s) abierto(s)`}
                          </strong>
                          <p>{reactivationContext.regularization.summary}</p>
                        </article>
                      </div>

                      {reactivationContext.active_penalty ? (
                        <>
                          <div className="profiles-penalty-panel">
                            <div>
                              <span className="profiles-panel-label">Motivo del bloqueo</span>
                              <strong>{reactivationContext.active_penalty.reason}</strong>
                            </div>
                            <div>
                              <span className="profiles-panel-label">Vigencia</span>
                              <strong>
                                {formatDateTime(reactivationContext.active_penalty.starts_at)}
                                {' - '}
                                {formatDateTime(reactivationContext.active_penalty.ends_at)}
                              </strong>
                            </div>
                            <div>
                              <span className="profiles-panel-label">Usuario podra reservar</span>
                              <strong>{reactivationContext.privileges_restored_if_confirmed ? 'Si, al confirmar' : 'No todavia'}</strong>
                            </div>
                          </div>

                          {!reactivationContext.regularization.is_regularized ? (
                            <div className="profiles-inline-banner danger">
                              <AlertTriangle size={16} />
                              <div>
                                <strong>Reactivacion bloqueada</strong>
                                <p>
                                  Cierra o regulariza primero el ticket {reactivationContext.regularization.latest_ticket_id || 'pendiente'}
                                  {' '}relacionado con {reactivationContext.regularization.latest_asset_name || 'el activo afectado'}.
                                </p>
                              </div>
                            </div>
                          ) : null}

                          <div className="profiles-form-section reactivation">
                            <span className="profiles-form-section-label">Decision administrativa</span>
                            <div className="profiles-form-grid">
                              <label>
                                <span>Motivo de levantamiento</span>
                                <input
                                  value={reactivationForm.lift_reason}
                                  onChange={(event) => setReactivationForm((previous) => ({ ...previous, lift_reason: event.target.value }))}
                                  placeholder="Ej. Equipo restituido, dano cerrado, situacion regularizada"
                                />
                              </label>

                              <label>
                                <span>Registro para historial</span>
                                <textarea
                                  rows="4"
                                  value={reactivationForm.resolution_notes}
                                  onChange={(event) => setReactivationForm((previous) => ({ ...previous, resolution_notes: event.target.value }))}
                                  placeholder="Describe brevemente que se verifico y por que corresponde reactivar la cuenta."
                                />
                              </label>
                            </div>

                            <div className="profiles-actions">
                              <button
                                type="button"
                                className="profiles-primary"
                                disabled={!reactivationContext.can_reactivate || isReactivating}
                                onClick={handleReactivate}
                              >
                                {isReactivating ? 'Reactivando...' : 'Reactivar cuenta'}
                              </button>
                              <span className="profiles-inline-hint">
                                Esta accion levantara la penalizacion activa, notificara al usuario y guardara el evento en su historial.
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="profiles-inline-banner success">
                          <CheckCircle2 size={16} />
                          <div>
                            <strong>Sin bloqueo activo</strong>
                            <p>La cuenta ya no presenta una penalizacion vigente. El historial queda disponible mas abajo.</p>
                          </div>
                        </div>
                      )}

                      <div className="profiles-history-shell">
                        <div className="profiles-section-head">
                          <div>
                            <h4>Historial de reactivaciones</h4>
                            <p>Cada levantamiento queda registrado con actor, validacion y resultado operativo.</p>
                          </div>
                        </div>

                        {reactivationContext.history.length === 0 ? (
                          <p className="profiles-empty">Aun no hay reactivaciones registradas para este usuario.</p>
                        ) : (
                          <div className="profiles-history-list">
                            {reactivationContext.history.map((entry) => (
                              <article key={entry.id || `${entry.penalty_id}-${entry.executed_at}`} className="profiles-history-item">
                                <div className="profiles-history-head">
                                  <div>
                                    <strong>{formatDateTime(entry.executed_at)}</strong>
                                    <span>{entry.actor_name || 'Administrador'}</span>
                                  </div>
                                  <span className={`profiles-status-pill ${entry.privileges_restored ? 'success' : 'warning'}`}>
                                    {entry.privileges_restored ? 'Privilegios restaurados' : 'Con restricciones'}
                                  </span>
                                </div>
                                <p>{entry.regularization_summary || 'Sin resumen de validacion registrado.'}</p>
                                {entry.lift_reason ? <p><strong>Motivo:</strong> {entry.lift_reason}</p> : null}
                                {entry.resolution_notes ? <p><strong>Historial:</strong> {entry.resolution_notes}</p> : null}
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="profiles-empty">No se pudo cargar el contexto de reactivacion de este usuario.</p>
                  )}
                </section>
              ) : null}
            </div>
          ) : (
            <div className="profiles-detail-empty">
              <p className="profiles-kicker">Expediente del usuario</p>
              <h3>Selecciona un perfil</h3>
              <p>Desde aqui podras revisar su estado, editar datos basicos y, si corresponde, reactivar la cuenta con evidencia y trazabilidad.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default AdminProfilesPage
