import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import TutorialSessionDetailModal from '../../tutorials/pages/TutorialSessionDetailModal'
import { getTutorialSessionById } from '../../tutorials/services/tutorialSessionsService'
import { openTutorialSessionFlow } from '../../tutorials/utils/focusTutorialNavigation'
import {
  createReservation,
  deleteReservation,
  getReservationById,
  getLabAvailability,
  isLabAccessibleToUser,
  listAvailableLabs,
  listMyPenalties,
  listReservations,
  subscribeReservationsRealtime,
  updateReservation,
} from '../services/reservationsService'
import ReservationDetailModal from './ReservationDetailModal'
import ReservationEditModal from './ReservationEditModal'
import './ReservationsPages.css'

const MIN_PURPOSE_LENGTH = 5
const CLOCK_REFRESH_MS = 30 * 1000

function todayLocalDateString() {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultForm(overrides = {}) {
  return {
    laboratory_id: '',
    date: todayLocalDateString(),
    start_time: '',
    end_time: '',
    purpose: '',
    ...overrides,
  }
}

function maxReservableDateString() {
  const value = new Date()
  const currentDay = value.getDate()
  const targetMonth = value.getMonth() + 1
  const targetYear = value.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = targetMonth % 12
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const year = targetYear
  const month = String(normalizedMonth + 1).padStart(2, '0')
  const day = String(Math.min(currentDay, lastDayOfTargetMonth)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' }
const FOCUSED_RESERVATION_KEY = 'labconnect.focus_reservation_id'
const OPEN_RESERVATION_EVENT = 'labconnect:open-reservation-details'
const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const HISTORY_STATUSES = new Set(['rejected', 'cancelled', 'completed', 'absent'])

function getTutorialPrimaryAction(session, userId) {
  const normalizedUserId = String(userId || '')
  const isOwnTutorial = session?.tutor_id === normalizedUserId
  const isEnrolled = Array.isArray(session?.enrolled_students)
    ? session.enrolled_students.some((student) => student.student_id === normalizedUserId)
    : false
  const isFull = Number(session?.seats_left || 0) <= 0

  if (isOwnTutorial) {
    return {
      label: 'Ver en Tutorias',
      hint: 'Abriremos la cartelera de tutorias con esta sesion destacada para que la revises con mas detalle.',
    }
  }

  if (isEnrolled) {
    return {
      label: 'Ver mi inscripcion',
      hint: 'Te llevaremos a la cartelera de tutorias para revisar esta sesion destacada.',
    }
  }

  if (isFull) {
    return {
      label: 'Ver en Tutorias',
      hint: 'Esta sesion ya no tiene cupos, pero puedes revisar su detalle completo desde la cartelera de tutorias.',
    }
  }

  return {
    label: 'Inscribirme',
    hint: 'Te llevaremos a la cartelera de tutorias con esta sesion destacada para completar tu inscripcion.',
  }
}

function formatNotificationDateTime(value) {
  if (!value) {
    return ''
  }

  const normalized = String(value).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function buildReservationStart(reservation) {
  return new Date(`${reservation.date}T${reservation.start_time}:00`)
}

function isDateBeforeToday(value) {
  return Boolean(value) && value < todayLocalDateString()
}

function isDateBeyondReservationLimit(value) {
  return Boolean(value) && value > maxReservableDateString()
}

function buildLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return null
  }

  const [year, month, day] = String(dateValue).split('-').map(Number)
  const [hour, minute] = String(timeValue).split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function isPastSlotForDate(slot, dateValue, referenceNow = new Date()) {
  const slotStart = buildLocalDateTime(dateValue, slot?.start_time)
  if (!slotStart) {
    return false
  }
  return slotStart.getTime() <= referenceNow.getTime()
}

function compareReservationsByStart(a, b) {
  return buildReservationStart(a).getTime() - buildReservationStart(b).getTime()
}

function getReservationActionState(reservation) {
  const startsAt = buildReservationStart(reservation)
  if (Number.isNaN(startsAt.getTime())) {
    return {
      hasStarted: true,
      withinTwoHours: false,
      canModify: false,
      canCancel: false,
    }
  }

  const diffMs = startsAt.getTime() - Date.now()
  const hasStarted = diffMs <= 0
  const withinTwoHours = diffMs > 0 && diffMs < TWO_HOURS_MS
  const isMutableStatus = reservation.status === 'pending' || reservation.status === 'approved'
  const modificationLimitReached = Number(reservation.user_modification_count || 0) >= 1

  return {
    hasStarted,
    withinTwoHours,
    modificationLimitReached,
    canModify: isMutableStatus && !hasStarted && !withinTwoHours && !modificationLimitReached,
    canCancel: isMutableStatus && !hasStarted,
  }
}

function getSlotKey(slot) {
  return `${slot.start_time}-${slot.end_time}`
}

function getSlotTone(slot) {
  if (slot.source === 'tutorial_session') {
    return 'tutorial'
  }

  if (slot.state === 'blocked' && slot.status === 'past') {
    return 'past'
  }

  if (slot.state === 'blocked' && slot.status === 'maintenance') {
    return 'maintenance'
  }

  if (slot.state === 'blocked') {
    return 'blocked-other'
  }

  if (slot.state === 'occupied') {
    return 'busy'
  }

  return 'available'
}

function getSlotLabel(slot) {
  if (slot.source === 'tutorial_session') {
    return 'Tutoria'
  }

  if (slot.state === 'blocked' && slot.status === 'past') {
    return 'Hora pasada'
  }

  if (slot.state === 'blocked' && slot.status === 'maintenance') {
    return 'Mantenimiento'
  }

  if (slot.state === 'blocked') {
    return 'Bloqueado'
  }

  if (slot.state === 'occupied') {
    return 'Ocupado'
  }

  return 'Disponible'
}

function isCreatableSlot(slot) {
  return Boolean(slot) && slot.state === 'available'
}

function UserReserveLabPage({ user, notifications = [], onMarkNotificationAsRead, onNavigate }) {
  const [labs, setLabs] = useState([])
  const [reservations, setReservations] = useState([])
  const [penalties, setPenalties] = useState([])
  const [slots, setSlots] = useState([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [form, setForm] = useState(() => createDefaultForm())
  const [editingReservation, setEditingReservation] = useState(null)
  const [editForm, setEditForm] = useState(() => createDefaultForm())
  const [editSlots, setEditSlots] = useState([])
  const [isLoadingEditSlots, setIsLoadingEditSlots] = useState(false)
  const [editSelectedSlotKey, setEditSelectedSlotKey] = useState('')
  const [focusedReservationId, setFocusedReservationId] = useState('')
  const [isReservationDetailOpen, setIsReservationDetailOpen] = useState(false)
  const [focusedReservationDetails, setFocusedReservationDetails] = useState(null)
  const [isLoadingReservationDetails, setIsLoadingReservationDetails] = useState(false)
  const [reservationToCancel, setReservationToCancel] = useState(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const [availabilityRefreshNonce, setAvailabilityRefreshNonce] = useState(0)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [focusedTutorial, setFocusedTutorial] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const todayIso = todayLocalDateString()
  const maxReservationIso = maxReservableDateString()
  const [clockTick, setClockTick] = useState(Date.now())
  const nowReference = useMemo(() => new Date(clockTick), [clockTick])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, CLOCK_REFRESH_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [labsData, reservationsData, penaltiesData] = await Promise.all([
        listAvailableLabs(user),
        listReservations(),
        listMyPenalties(),
      ])
      setLabs(labsData)
      setReservations(reservationsData)
      setPenalties(penaltiesData)
      setForm((prev) => (prev.laboratory_id || labsData.length === 0 ? prev : { ...prev, laboratory_id: labsData[0].id }))
      setError(labsData.length === 0 ? 'No tienes permisos para reservar en los laboratorios disponibles actualmente.' : '')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion para reservar.')
    }
  }, [user])

  useEffect(() => {
    loadData()

    const unsubscribe = subscribeReservationsRealtime((event) => {
      if (event?.topic === 'lab_reservation') {
        loadData()
        setAvailabilityRefreshNonce((value) => value + 1)
        return
      }

      if (event?.topic === 'user_penalty') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserPenalty =
          event?.record?.user_id === (user?.user_id || '') ||
          recipients.includes(user?.user_id || '')

        if (isCurrentUserPenalty) {
          loadData()
          setMessage('Tu estado de penalizacion fue actualizado.')
        }
        return
      }

      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === (user?.user_id || '') ||
          recipients.includes(user?.user_id || '')

        if (isCurrentUserNotification) {
          setMessage('Tienes una nueva notificacion relacionada con tus reservas o tutorias.')
        }
      }
    })

    return () => unsubscribe?.()
  }, [loadData, user?.user_id])

  useEffect(() => {
    const applyFocus = (reservationId) => {
      const normalizedId = String(reservationId || '').trim()
      if (!normalizedId) {
        return
      }
      setFocusedReservationId(normalizedId)
      setIsReservationDetailOpen(true)
      localStorage.removeItem(FOCUSED_RESERVATION_KEY)
    }

    const storedReservationId = localStorage.getItem(FOCUSED_RESERVATION_KEY)
    if (storedReservationId) {
      applyFocus(storedReservationId)
    }

    const handleOpenReservation = (event) => {
      applyFocus(event?.detail?.reservationId)
    }

    window.addEventListener(OPEN_RESERVATION_EVENT, handleOpenReservation)
    return () => {
      window.removeEventListener(OPEN_RESERVATION_EVENT, handleOpenReservation)
    }
  }, [])

  const selectedLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(form.laboratory_id)) || null,
    [form.laboratory_id, labs],
  )

  const selectedLabIsAccessible = useMemo(
    () => (selectedLab ? isLabAccessibleToUser(selectedLab, user) : false),
    [selectedLab, user],
  )

  useEffect(() => {
    let mounted = true

    const loadAvailability = async () => {
      if (!form.laboratory_id || !form.date || !selectedLabIsAccessible) {
        if (mounted) {
          setSlots([])
          setSelectedSlotKey('')
        }
        return
      }

      setIsLoadingSlots(true)
      try {
        const payload = await getLabAvailability(form.laboratory_id, form.date)
        if (!mounted) {
          return
        }

        const nextSlots = Array.isArray(payload?.slots) ? payload.slots : []
        setSlots(nextSlots)

        const currentFormKey = `${form.start_time}-${form.end_time}`
        const matchingAvailableSlot = nextSlots.find(
          (slot) => getSlotKey(slot) === currentFormKey && slot.state === 'available',
        )

        if (matchingAvailableSlot) {
          setSelectedSlotKey(getSlotKey(matchingAvailableSlot))
        } else {
          setSelectedSlotKey('')
          setForm((previous) => ({
            ...previous,
            start_time: '',
            end_time: '',
          }))
        }
      } catch (err) {
        if (mounted) {
          setSlots([])
          setSelectedSlotKey('')
          setError(err.message || 'No se pudo cargar los bloques disponibles del laboratorio.')
        }
      } finally {
        if (mounted) {
          setIsLoadingSlots(false)
        }
      }
    }

    loadAvailability()
    return () => {
      mounted = false
    }
  }, [availabilityRefreshNonce, form.date, form.end_time, form.laboratory_id, form.start_time, selectedLabIsAccessible])

  const labNameById = useMemo(
    () => Object.fromEntries(labs.map((lab) => [String(lab.id), lab.name])),
    [labs],
  )

  const selectedSlot = useMemo(
    () => slots.find((slot) => getSlotKey(slot) === selectedSlotKey) || null,
    [selectedSlotKey, slots],
  )

  const selectedSlotIsValid = Boolean(
    selectedSlot &&
    isCreatableSlot(selectedSlot) &&
    !isPastSlotForDate(selectedSlot, form.date, nowReference),
  )

  const activePenalty = useMemo(
    () => penalties.find((penalty) => penalty.is_active) || null,
    [penalties],
  )

  const canSubmitReservation = Boolean(
    selectedLab &&
    selectedLabIsAccessible &&
    !activePenalty &&
    selectedSlotIsValid &&
    !isDateBeforeToday(form.date) &&
    !isDateBeyondReservationLimit(form.date) &&
    form.purpose.trim().length >= MIN_PURPOSE_LENGTH,
  )

  const createValidationMessage = useMemo(() => {
    if (!selectedLab) {
      return 'Debes seleccionar un laboratorio antes de reservar.'
    }
    if (isDateBeforeToday(form.date)) {
      return 'No puedes registrar reservas en fechas anteriores a hoy.'
    }
    if (isDateBeyondReservationLimit(form.date)) {
      return 'Solo puedes registrar reservas con un maximo de un mes de anticipacion.'
    }
    if (!selectedLabIsAccessible) {
      return 'No tienes permisos para reservar este laboratorio.'
    }
    if (activePenalty) {
      return `Tu cuenta esta suspendida temporalmente. Motivo: ${activePenalty.reason}`
    }
    if (!selectedSlot || !isCreatableSlot(selectedSlot)) {
      return 'Debes seleccionar un bloque horario disponible del laboratorio.'
    }
    if (isPastSlotForDate(selectedSlot, form.date, nowReference)) {
      return 'No puedes reservar bloques horarios que ya empezaron o ya transcurrieron.'
    }
    if (form.purpose.trim().length < MIN_PURPOSE_LENGTH) {
      return `El motivo debe tener al menos ${MIN_PURPOSE_LENGTH} caracteres.`
    }
    return ''
  }, [activePenalty, form.date, form.purpose, nowReference, selectedLab, selectedLabIsAccessible, selectedSlot])

  const myReservations = useMemo(
    () =>
      reservations
        .filter((item) => item.requested_by === (user?.user_id || ''))
        .sort(compareReservationsByStart),
    [reservations, user],
  )

  const upcomingReservations = useMemo(
    () => myReservations.filter((item) => !HISTORY_STATUSES.has(item.status) && !getReservationActionState(item).hasStarted),
    [myReservations],
  )

  const reservationHistory = useMemo(
    () => myReservations.filter((item) => HISTORY_STATUSES.has(item.status) || getReservationActionState(item).hasStarted).reverse(),
    [myReservations],
  )

  const focusedReservation = useMemo(
    () => {
      if (focusedReservationDetails?.id === focusedReservationId) {
        return focusedReservationDetails
      }
      return myReservations.find((item) => item.id === focusedReservationId) || null
    },
    [focusedReservationDetails, focusedReservationId, myReservations],
  )

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  )

  useEffect(() => {
    if (!focusedReservationId || !isReservationDetailOpen) {
      setFocusedReservationDetails(null)
      setIsLoadingReservationDetails(false)
      return
    }

    const localReservation = myReservations.find((item) => item.id === focusedReservationId)
    if (!localReservation) {
      setFocusedReservationId('')
      setFocusedReservationDetails(null)
      setIsLoadingReservationDetails(false)
    }
  }, [focusedReservationId, isReservationDetailOpen, myReservations])

  useEffect(() => {
    if (!message && !error) {
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [message, error])

  useEffect(() => {
    if (!focusedReservationId || !isReservationDetailOpen) {
      return
    }

    if (focusedReservationDetails?.id === focusedReservationId) {
      return
    }

    let isMounted = true
    setIsLoadingReservationDetails(true)

    getReservationById(focusedReservationId)
      .then((reservation) => {
        if (isMounted) {
          setFocusedReservationDetails(reservation)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'No se pudo cargar el detalle actualizado de la reserva.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingReservationDetails(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [focusedReservationDetails?.id, focusedReservationId, isReservationDetailOpen])

  const selectedEditLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(editForm.laboratory_id)) || null,
    [editForm.laboratory_id, labs],
  )

  const isEditSlotSelectable = useCallback((slot) => {
    if (isPastSlotForDate(slot, editForm.date, nowReference)) {
      return false
    }

    return (
      slot.state === 'available' ||
      (editingReservation && slot.source === 'lab_reservation' && slot.source_id === editingReservation.id)
    )
  }, [editForm.date, editingReservation, nowReference])

  const getEditSlotTone = useCallback((slot) => {
    if (isPastSlotForDate(slot, editForm.date, nowReference)) {
      return 'past'
    }
    return getSlotTone(slot)
  }, [editForm.date, nowReference])

  const getEditSlotDisabledHint = useCallback((slot) => {
    if (isPastSlotForDate(slot, editForm.date, nowReference)) {
      return 'Esta hora ya paso y no se puede usar para reprogramar.'
    }
    if (slot?.state === 'occupied') {
      return 'Este bloque ya esta ocupado.'
    }
    if (slot?.state === 'blocked') {
      return 'Este bloque no esta disponible.'
    }
    return 'Este bloque no se puede seleccionar.'
  }, [editForm.date, nowReference])

  useEffect(() => {
    if (!editingReservation) {
      setEditSlots([])
      setEditSelectedSlotKey('')
      setIsLoadingEditSlots(false)
      return
    }

    if (!editForm.laboratory_id || !editForm.date || isDateBeforeToday(editForm.date)) {
      setEditSlots([])
      setEditSelectedSlotKey('')
      return
    }

    let mounted = true
    setIsLoadingEditSlots(true)

    getLabAvailability(editForm.laboratory_id, editForm.date)
      .then((payload) => {
        if (!mounted) {
          return
        }

        const nextSlots = Array.isArray(payload?.slots) ? payload.slots : []
        setEditSlots(nextSlots)

        const currentKey = `${editForm.start_time}-${editForm.end_time}`
        const matchingSlot = nextSlots.find((slot) => getSlotKey(slot) === currentKey && isEditSlotSelectable(slot))
        if (matchingSlot) {
          setEditSelectedSlotKey(getSlotKey(matchingSlot))
        } else {
          setEditSelectedSlotKey('')
          setEditForm((previous) => ({
            ...previous,
            start_time: '',
            end_time: '',
          }))
        }
      })
      .catch((err) => {
        if (mounted) {
          setEditSlots([])
          setEditSelectedSlotKey('')
          setError(err.message || 'No se pudieron cargar los bloques validos para editar la reserva.')
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingEditSlots(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [editingReservation, editForm.date, editForm.end_time, editForm.laboratory_id, editForm.start_time, isEditSlotSelectable])

  const selectedEditSlot = useMemo(
    () => editSlots.find((slot) => getSlotKey(slot) === editSelectedSlotKey) || null,
    [editSelectedSlotKey, editSlots],
  )

  const editValidationMessage = useMemo(() => {
    if (!editingReservation) {
      return ''
    }
    if (!selectedEditLab) {
      return 'Debes seleccionar un laboratorio valido.'
    }
    if (!isLabAccessibleToUser(selectedEditLab, user)) {
      return 'No tienes permisos para mover la reserva a este laboratorio.'
    }
    if (isDateBeforeToday(editForm.date)) {
      return 'No puedes mover una reserva a una fecha anterior a hoy.'
    }
    if (isDateBeyondReservationLimit(editForm.date)) {
      return 'Solo puedes mover reservas dentro del plazo maximo de un mes.'
    }
    if (!selectedEditSlot || !isEditSlotSelectable(selectedEditSlot)) {
      return 'Debes elegir un bloque valido del laboratorio para guardar los cambios.'
    }
    if (isPastSlotForDate(selectedEditSlot, editForm.date, nowReference)) {
      return 'No puedes guardar una reserva en un bloque que ya empezo o ya transcurrio.'
    }
    if (editForm.purpose.trim().length < MIN_PURPOSE_LENGTH) {
      return `El motivo debe tener al menos ${MIN_PURPOSE_LENGTH} caracteres.`
    }
    return ''
  }, [editForm.date, editForm.purpose, editingReservation, isEditSlotSelectable, nowReference, selectedEditLab, selectedEditSlot, user])

  const handleOpenReservationDetails = async (reservation) => {
    const nextReservation = reservation || null
    const reservationId = String(nextReservation?.id || '').trim()
    if (!reservationId) {
      return
    }

    setFocusedReservationId(reservationId)
    setIsReservationDetailOpen(true)
    setFocusedReservationDetails(nextReservation)
    setIsLoadingReservationDetails(true)
    setError('')
    setMessage('')

    try {
      const freshReservation = await getReservationById(reservationId)
      setFocusedReservationDetails(freshReservation)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle actualizado de la reserva.')
    } finally {
      setIsLoadingReservationDetails(false)
    }
  }

  const handleOpenTutorialDetails = async (sessionId) => {
    if (!sessionId) {
      return
    }

    try {
      const tutorial = await getTutorialSessionById(sessionId)
      setFocusedTutorial(tutorial)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle de la tutoria.')
    }
  }

  const handleCloseReservationDetails = () => {
    setIsReservationDetailOpen(false)
    setFocusedReservationDetails(null)
    setIsLoadingReservationDetails(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!selectedLabIsAccessible) {
      setError('No tienes permisos para reservar este laboratorio.')
      return
    }

    if (createValidationMessage) {
      setError(createValidationMessage)
      return
    }

    try {
      await createReservation(
        {
          ...form,
          laboratory_name: selectedLab?.name || '',
          area_id: selectedLab?.area_id || '',
          area_name: selectedLab?.area_name || '',
        },
        user,
      )
      setMessage('Reserva enviada correctamente. Queda pendiente de aprobacion.')
      setSelectedSlotKey('')
      setForm((prev) => ({
        ...createDefaultForm(),
        laboratory_id: prev.laboratory_id || '',
        date: prev.date || todayLocalDateString(),
        start_time: '',
        end_time: '',
      }))
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo crear la reserva.')
    }
  }

  const openEditModal = (reservation) => {
    setEditingReservation(reservation)
    setFocusedReservationId(reservation.id)
    setEditSlots([])
    setEditSelectedSlotKey(`${reservation.start_time || ''}-${reservation.end_time || ''}`)
    setEditForm(createDefaultForm({
      laboratory_id: String(reservation.laboratory_id || ''),
      date: reservation.date || '',
      start_time: reservation.start_time || '',
      end_time: reservation.end_time || '',
      purpose: reservation.purpose || '',
      notes: reservation.notes || '',
    }))
    setError('')
    setMessage('')
  }

  const closeEditModal = () => {
    setEditingReservation(null)
    setEditForm(createDefaultForm())
    setEditSlots([])
    setEditSelectedSlotKey('')
    setIsSavingEdit(false)
  }

  const handleEditFromDetail = () => {
    if (!focusedReservation) {
      return
    }

    handleCloseReservationDetails()
    openEditModal(focusedReservation)
  }

  const handleEditFormChange = (field, value) => {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'laboratory_id' || field === 'date'
        ? {
            start_time: '',
            end_time: '',
          }
        : {}),
    }))
    if (field === 'laboratory_id' || field === 'date') {
      setEditSelectedSlotKey('')
    }
  }

  const handleEditSlotSelect = (slot) => {
    if (!isEditSlotSelectable(slot)) {
      return
    }

    setEditSelectedSlotKey(getSlotKey(slot))
    setEditForm((previous) => ({
      ...previous,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }))
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editingReservation) {
      return
    }

    setError('')
    setMessage('')
    setIsSavingEdit(true)

    try {
      if (editValidationMessage) {
        throw new Error(editValidationMessage)
      }

      const updatedReservation = await updateReservation(editingReservation.id, {
        ...editForm,
        area_id: selectedEditLab?.area_id || '',
      })
      setMessage(
        'Reserva actualizada correctamente. Recuerda que esta accion solo puede realizarse una vez por reserva.',
      )
      setFocusedReservationId(updatedReservation.id)
      setFocusedReservationDetails(updatedReservation)
      closeEditModal()
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la reserva.')
      setIsSavingEdit(false)
    }
  }

  const handleRequestCancel = (reservation) => {
    setReservationToCancel(reservation)
    setError('')
    setMessage('')
  }

  const handleConfirmCancel = async () => {
    if (!reservationToCancel) {
      return
    }

    setIsCancelling(true)
    setError('')
    setMessage('')

    try {
      const wasApproved = reservationToCancel.status === 'approved'
      await deleteReservation(reservationToCancel.id)
      setReservationToCancel(null)
      if (focusedReservationId === reservationToCancel.id) {
        handleCloseReservationDetails()
      }
      setMessage(
        wasApproved
          ? 'La reserva aprobada fue cancelada. El horario quedo libre nuevamente y el encargado recibira una alerta.'
          : 'La reserva fue cancelada correctamente y el horario quedo disponible.',
      )
      await loadData()
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la reserva.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleMarkNotificationAsRead = async (notificationId) => {
    try {
      await onMarkNotificationAsRead?.(notificationId)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la alerta.')
    }
  }

  const tutorialAction = focusedTutorial ? getTutorialPrimaryAction(focusedTutorial, user?.user_id) : null

  return (
    <section className="reservations-page" aria-label="Reservar laboratorio">
      <header className="reservations-header">
        <div>
          <p className="reservations-kicker">Solicitud de uso</p>
          <h2>Reservar laboratorio por horas</h2>
          <p>Completa los datos para registrar una solicitud y administra tus reservas con cambios o cancelaciones cuando aun haya tiempo disponible.</p>
        </div>
        <div className="reservations-summary">
          <div>
            <span>Mis reservas</span>
            <strong>{myReservations.length}</strong>
          </div>
          <div>
            <span>Alertas nuevas</span>
            <strong>{unreadNotificationsCount}</strong>
          </div>
        </div>
      </header>

      {message ? <p className="reservations-message success">{message}</p> : null}
      {error ? <p className="reservations-message error">{error}</p> : null}

      {activePenalty ? (
        <section className="reservations-panel reservation-suspension-banner" aria-label="Cuenta suspendida">
          <div className="reservation-suspension-copy">
            <strong>Cuenta suspendida para nuevas reservas</strong>
            <p>
              Tienes una penalizacion activa por danos registrados. Motivo: <strong>{activePenalty.reason}</strong>.
            </p>
            <p>
              Restriccion vigente hasta <strong>{activePenalty.ends_at}</strong>.
              {activePenalty.evidence_report_id ? ` Evidencia: ${activePenalty.evidence_type} #${activePenalty.evidence_report_id}.` : ''}
            </p>
          </div>
        </section>
      ) : null}

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Alertas y recordatorios</h3>
          <p className="reservations-panel-subtitle">
            Aqui apareceran cambios importantes y recordatorios de 24 horas y 30 minutos antes del inicio.
          </p>
        </div>
        {notifications.length === 0 ? (
          <p className="reservations-empty">Aun no tienes alertas registradas.</p>
        ) : (
          <div className="reservation-notification-list">
            {notifications.map((notification) => {
              const isReminder = notification.type === 'reservation_reminder' || notification.type === 'tutorial_reminder'
              const isTutorialReminder = notification.type === 'tutorial_reminder'
              const isPenaltyNotification = notification.type === 'penalty_applied' || notification.type === 'penalty_lifted'
              const isTutorialUpdate = notification.type === 'tutorial_session_updated'
              const isTutorialCancelled = notification.type === 'tutorial_session_cancelled'
              const showSchedule = !isTutorialUpdate && notification.change_kinds.includes('schedule')
              const showLocation = !isTutorialUpdate && notification.change_kinds.includes('location')
              const showTutorialSchedule = isTutorialUpdate && notification.change_kinds.includes('schedule')
              const showTutorialLocation = isTutorialUpdate && notification.change_kinds.includes('location')
              const showTutorialTutor = isTutorialUpdate && notification.change_kinds.includes('tutor')
              const oldLabName = labNameById[String(notification.old_laboratory_id)] || notification.old_laboratory_id || 'Sin laboratorio'
              const newLabName = labNameById[String(notification.new_laboratory_id)] || notification.new_laboratory_id || 'Sin laboratorio'
              const reminderLabName =
                labNameById[String(notification.reminder_laboratory_id)] ||
                notification.reminder_laboratory_id ||
                'Sin laboratorio'
              const reminderLocation = notification.reminder_location || reminderLabName
              const reminderToneClass = notification.reminder_kind === '30m' ? ' is-reminder-urgent' : ' is-reminder'
              const reminderStartsAt = [notification.reminder_date, notification.reminder_time]
                .filter(Boolean)
                .join(' | ') || 'Sin horario confirmado'
              const reminderWindow = notification.reminder_kind === '30m'
                ? 'Faltan 30 minutos'
                : notification.reminder_kind === '24h'
                  ? 'Faltan 24 horas'
                  : 'Recordatorio programado'

              return (
                <article
                  key={notification.id}
                  className={`reservation-notification-card${notification.is_read ? '' : ' is-unread'}${isReminder ? reminderToneClass : ''}`}
                >
                  <div className="reservation-notification-head">
                    <div>
                      <span className="reservation-notification-badge">{notification.title}</span>
                      <h4>{notification.purpose || notification.penalty_reason || 'Actualizacion del sistema'}</h4>
                    </div>
                    <div className="reservation-notification-meta">
                      <small>{formatNotificationDateTime(notification.created_at)}</small>
                      {!notification.is_read ? <strong>Nueva</strong> : <span>Leida</span>}
                    </div>
                  </div>

                  <p className="reservation-notification-message">{notification.message}</p>

                  {isReminder ? (
                    <div className="reservation-notification-diff">
                      <div className="reservation-notification-change">
                        <span>Comienza</span>
                        <strong className="reservation-notification-new">{reminderStartsAt}</strong>
                      </div>
                      <div className="reservation-notification-change">
                        <span>{isTutorialReminder ? 'Ubicacion' : 'Laboratorio'}</span>
                        <strong>{isTutorialReminder ? reminderLocation : reminderLabName}</strong>
                      </div>
                      {isTutorialReminder ? (
                        <div className="reservation-notification-change">
                          <span>Tutor</span>
                          <strong>{notification.reminder_tutor_name || 'Tutor asignado'}</strong>
                        </div>
                      ) : null}
                      <div className="reservation-notification-change">
                        <span>Ventana</span>
                        <strong>{reminderWindow}</strong>
                      </div>
                    </div>
                  ) : isPenaltyNotification ? (
                    <div className="reservation-notification-diff">
                      <div className="reservation-notification-change">
                        <span>Motivo</span>
                        <strong>{notification.penalty_reason || 'Sin detalle registrado'}</strong>
                      </div>
                      <div className="reservation-notification-change">
                        <span>Vigencia</span>
                        <strong className={notification.type === 'penalty_applied' ? 'reservation-notification-old' : 'reservation-notification-new'}>
                          {notification.penalty_end_at || 'Sin fecha limite'}
                        </strong>
                      </div>
                      {notification.penalty_evidence_id ? (
                        <div className="reservation-notification-change">
                          <span>Evidencia</span>
                          <strong>{notification.penalty_evidence_id}</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : isTutorialUpdate || isTutorialCancelled ? (
                    <div className="reservation-notification-diff">
                      {showTutorialSchedule || isTutorialCancelled ? (
                        <div className="reservation-notification-change">
                          <span>{showTutorialSchedule ? 'Horario anterior' : 'Horario'}</span>
                          <strong className={showTutorialSchedule ? 'reservation-notification-old' : undefined}>
                            {[
                              notification.old_tutorial_date || notification.tutorial_date,
                              showTutorialSchedule
                                ? notification.old_tutorial_time_range
                                : `${notification.tutorial_start_time} - ${notification.tutorial_end_time}`,
                            ]
                              .filter(Boolean)
                              .join(' | ')}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario nuevo</span>
                          <strong className="reservation-notification-new">
                            {[notification.new_tutorial_date, notification.new_tutorial_time_range].filter(Boolean).join(' | ')}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialLocation || isTutorialCancelled ? (
                        <div className="reservation-notification-change">
                          <span>{showTutorialLocation ? 'Laboratorio anterior' : 'Laboratorio'}</span>
                          <strong className={showTutorialLocation ? 'reservation-notification-old' : undefined}>
                            {showTutorialLocation ? notification.old_tutorial_location : notification.tutorial_location}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialLocation ? (
                        <div className="reservation-notification-change">
                          <span>Laboratorio nuevo</span>
                          <strong className="reservation-notification-new">{notification.new_tutorial_location}</strong>
                        </div>
                      ) : null}

                      {showTutorialTutor || isTutorialCancelled ? (
                        <div className="reservation-notification-change">
                          <span>{showTutorialTutor ? 'Tutor anterior' : 'Tutor'}</span>
                          <strong className={showTutorialTutor ? 'reservation-notification-old' : undefined}>
                            {showTutorialTutor ? notification.old_tutor_name : notification.tutor_name}
                          </strong>
                        </div>
                      ) : null}

                      {showTutorialTutor ? (
                        <div className="reservation-notification-change">
                          <span>Tutor nuevo</span>
                          <strong className="reservation-notification-new">{notification.new_tutor_name}</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="reservation-notification-diff">
                      {showSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario anterior</span>
                          <strong className="reservation-notification-old">
                            {notification.old_date} | {notification.old_time_range}
                          </strong>
                        </div>
                      ) : null}

                      {showSchedule ? (
                        <div className="reservation-notification-change">
                          <span>Horario nuevo</span>
                          <strong className="reservation-notification-new">
                            {notification.new_date} | {notification.new_time_range}
                          </strong>
                        </div>
                      ) : null}

                      {showLocation ? (
                        <div className="reservation-notification-change">
                          <span>Laboratorio anterior</span>
                          <strong className="reservation-notification-old">{oldLabName}</strong>
                        </div>
                      ) : null}

                      {showLocation ? (
                        <div className="reservation-notification-change">
                          <span>Laboratorio nuevo</span>
                          <strong className="reservation-notification-new">{newLabName}</strong>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!notification.is_read ? (
                    <div className="reservations-actions">
                      <button
                        type="button"
                        className="reservations-secondary"
                        onClick={() => handleMarkNotificationAsRead(notification.id)}
                      >
                        Marcar como leida
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="reservations-panel">
        <form className="reservations-form" onSubmit={handleSubmit}>
          <div className="reservations-form-section">
            <span className="reservations-form-section-label">1 - Laboratorio</span>
            <label>
              <span>Laboratorio</span>
              <select
                value={form.laboratory_id}
                onChange={(event) => setForm((prev) => ({
                  ...prev,
                  laboratory_id: event.target.value,
                  start_time: '',
                  end_time: '',
                }))}
                disabled={Boolean(activePenalty)}
                required
              >
                <option value="">Selecciona un laboratorio</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>
            {!selectedLabIsAccessible && form.laboratory_id ? (
              <p className="reservation-inline-hint">
                No tienes permisos para reservar este laboratorio. El formulario se deshabilita hasta elegir uno habilitado.
              </p>
            ) : null}
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">2 - Fecha y Bloque Horario</span>
            <div className="reservations-form-grid">
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={form.date}
                  min={todayIso}
                  max={maxReservationIso}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    date: event.target.value,
                    start_time: '',
                    end_time: '',
                  }))}
                  disabled={Boolean(activePenalty)}
                  required
                />
              </label>
              <label>
                <span>Hora de inicio</span>
                <input
                  type="text"
                  value={form.start_time}
                  readOnly
                  placeholder="Selecciona un bloque"
                  disabled={Boolean(activePenalty)}
                />
              </label>
              <label>
                <span>Hora de fin</span>
                <input
                  type="text"
                  value={form.end_time}
                  readOnly
                  placeholder="Selecciona un bloque"
                  disabled={Boolean(activePenalty)}
                />
              </label>
            </div>

            {selectedLab ? (
              <div className="reservation-slot-panel">
                <div className="reservation-slot-header">
                  <div>
                    <strong>Bloques del dia</strong>
                    <p>
                      Selecciona un bloque visualmente. Los bloques ocupados o en mantenimiento no se pueden reservar.
                    </p>
                  </div>
                  <div className="reservation-slot-legend">
                    <span className="cal-legend-item cal-legend--available">
                      <span className="cal-legend-dot" /> Disponible
                    </span>
                    <span className="cal-legend-item cal-legend--busy">
                      <span className="cal-legend-dot" /> Ocupado
                    </span>
                    <span className="reservation-slot-legend-item maintenance">
                      <span className="reservation-slot-legend-dot" /> Mantenimiento
                    </span>
                    <span className="reservation-slot-legend-item blocked-other">
                      <span className="reservation-slot-legend-dot" /> Bloqueado
                    </span>
                    <span className="reservation-slot-legend-item tutorial">
                      <span className="reservation-slot-legend-dot" /> Tutoria
                    </span>
                    <span className="reservation-slot-legend-item past">
                      <span className="reservation-slot-legend-dot" /> Hora pasada
                    </span>
                  </div>
                </div>

                {isLoadingSlots ? (
                  <p className="reservations-empty">Cargando bloques disponibles...</p>
                ) : slots.length === 0 ? (
                  <p className="reservations-empty">No hay bloques configurados o disponibles para la fecha seleccionada.</p>
                ) : (
                  <div className="reservation-slot-grid">
                    {slots.map((slot) => {
                      const slotKey = getSlotKey(slot)
                      const isSelected = selectedSlotKey === slotKey
                      const isPast = isPastSlotForDate(slot, form.date, nowReference)
                      const isAvailable = isCreatableSlot(slot) && !isPast
                      const isTutorial = slot.source === 'tutorial_session'
                      const isDisabled = Boolean(activePenalty) || !selectedLabIsAccessible || (!isTutorial && !isAvailable)
                      return (
                        <button
                          key={slotKey}
                          type="button"
                          className={`reservations-slot ${getSlotTone(slot)}${isSelected ? ' is-selected' : ''}`}
                          disabled={isDisabled}
                          aria-disabled={isDisabled}
                          title={isPast && !isTutorial ? 'Esta hora ya paso y no se puede reservar.' : undefined}
                          onClick={() => {
                            if (isDisabled) {
                              return
                            }
                            if (isTutorial) {
                              handleOpenTutorialDetails(slot.source_id)
                              return
                            }
                            setSelectedSlotKey(slotKey)
                            setForm((prev) => ({
                              ...prev,
                              start_time: slot.start_time,
                              end_time: slot.end_time,
                            }))
                          }}
                        >
                          <strong>{slot.start_time} - {slot.end_time}</strong>
                          <span>{getSlotLabel(slot)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {createValidationMessage ? <p className="reservation-inline-hint">{createValidationMessage}</p> : null}
            {!createValidationMessage ? (
              <p className="reservation-inline-hint">
                Solo puedes reservar bloques futuros y dentro de un plazo maximo de un mes.
              </p>
            ) : null}
          </div>

          <div className="reservations-form-section">
            <span className="reservations-form-section-label">3 - Motivo</span>
            <label>
              <span>Motivo de la reserva</span>
              <textarea
                rows="4"
                value={form.purpose}
                maxLength={250}
                onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                placeholder="Ej. Practica de laboratorio de redes, proyecto de tesis..."
                disabled={Boolean(activePenalty)}
                required
              />
            </label>
            <p className="reservation-inline-hint">
              Usa un motivo claro y academico. Minimo {MIN_PURPOSE_LENGTH} caracteres, maximo 250.
            </p>
          </div>

          <div className="reservations-actions">
            <button type="submit" className="reservations-primary" disabled={!canSubmitReservation}>
              {activePenalty ? 'Reserva bloqueada' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </section>

      <section className="reservations-panel">
        <div className="reservations-panel-header">
          <h3>Mis reservas y cambios</h3>
          <p className="reservations-panel-subtitle">
            Las reservas futuras aparecen primero para que puedas modificarlas o cancelarlas cuando aun corresponda.
          </p>
        </div>
        {myReservations.length === 0 ? (
          <p className="reservations-empty">Aun no tienes reservas registradas.</p>
        ) : (
          <>
            <div className="reservations-panel-header">
              <h4>Reservas futuras o vigentes</h4>
              <p className="reservations-panel-subtitle">
                Desde aqui puedes abrir el detalle, modificar o cancelar mientras la regla horaria lo permita.
              </p>
            </div>

            {upcomingReservations.length === 0 ? (
              <p className="reservations-empty">No tienes reservas futuras disponibles para gestionar.</p>
            ) : (
              <div className="reservation-card-grid">
                {upcomingReservations.map((item) => {
                  const actionState = getReservationActionState(item)
                  return (
                    <article
                      key={item.id}
                      className={`reservation-user-card${focusedReservationId === item.id ? ' is-focused' : ''}`}
                    >
                      <div className="reservation-user-card-head">
                        <div>
                          <span className="reservation-user-card-kicker">Reserva</span>
                          <h4>{item.laboratory_name || labNameById[String(item.laboratory_id)] || 'Laboratorio'}</h4>
                        </div>
                        <span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>
                      </div>

                      <div className="reservation-user-card-meta">
                        <span>{item.date}</span>
                        <span>{item.start_time} - {item.end_time}</span>
                        <span>{item.purpose || 'Sin motivo registrado'}</span>
                      </div>

                      {item.cancel_reason ? (
                        <p className="reservation-user-card-warning">Motivo de rechazo: {item.cancel_reason}</p>
                      ) : null}

                      <div className="reservation-user-card-actions">
                        <button
                          type="button"
                          className="reservations-secondary"
                          onClick={() => handleOpenReservationDetails(item)}
                        >
                          Ver detalle
                        </button>

                        {actionState.canModify ? (
                          <button
                            type="button"
                            className="reservations-secondary"
                            onClick={() => openEditModal(item)}
                          >
                            Modificar
                          </button>
                        ) : null}

                        {!actionState.canModify && !actionState.hasStarted && actionState.withinTwoHours ? (
                          <button type="button" className="reservations-secondary" disabled>
                            Modificar bloqueado
                          </button>
                        ) : null}

                        {!actionState.canModify && !actionState.hasStarted && actionState.modificationLimitReached ? (
                          <button type="button" className="reservations-secondary" disabled>
                            Modificacion usada
                          </button>
                        ) : null}

                        {actionState.canCancel ? (
                          <button
                            type="button"
                            className="reservations-danger"
                            onClick={() => handleRequestCancel(item)}
                          >
                            Cancelar
                          </button>
                        ) : null}
                      </div>

                      {!actionState.hasStarted && actionState.withinTwoHours ? (
                        <p className="reservation-inline-hint">
                          Faltan menos de 2 horas para el inicio, por eso el boton de modificar esta deshabilitado.
                        </p>
                      ) : null}

                      {!actionState.hasStarted && actionState.modificationLimitReached ? (
                        <p className="reservation-inline-hint">
                          Ya utilizaste la unica modificacion permitida para esta reserva.
                        </p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}

            <div className="reservations-panel-header reservation-history-header">
              <h4>Historial reciente</h4>
              <p className="reservations-panel-subtitle">
                Las reservas ya transcurridas se muestran como referencia y sin acciones disponibles.
              </p>
              {onNavigate ? (
                <div className="reservation-user-card-actions">
                  <button
                    type="button"
                    className="reservations-secondary"
                    onClick={() => onNavigate('/app/reservas/historial')}
                  >
                    Ver historial completo
                  </button>
                </div>
              ) : null}
            </div>

            {reservationHistory.length === 0 ? (
              <p className="reservations-empty">Aun no tienes reservas transcurridas en el historial.</p>
            ) : (
              <div className="reservation-card-grid">
                {reservationHistory.map((item) => (
                  <article
                    key={item.id}
                    className={`reservation-user-card${focusedReservationId === item.id ? ' is-focused' : ''}`}
                  >
                    <div className="reservation-user-card-head">
                      <div>
                        <span className="reservation-user-card-kicker">Reserva</span>
                        <h4>{item.laboratory_name || labNameById[String(item.laboratory_id)] || 'Laboratorio'}</h4>
                      </div>
                      <span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>
                    </div>

                    <div className="reservation-user-card-meta">
                      <span>{item.date}</span>
                      <span>{item.start_time} - {item.end_time}</span>
                      <span>{item.purpose || 'Sin motivo registrado'}</span>
                    </div>

                    {item.cancel_reason ? (
                      <p className="reservation-user-card-warning">Motivo de rechazo: {item.cancel_reason}</p>
                    ) : null}

                    <div className="reservation-user-card-actions">
                      <button
                        type="button"
                        className="reservations-secondary"
                        onClick={() => handleOpenReservationDetails(item)}
                      >
                        Ver detalle
                      </button>
                    </div>

                    <p className="reservation-inline-hint">
                      Esta reserva ya transcurrio. Las acciones de modificar y cancelar ya no estan disponibles.
                    </p>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <ReservationEditModal
        reservation={editingReservation}
        labs={labs}
        form={editForm}
        slots={editSlots}
        selectedSlotKey={editSelectedSlotKey}
        isLoadingSlots={isLoadingEditSlots}
        minDate={todayIso}
        maxDate={maxReservationIso}
        validationMessage={editValidationMessage}
        onSelectSlot={handleEditSlotSelect}
        getSlotKey={getSlotKey}
        getSlotTone={getEditSlotTone}
        getSlotLabel={getSlotLabel}
        getSlotDisabledHint={getEditSlotDisabledHint}
        isSlotSelectable={isEditSlotSelectable}
        onChange={handleEditFormChange}
        onSubmit={handleEditSubmit}
        onClose={closeEditModal}
        isSubmitting={isSavingEdit}
      />

      {isReservationDetailOpen && (focusedReservation || isLoadingReservationDetails) ? (
        <ReservationDetailModal
          reservation={focusedReservation}
          actionState={focusedReservation ? getReservationActionState(focusedReservation) : null}
          isLoading={isLoadingReservationDetails}
          laboratoryName={
            focusedReservation
              ? (focusedReservation.laboratory_name || labNameById[String(focusedReservation.laboratory_id)] || 'Laboratorio')
              : 'Laboratorio'
          }
          onClose={handleCloseReservationDetails}
          onEdit={handleEditFromDetail}
          onCancel={() => {
            if (focusedReservation) {
              handleCloseReservationDetails()
              handleRequestCancel(focusedReservation)
            }
          }}
        />
      ) : null}

      {focusedTutorial ? (
        <TutorialSessionDetailModal
          session={focusedTutorial}
          title="Tutoria en este bloque"
          onClose={() => setFocusedTutorial(null)}
          primaryActionLabel={tutorialAction?.label || ''}
          primaryActionHint={tutorialAction?.hint || ''}
          onPrimaryAction={() => {
            const sessionId = focusedTutorial?.id
            setFocusedTutorial(null)
            openTutorialSessionFlow(sessionId, { navigate: true })
          }}
        />
      ) : null}

      {reservationToCancel ? (
        <ConfirmModal
          title="Cancelar reserva"
          message={
            reservationToCancel.status === 'approved'
              ? 'Esta reserva ya estaba aprobada. Si la cancelas, el horario volvera a quedar libre y el encargado recibira una alerta automatica.'
              : 'Si cancelas esta reserva pendiente, el horario volvera a mostrarse como disponible.'
          }
          confirmLabel={isCancelling ? 'Cancelando...' : 'Cancelar reserva'}
          onConfirm={isCancelling ? undefined : handleConfirmCancel}
          onCancel={isCancelling ? undefined : () => setReservationToCancel(null)}
        />
      ) : null}
    </section>
  )
}

export default UserReserveLabPage

