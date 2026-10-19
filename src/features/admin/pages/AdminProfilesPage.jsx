import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Copy, KeyRound, Plus, Search, ShieldAlert, ShieldCheck, Unlock, UserRoundCheck, UserX } from 'lucide-react'
import { createUserProfile, deactivateUserProfile, listUserProfiles, resetUserPassword, unlockUserProfile, updateUserProfile } from '../services/profileService'
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
  username: '',
  profile_type: 'student',
  roleId: '',
  is_active: true,
}

const defaultReactivationForm = {
  lift_reason: 'Situacion regularizada y bloqueo levantado por administracion.',
  resolution_notes: '',
}

const defaultCreateForm = { username: '', name: '', password: '', profile_type: 'student', roleId: '' }

const USER_PAGE_SIZE_OPTIONS = [8, 12, 20, 40]

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeProfileRecord(profile) {
  const username = String(profile?.username || '').trim().toLowerCase()
  const email = String(profile?.email || '').trim().toLowerCase()

  return {
    ...profile,
    username: username || email,
    name: String(profile?.name || '').trim(),
    role: String(profile?.role || '').trim(),
  }
}

function dedupeProfiles(records) {
  const seen = new Set()

  return records.filter((profile) => {
    const idKey = String(profile?.id || '').trim()
    const usernameKey = normalizeEmail(profile?.username)
    const dedupeKey = idKey || usernameKey
    if (!dedupeKey || seen.has(dedupeKey)) {
      return false
    }
    seen.add(dedupeKey)
    return true
  })
}

import { formatLocalDateTime } from '../../../shared/utils/formatters'

function getProfileDisplayName(profile) {
  const name = String(profile?.name || '').trim()
  if (name) {
    return name
  }
  return String(profile?.username || 'Sin nombre').trim() || 'Sin nombre'
}

function getProfileDisplayIdentity(profile) {
  const username = String(profile?.username || '').trim()
  return username || 'Sin correo institucional'
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
  if (profile?.security_locked) {
    return { key: 'blocked', label: 'Bloqueado', description: 'Bloqueado automáticamente por tres intentos fallidos.' }
  }
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
    username: profile.username || '',
    profile_type: profile.profile_type || 'student',
    roleId: matchedRole?.id || '',
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
  const [showAllProfiles, setShowAllProfiles] = useState(false)
  const [profilesPerPage, setProfilesPerPage] = useState(12)
  const [visibleCount, setVisibleCount] = useState(12)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [confirmModal, setConfirmModal] = useState(null)
  const [reactivationContext, setReactivationContext] = useState(null)
  const [reactivationForm, setReactivationForm] = useState(defaultReactivationForm)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(defaultCreateForm)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [securityActionPending, setSecurityActionPending] = useState(false)

  const canCreate = hasAnyPermission(user, ['crear_usuarios'])
  const canModify = hasAnyPermission(user, ['modificar_usuarios'])
  const canAssign = hasAnyPermission(user, ['asignar_roles'])
  const canManage = canModify || canAssign
  const canUnlockSecurity = hasAnyPermission(user, ['desbloquear_usuarios'])
  const canManagePenalties = hasAnyPermission(user, ['gestionar_penalizaciones'])
  const canResetPassword = hasAnyPermission(user, ['reiniciar_credenciales'])
  const canDeactivate = hasAnyPermission(user, ['dar_baja_usuarios'])

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

      const rawProfiles = Array.isArray(profileResult.value) ? profileResult.value : []
      const nextProfiles = dedupeProfiles(rawProfiles.map(normalizeProfileRecord))
      const nextRoles = Array.isArray(roleResult.value) ? roleResult.value : []
      const nextFlags = flagResult.status === 'fulfilled' && Array.isArray(flagResult.value) ? flagResult.value : []
      const nextPenalties = penaltyResult.status === 'fulfilled' && Array.isArray(penaltyResult.value?.items) ? penaltyResult.value.items : []

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

  const visibleProfiles = useMemo(
    () => (showAllProfiles ? profiles : profiles.filter((profile) => profile.is_active !== false)),
    [profiles, showAllProfiles],
  )

  const filteredProfiles = useMemo(() => {
    const needle = String(searchTerm || '').trim().toLowerCase()
    const source = [...visibleProfiles].sort((left, right) => getProfileDisplayName(left).localeCompare(getProfileDisplayName(right), 'es', { sensitivity: 'base' }))
    if (!needle) {
      return source
    }

    return source.filter((profile) => {
      const haystack = [
        getProfileDisplayName(profile),
        profile.username,
        profile.user_code,
        profile.role,
        activePenaltyByUserId[profile.id]?.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [activePenaltyByUserId, searchTerm, visibleProfiles])

  useEffect(() => {
    setVisibleCount(profilesPerPage)
  }, [profilesPerPage, searchTerm, showAllProfiles])

  useEffect(() => {
    setVisibleCount((current) => Math.min(current, filteredProfiles.length || profilesPerPage))
  }, [filteredProfiles.length, profilesPerPage])

  const limitedProfiles = useMemo(
    () => filteredProfiles.slice(0, visibleCount),
    [filteredProfiles, visibleCount],
  )

  const hasMoreProfiles = limitedProfiles.length < filteredProfiles.length

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
    if (!userId || !canManagePenalties) {
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
    setTemporaryPassword('')
    resetFeedback()
  }

  const handleEdit = (profile) => {
    resetFeedback()
    setEditingUser(profile)
    setForm(mapProfileForm(profile, roles))
    setReactivationForm(defaultReactivationForm)
    setTemporaryPassword('')
    if (canManagePenalties) {
      loadReactivationContext(profile.id)
    } else {
      setReactivationContext(null)
    }
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

      if (canModify && nextName && nextName !== currentName) {
        payload.name = nextName
      }
      if (canModify && normalizeEmail(form.username) !== normalizeEmail(editingUser.username)) {
        payload.username = normalizeEmail(form.username)
      }
      if (canModify && form.profile_type !== (editingUser.profile_type || 'student')) {
        payload.profile_type = form.profile_type
      }
      if ((canUnlockSecurity || canDeactivate) && form.is_active !== currentIsActive) {
        payload.is_active = form.is_active
      }
      if (Object.keys(payload).length > 0) {
        await updateUserProfile(editingUser.id, payload)
      }

      const currentRoleId = roles.find((role) => role.nombre === editingUser.role)?.id || ''
      if (canAssign && form.roleId && form.roleId !== currentRoleId) {
        await assignUserRole(editingUser.id, form.roleId)
      }

      const data = await loadData()
      if (data) {
        syncSelectedProfile(data.profiles, data.roles, editingUser.id)
      }
      if (canManagePenalties) {
        await loadReactivationContext(editingUser.id, { silent: true })
      }
      setMessage(Object.keys(payload).length > 0 || (form.roleId && form.roleId !== currentRoleId) ? 'Perfil actualizado correctamente.' : 'No habia cambios pendientes para guardar.')
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

  const handleCreate = async (event) => {
    event.preventDefault()
    resetFeedback()
    setSecurityActionPending(true)
    try {
      const created = await createUserProfile({
        username: createForm.username.trim().toLowerCase(),
        name: createForm.name.trim(),
        password: createForm.password,
        profile_type: createForm.profile_type,
        is_active: true,
      })
      if (createForm.roleId) await assignUserRole(created.id, createForm.roleId)
      setCreateForm(defaultCreateForm)
      setShowCreate(false)
      setMessage(`Usuario creado con código ${created.user_code || 'institucional'}.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo crear el usuario.')
    } finally {
      setSecurityActionPending(false)
    }
  }

  const handleResetPassword = async () => {
    if (!editingUser) return
    resetFeedback()
    setSecurityActionPending(true)
    try {
      const result = await resetUserPassword(editingUser.id)
      setTemporaryPassword(result.temporary_password)
      setMessage('Contraseña temporal generada. Se mostrará únicamente en esta pantalla.')
      const data = await loadData()
      if (data) syncSelectedProfile(data.profiles, data.roles, editingUser.id)
    } catch (err) {
      setError(err.message || 'No se pudo reiniciar la contraseña.')
    } finally {
      setSecurityActionPending(false)
    }
  }

  const handleUnlock = async () => {
    if (!editingUser) return
    resetFeedback()
    setSecurityActionPending(true)
    try {
      await unlockUserProfile(editingUser.id)
      setMessage('Cuenta desbloqueada y contador de intentos reiniciado.')
      const data = await loadData()
      if (data) syncSelectedProfile(data.profiles, data.roles, editingUser.id)
    } catch (err) {
      setError(err.message || 'No se pudo desbloquear la cuenta.')
    } finally {
      setSecurityActionPending(false)
    }
  }

  const handleDeactivate = () => {
    if (!editingUser) return
    setConfirmModal({
      title: 'Dar de baja usuario',
      message: `Se desactivará ${editingUser.username} y se cerrarán sus sesiones. El historial no se elimina.`,
      onConfirm: async () => {
        setConfirmModal(null)
        setSecurityActionPending(true)
        try {
          await deactivateUserProfile(editingUser.id)
          setMessage('Usuario dado de baja correctamente.')
          cancelEdit()
          await loadData()
        } catch (err) {
          setError(err.message || 'No se pudo dar de baja el usuario.')
        } finally {
          setSecurityActionPending(false)
        }
      },
    })
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
        {canCreate ? <button type="button" className="profiles-primary" onClick={() => setShowCreate((value) => !value)}><Plus size={16} /> {showCreate ? 'Cancelar alta' : 'Alta de usuario'}</button> : null}
      </header>

      {message ? <p className="profiles-alert success">{message}</p> : null}
      {error ? <p className="profiles-alert error">{error}</p> : null}

      {showCreate ? (
        <section className="profiles-card profiles-form" aria-label="Alta de usuario">
          <div className="profiles-section-head"><div><h3>Alta de usuario local</h3><p>El User ID se genera automáticamente con el formato UCB-AÑO-CÓDIGO.</p></div></div>
          <form onSubmit={handleCreate}>
            <div className="profiles-form-grid">
              <label><span>Correo institucional</span><input type="email" value={createForm.username} onChange={(event) => setCreateForm((value) => ({ ...value, username: event.target.value }))} placeholder="usuario@ucb.edu.bo" required /></label>
              <label><span>Nombre completo</span><input value={createForm.name} onChange={(event) => setCreateForm((value) => ({ ...value, name: event.target.value }))} required /></label>
              <label><span>Contraseña inicial</span><input type="password" autoComplete="new-password" minLength="12" value={createForm.password} onChange={(event) => setCreateForm((value) => ({ ...value, password: event.target.value }))} required /></label>
              <label><span>Tipo de perfil</span><select value={createForm.profile_type} onChange={(event) => setCreateForm((value) => ({ ...value, profile_type: event.target.value }))}><option value="student">Estudiante</option><option value="teacher">Docente</option><option value="staff">Personal</option><option value="guest">Invitado</option><option value="lab_manager">Encargado</option></select></label>
              {canAssign ? <label><span>Rol inicial</span><select value={createForm.roleId} onChange={(event) => setCreateForm((value) => ({ ...value, roleId: event.target.value }))}><option value="">Sin rol</option>{roles.filter((role) => !['Administrador', 'Administrador de Accesos', 'OSI - Auditor de Seguridad'].includes(role.nombre)).map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}</select></label> : null}
            </div>
            <p className="profiles-inline-hint">Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo. Resguárdala únicamente en el gestor institucional de contraseñas.</p>
            <div className="profiles-actions"><button type="submit" className="profiles-primary" disabled={securityActionPending}>{securityActionPending ? 'Creando...' : 'Crear usuario'}</button></div>
          </form>
        </section>
      ) : null}

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
            <div className="profiles-directory-controls">
              <button
                type="button"
                className="profiles-secondary"
                onClick={() => setShowAllProfiles((value) => !value)}
              >
                {showAllProfiles ? 'Mostrar solo activos' : 'Mostrar todos'}
              </button>
              <label className="profiles-select-control">
                <span>Mostrar</span>
                <select
                  value={profilesPerPage}
                  onChange={(event) => setProfilesPerPage(Number(event.target.value) || 12)}
                >
                  {USER_PAGE_SIZE_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <span className="profiles-inline-hint">
                Mostrando {limitedProfiles.length} de {filteredProfiles.length} usuarios filtrados.
              </span>
            </div>
          </div>

          {loading ? (
            <p className="profiles-empty">Cargando perfiles...</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="profiles-empty">No encontramos usuarios con ese criterio.</p>
          ) : (
            <div className="profiles-list">
              {limitedProfiles.map((profile) => {
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
                        <strong>{getProfileDisplayName(profile)}</strong>
                        <p>{getProfileDisplayIdentity(profile)}</p>
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
                      {activePenalty && canManagePenalties ? (
                        <button type="button" className="profiles-primary" onClick={() => handleEdit(profile)}>
                          Reactivar cuenta
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
              {hasMoreProfiles ? (
                <button
                  type="button"
                  className="profiles-secondary profiles-load-more"
                  onClick={() => setVisibleCount((current) => Math.min(current + profilesPerPage, filteredProfiles.length))}
                >
                  Ver mas usuarios
                </button>
              ) : null}
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
                  <p>User ID: <strong>{editingUser.user_code || 'Pendiente de normalización'}</strong></p>
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
                        disabled={!canModify}
                      />
                    </label>

                    <label><span>Correo institucional</span><input type="email" value={form.username} onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))} disabled={!canModify} required /></label>

                    <label><span>Tipo de perfil</span><select value={form.profile_type} onChange={(event) => setForm((previous) => ({ ...previous, profile_type: event.target.value }))} disabled={!canModify}><option value="student">Estudiante</option><option value="teacher">Docente</option><option value="staff">Personal</option><option value="guest">Invitado</option><option value="lab_manager">Encargado</option></select></label>

                    <label>
                      <span>Rol</span>
                      <select
                        value={form.roleId}
                        onChange={(event) => setForm((previous) => ({ ...previous, roleId: event.target.value }))}
                        disabled={!canAssign}
                      >
                        <option value="">Sin rol asignado</option>
                        {roles.filter((role) => !['Administrador', 'Administrador de Accesos', 'OSI - Auditor de Seguridad'].includes(role.nombre) || role.nombre === editingUser.role).map((role) => (
                          <option key={role.id} value={role.id}>{role.nombre}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="profiles-form-section">
                  <span className="profiles-form-section-label">Seguridad y acceso</span>
                  <div className="profiles-form-grid">
                    <label className="profiles-checkbox">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(event) => setForm((previous) => ({ ...previous, is_active: event.target.checked }))}
                        disabled={!canUnlockSecurity && !canDeactivate}
                      />
                      <span>Cuenta activa</span>
                    </label>
                  </div>
                </div>

                <div className="profiles-actions">
                  <button type="submit" className="profiles-secondary" disabled={!canManage && !canUnlockSecurity && !canDeactivate}>
                    Guardar cambios
                  </button>
                  <button type="button" className="profiles-ghost" onClick={cancelEdit}>
                    Cerrar expediente
                  </button>
                </div>
              </form>

              {(canResetPassword || canDeactivate || canUnlockSecurity) ? (
                <section className="profiles-reactivation-card">
                  <div className="profiles-section-head"><div><h4>Credenciales y bloqueo</h4><p>Acciones independientes, auditadas y limitadas por permisos RBAC.</p></div></div>
                  <div className="profiles-validation-grid">
                    <article className={`profiles-validation-card ${editingUser.security_locked ? 'blocked' : 'success'}`}><span>Bloqueo de seguridad</span><strong>{editingUser.security_locked ? 'Bloqueado' : 'Sin bloqueo'}</strong><p>{editingUser.failed_login_attempts || 0} de 3 intentos fallidos.</p></article>
                    <article className="profiles-validation-card"><span>Contraseña</span><strong>{editingUser.auth_provider === 'google' ? 'Google SSO' : editingUser.must_change_password ? 'Cambio obligatorio' : 'Vigente'}</strong><p>Vence: {formatDateTime(editingUser.password_expires_at)}</p></article>
                  </div>
                  <div className="profiles-actions">
                    {canResetPassword && editingUser.auth_provider !== 'google' ? <button type="button" className="profiles-secondary" onClick={handleResetPassword} disabled={securityActionPending}><KeyRound size={16} /> Reiniciar contraseña</button> : null}
                    {canUnlockSecurity && editingUser.security_locked ? <button type="button" className="profiles-secondary" onClick={handleUnlock} disabled={securityActionPending}><Unlock size={16} /> Desbloquear acceso</button> : null}
                    {canDeactivate && editingUser.is_active !== false ? <button type="button" className="profiles-danger" onClick={handleDeactivate} disabled={securityActionPending}><UserX size={16} /> Dar de baja</button> : null}
                  </div>
                  {temporaryPassword ? <div className="profiles-inline-banner warning"><KeyRound size={16} /><div><strong>Contraseña temporal — copia única</strong><p><code>{temporaryPassword}</code></p><button type="button" className="profiles-secondary" onClick={() => navigator.clipboard.writeText(temporaryPassword)}><Copy size={15} /> Copiar</button><p>Guárdala en el gestor institucional y cierra esta vista. El usuario deberá cambiarla.</p></div></div> : null}
                </section>
              ) : null}

              {canManagePenalties ? (
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
                                {formatLocalDateTime(reactivationContext.active_penalty.starts_at)}
                                {' - '}
                                {formatLocalDateTime(reactivationContext.active_penalty.ends_at)}
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
