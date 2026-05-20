import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import { listAdminLabs, listMaterials } from '../../admin/services/infrastructureService'
import {
  createSupplyReservation,
  getLabAvailability,
} from '../../reservations/services/reservationsService'
import {
  createTutorialSession,
  deleteTutorialSession,
  getTutorialSessionById,
  listMyTutorialSessions,
  subscribeTutorialSessionsRealtime,
  updateTutorialEnrollmentAttendance,
  updateTutorialSession,
  updateTutorialSessionObservation,
} from '../services/tutorialSessionsService'
import TutorialSessionDetailModal from './TutorialSessionDetailModal'
import './TutorialPages.css'

const MIN_TOPIC_LENGTH = 5
const MAX_DESCRIPTION_LENGTH = 400
const MAX_TUTOR_OBSERVATION_LENGTH = 500
const MAX_STUDENT_OBSERVATION_LENGTH = 200
const MAX_SEATS = 50
const CLOCK_REFRESH_MS = 30 * 1000

function normalizeFilePart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function escapeCsvValue(value) {
  const normalized = String(value ?? '')
  if (normalized.includes(',') || normalized.includes('"') || normalized.includes('\n')) {
    return `"${normalized.replaceAll('"', '""')}"`
  }
  return normalized
}

function formatEnrollmentDate(value) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return new Intl.DateTimeFormat('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatEnrollmentTime(value) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function buildEnrollmentAttendanceDrafts(students) {
  return Object.fromEntries(
    (Array.isArray(students) ? students : []).map((student) => {
      const studentId = String(student?.student_id || '')
      return [studentId, {
        attended: student?.attended === true,
        performance_observation: String(student?.performance_observation || '').slice(0, MAX_STUDENT_OBSERVATION_LENGTH),
      }]
    }),
  )
}

async function loadImageAsDataUrl(src) {
  const response = await fetch(src)
  const blob = await response.blob()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer el logo institucional'))
    reader.readAsDataURL(blob)
  })
}

function todayLocalDateString() {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function maxReservableDateString() {
  const value = new Date()
  value.setMonth(value.getMonth() + 1)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultForm(overrides = {}) {
  return {
    topic: '',
    tutor_name: '',
    description: '',
    laboratory_id: '',
    location: '',
    session_date: todayLocalDateString(),
    start_time: '',
    end_time: '',
    max_students: 8,
    requested_materials: [],
    ...overrides,
  }
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

function parseSessionDate(value) {
  // start_at/end_at se guardan como UTC pero llevan la hora LOCAL del usuario.
  // Si dejamos que Date() interprete el sufijo Z, las comparaciones de
  // hasStarted/hasEnded se corren 4 hs en Bolivia (UTC-4).
  if (!value) return null
  const normalized = String(value).replace('Z', '').replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getSessionTimeState(session, referenceNow = new Date()) {
  const sessionStart = parseSessionDate(session?.start_at)
    || buildLocalDateTime(session?.session_date, session?.start_time)
  const sessionEnd = parseSessionDate(session?.end_at)
    || buildLocalDateTime(session?.session_date, session?.end_time)
  const hasStarted = Boolean(sessionStart) && sessionStart.getTime() <= referenceNow.getTime()
  const hasEnded = Boolean(sessionEnd) && sessionEnd.getTime() <= referenceNow.getTime()
  return { hasStarted, hasEnded }
}

function getSlotKey(slot) {
  return `${slot.start_time}-${slot.end_time}`
}

function getSlotTone(slot, dateValue, referenceNow) {
  if (slot.source === 'tutorial_session') {
    return 'tutorial'
  }

  if (slot.source === 'class') {
    return 'class'
  }

  if (isPastSlotForDate(slot, dateValue, referenceNow) || (slot.state === 'blocked' && slot.status === 'past')) {
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

function getSlotLabel(slot, dateValue, referenceNow) {
  if (slot.source === 'tutorial_session') {
    return 'Tutoria'
  }

  if (slot.source === 'class') {
    return slot.status ? `Clase: ${slot.status}` : 'Clase'
  }

  if (isPastSlotForDate(slot, dateValue, referenceNow) || (slot.state === 'blocked' && slot.status === 'past')) {
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

function TutorTutorialSessionsPage() {
  const [form, setForm] = useState(() => createDefaultForm())
  const [editingSessionId, setEditingSessionId] = useState('')
  const [sessions, setSessions] = useState([])
  const [labs, setLabs] = useState([])
  const [slots, setSlots] = useState([])
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [availabilityRefreshNonce, setAvailabilityRefreshNonce] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clockTick, setClockTick] = useState(Date.now())
  const [focusedSession, setFocusedSession] = useState(null)
  const [isLoadingFocusedSession, setIsLoadingFocusedSession] = useState(false)
  const [observationDraft, setObservationDraft] = useState('')
  const [isSavingAttendanceList, setIsSavingAttendanceList] = useState(false)
  const [attendanceDrafts, setAttendanceDrafts] = useState({})
  const [materialsCatalog, setMaterialsCatalog] = useState([])
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const todayIso = todayLocalDateString()
  const maxReservationIso = maxReservableDateString()
  const nowReference = useMemo(() => new Date(clockTick), [clockTick])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, CLOCK_REFRESH_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const labId = String(form.laboratory_id || '').trim()

    if (!labId) {
      setMaterialsCatalog([])
      setForm((previous) => (
        previous.requested_materials.length === 0
          ? previous
          : { ...previous, requested_materials: [] }
      ))
      return () => {
        cancelled = true
      }
    }

    setIsLoadingMaterials(true)
    listMaterials(labId)
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data) ? data : []
        setMaterialsCatalog(items)
        setForm((previous) => {
          const allowedIds = new Set(items.map((item) => String(item.id)))
          const filtered = previous.requested_materials.filter((entry) => allowedIds.has(String(entry.stock_item_id)))
          if (filtered.length === previous.requested_materials.length) {
            return previous
          }
          return { ...previous, requested_materials: filtered }
        })
      })
      .catch(() => {
        if (cancelled) return
        setMaterialsCatalog([])
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingMaterials(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [form.laboratory_id])

  const loadSessions = async () => {
    try {
      const data = await listMyTutorialSessions()
      setSessions(data)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar tus tutorias.')
    }
  }

  const loadLabs = async () => {
    try {
      const data = await listAdminLabs()
      const activeLabs = Array.isArray(data) ? data.filter((lab) => lab?.is_active !== false) : []
      setLabs(activeLabs)
      setForm((previous) => {
        if (previous.laboratory_id || activeLabs.length === 0) {
          return previous
        }
        return {
          ...previous,
          laboratory_id: String(activeLabs[0].id || ''),
          location: String(activeLabs[0].name || ''),
        }
      })
    } catch (err) {
      setError(err.message || 'No se pudo cargar los laboratorios disponibles para tutorias.')
    }
  }

  const sessionIdsRef = useRef(new Set())
  const tutorIdRef = useRef('')
  const reloadTimerRef = useRef(null)

  useEffect(() => {
    sessionIdsRef.current = new Set(sessions.map((session) => session.id))
    if (!tutorIdRef.current && sessions.length > 0) {
      tutorIdRef.current = String(sessions[0]?.tutor_id || '')
    }
  }, [sessions])

  useEffect(() => {
    loadSessions()
    loadLabs()

    const scheduleReload = () => {
      window.clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = window.setTimeout(() => {
        loadSessions()
        setAvailabilityRefreshNonce((value) => value + 1)
      }, 1000)
    }

    const unsubscribe = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic !== 'tutorial_session') return
      const recordId = String(event?.record?.id || '')
      const recordTutorId = String(event?.record?.tutor_id || '')
      const concernsMe =
        (recordId && sessionIdsRef.current.has(recordId)) ||
        (tutorIdRef.current && recordTutorId && recordTutorId === tutorIdRef.current)
      if (concernsMe) scheduleReload()
    })

    return () => {
      window.clearTimeout(reloadTimerRef.current)
      unsubscribe?.()
    }
  }, [])

  const visibleSessions = useMemo(() => {
    return [...sessions].sort((left, right) => {
      const leftEnd = parseSessionDate(left?.end_at)?.getTime() || 0
      const rightEnd = parseSessionDate(right?.end_at)?.getTime() || 0
      return rightEnd - leftEnd
    })
  }, [sessions])

  const totalSeats = useMemo(
    () => visibleSessions.reduce((sum, session) => sum + session.max_students, 0),
    [visibleSessions],
  )

  const selectedLab = useMemo(
    () => labs.find((lab) => String(lab.id) === String(form.laboratory_id)) || null,
    [form.laboratory_id, labs],
  )

  const editingSession = useMemo(
    () => sessions.find((session) => session.id === editingSessionId) || null,
    [editingSessionId, sessions],
  )

  useEffect(() => {
    let mounted = true

    if (!form.laboratory_id || !form.session_date || isDateBeforeToday(form.session_date) || isDateBeyondReservationLimit(form.session_date)) {
      setSlots([])
      setSelectedSlotKey('')
      return () => {
        mounted = false
      }
    }

    setIsLoadingSlots(true)
    getLabAvailability(form.laboratory_id, form.session_date)
      .then((payload) => {
        if (!mounted) {
          return
        }
        const nextSlots = Array.isArray(payload?.slots) ? payload.slots : []
        setSlots(nextSlots)

        const currentKey = `${form.start_time}-${form.end_time}`
        const matchingSlot = nextSlots.find(
          (slot) =>
            getSlotKey(slot) === currentKey
            && (
              slot.state === 'available'
              || (slot.source === 'tutorial_session' && slot.source_id === editingSessionId)
            ),
        )
        if (matchingSlot) {
          setSelectedSlotKey(getSlotKey(matchingSlot))
        } else {
          setSelectedSlotKey('')
          setForm((previous) => ({
            ...previous,
            start_time: '',
            end_time: '',
          }))
        }
      })
      .catch((err) => {
        if (!mounted) {
          return
        }
        setSlots([])
        setSelectedSlotKey('')
        setError(err.message || 'No se pudieron cargar los bloques del laboratorio para tutorias.')
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingSlots(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [availabilityRefreshNonce, editingSessionId, form.end_time, form.laboratory_id, form.session_date, form.start_time])

  const selectedSlot = useMemo(
    () => slots.find((slot) => getSlotKey(slot) === selectedSlotKey) || null,
    [selectedSlotKey, slots],
  )

  const sessionStart = useMemo(
    () => buildLocalDateTime(form.session_date, form.start_time),
    [form.session_date, form.start_time],
  )

  const sessionEnd = useMemo(
    () => buildLocalDateTime(form.session_date, form.end_time),
    [form.session_date, form.end_time],
  )

  const validationMessage = useMemo(() => {
    if (!selectedLab) {
      return 'Debes seleccionar un laboratorio valido para publicar la tutoria.'
    }
    if (isDateBeforeToday(form.session_date)) {
      return 'No puedes publicar tutorias en fechas anteriores a hoy.'
    }
    if (isDateBeyondReservationLimit(form.session_date)) {
      return 'Solo puedes publicar tutorias con un maximo de un mes de anticipacion.'
    }
    if (String(form.topic || '').trim().length < MIN_TOPIC_LENGTH) {
      return `El tema debe tener al menos ${MIN_TOPIC_LENGTH} caracteres.`
    }
    const isCurrentTutorialSlot = selectedSlot?.source === 'tutorial_session' && selectedSlot?.source_id === editingSessionId
    if (!selectedSlot || (!isCurrentTutorialSlot && selectedSlot.state !== 'available')) {
      return 'Debes seleccionar un bloque disponible del laboratorio para publicar la tutoria.'
    }
    if (isPastSlotForDate(selectedSlot, form.session_date, nowReference)) {
      return 'No puedes publicar tutorias en bloques que ya comenzaron o ya transcurrieron.'
    }
    if (!sessionStart || !sessionEnd || sessionEnd <= sessionStart) {
      return 'La hora de fin debe ser posterior a la hora de inicio.'
    }
    if (sessionStart <= nowReference) {
      return 'No puedes publicar una tutoria en un horario pasado o que ya comenzo.'
    }
    const seats = Number(form.max_students || 0)
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
      return `El cupo maximo debe estar entre 1 y ${MAX_SEATS} estudiantes.`
    }
    if (String(form.description || '').trim().length > MAX_DESCRIPTION_LENGTH) {
      return `La descripcion no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres.`
    }
    return ''
  }, [editingSessionId, form.description, form.max_students, form.session_date, form.topic, nowReference, selectedLab, selectedSlot, sessionEnd, sessionStart])

  const canSubmit = !validationMessage && labs.length > 0

  const handleFormChange = (field, value) => {
    setForm((previous) => {
      if (field === 'laboratory_id') {
        const nextLab = labs.find((lab) => String(lab.id) === String(value)) || null
        return {
          ...previous,
          laboratory_id: String(value || ''),
          location: String(nextLab?.name || ''),
          start_time: '',
          end_time: '',
        }
      }

      if (field === 'session_date') {
        return {
          ...previous,
          session_date: value,
          start_time: '',
          end_time: '',
        }
      }

      if (field === 'max_students') {
        return {
          ...previous,
          max_students: value,
        }
      }

      return {
        ...previous,
        [field]: value,
      }
    })

    if (field === 'laboratory_id' || field === 'session_date') {
      setSelectedSlotKey('')
    }
  }

  const resetEditor = () => {
    setEditingSessionId('')
    setSelectedSlotKey('')
    setForm(createDefaultForm({
      session_date: todayLocalDateString(),
      laboratory_id: String(selectedLab?.id || labs[0]?.id || ''),
      location: String(selectedLab?.name || labs[0]?.name || ''),
    }))
  }

  const handleStartEditing = (session) => {
    if (!session) {
      return
    }

    setEditingSessionId(session.id)
    setForm(createDefaultForm({
      topic: session.topic,
      tutor_name: session.tutor_name || '',
      description: session.description,
      laboratory_id: String(session.laboratory_id || ''),
      location: String(session.location || ''),
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      max_students: session.max_students,
    }))
    setSelectedSlotKey(`${session.start_time}-${session.end_time}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSelectSlot = (slot) => {
    const isCurrentTutorialSlot = slot?.source === 'tutorial_session' && slot?.source_id === editingSessionId
    if (slot.state !== 'available' && !isCurrentTutorialSlot) {
      return
    }

    setSelectedSlotKey(getSlotKey(slot))
    setForm((previous) => ({
      ...previous,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }))
  }

  const handleOpenTutorialDetails = async (sessionId) => {
    if (!sessionId) {
      return
    }

    const localSession = sessions.find((session) => session.id === sessionId) || null
    if (localSession) {
      setFocusedSession(localSession)
    }
    setIsLoadingFocusedSession(true)

    try {
      const tutorial = await getTutorialSessionById(sessionId)
      setFocusedSession(tutorial)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle de la tutoria.')
    } finally {
      setIsLoadingFocusedSession(false)
    }
  }

  useEffect(() => {
    setObservationDraft(String(focusedSession?.tutor_observation || '').slice(0, MAX_TUTOR_OBSERVATION_LENGTH))
    setAttendanceDrafts(buildEnrollmentAttendanceDrafts(focusedSession?.enrolled_students))
  }, [focusedSession])

  const handleAttendanceDraftChange = (studentId, field, value) => {
    const normalizedStudentId = String(studentId || '')
    if (!normalizedStudentId) {
      return
    }

    setAttendanceDrafts((previous) => ({
      ...previous,
      [normalizedStudentId]: {
        attended: previous[normalizedStudentId]?.attended === true,
        performance_observation: previous[normalizedStudentId]?.performance_observation || '',
        ...(field === 'attended'
          ? { attended: value === true }
          : { performance_observation: String(value || '').slice(0, MAX_STUDENT_OBSERVATION_LENGTH) }),
      },
    }))
  }

  const handleSaveAttendanceList = async () => {
    if (!focusedSession?.id) {
      return
    }

    const enrolledStudents = Array.isArray(focusedSession.enrolled_students) ? focusedSession.enrolled_students : []
    const changedAttendance = enrolledStudents.filter((student) => {
      const studentId = String(student?.student_id || '')
      const draft = attendanceDrafts[studentId] || {
        attended: student?.attended === true,
        performance_observation: String(student?.performance_observation || ''),
      }

      return (
        draft.attended !== (student?.attended === true)
        || String(draft.performance_observation || '') !== String(student?.performance_observation || '')
      )
    })

    const normalizedObservationDraft = String(observationDraft || '').trim().slice(0, MAX_TUTOR_OBSERVATION_LENGTH)
    const observationChanged = normalizedObservationDraft !== String(focusedSession.tutor_observation || '')

    if (!observationChanged && changedAttendance.length === 0) {
      setMessage('No hay cambios pendientes por guardar en la lista.')
      setError('')
      return
    }

    setError('')
    setMessage('')
    setIsSavingAttendanceList(true)

    try {
      let updatedSession = focusedSession

      if (observationChanged) {
        updatedSession = await updateTutorialSessionObservation(focusedSession.id, normalizedObservationDraft)
      }

      for (const student of changedAttendance) {
        const studentId = String(student?.student_id || '')
        const draft = attendanceDrafts[studentId] || {
          attended: false,
          performance_observation: '',
        }
        updatedSession = await updateTutorialEnrollmentAttendance(updatedSession.id, studentId, draft)
      }

      setFocusedSession(updatedSession)
      setSessions((previous) => previous.map((session) => (session.id === updatedSession.id ? updatedSession : session)))
      setMessage('La lista de asistencia y las observaciones se guardaron correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo guardar la lista de asistencia.')
    } finally {
      setIsSavingAttendanceList(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (validationMessage) {
      setError(validationMessage)
      return
    }

    setIsSubmitting(true)
    try {
      const labId = String(selectedLab?.id || '')
      const requestedMaterials = (form.requested_materials || []).filter((entry) => (
        entry?.stock_item_id && Number(entry.quantity) > 0
      ))

      const { requested_materials: _omitMaterials, ...formForBackend } = form
      const payload = {
        ...formForBackend,
        laboratory_id: labId,
        location: String(selectedLab?.name || ''),
        max_students: Number(form.max_students),
      }

      if (editingSessionId) {
        await updateTutorialSession(editingSessionId, payload)
        setMessage(
          editingSession?.enrolled_count > 0
            ? 'Tutoria actualizada. Los estudiantes inscritos ya fueron notificados del cambio.'
            : 'Tutoria actualizada correctamente.',
        )
      } else {
        const createdSession = await createTutorialSession(payload)
        const sessionId = String(createdSession?.id || '')

        if (sessionId && requestedMaterials.length > 0) {
          const results = await Promise.allSettled(requestedMaterials.map((entry) => (
            createSupplyReservation({
              stock_item_id: entry.stock_item_id,
              quantity: Number(entry.quantity),
              requested_for: `Tutoria: ${form.topic}`,
              notes: form.description || '',
              laboratory_id: labId,
              tutorial_session_id: sessionId,
            })
          )))

          const failed = results.filter((result) => result.status === 'rejected')
          if (failed.length > 0) {
            const detail = failed.map((result) => result.reason?.message || 'Error desconocido').join('; ')
            setMessage(`Tutoria publicada, pero ${failed.length} material(es) no se pudieron reservar: ${detail}`)
          } else {
            setMessage('Tutoria solicitada con sus materiales. Queda pendiente de aprobacion del encargado del laboratorio.')
          }
        } else {
          setMessage('Tutoria solicitada correctamente. Queda pendiente de aprobacion del encargado del laboratorio antes de que los estudiantes puedan inscribirse.')
        }
      }

      setEditingSessionId('')
      setForm(createDefaultForm({
        session_date: form.session_date,
        laboratory_id: String(selectedLab?.id || ''),
        location: String(selectedLab?.name || ''),
      }))
      setSelectedSlotKey('')
      setAvailabilityRefreshNonce((value) => value + 1)
      await loadSessions()
    } catch (err) {
      setError(err.message || (editingSessionId ? 'No se pudo actualizar la tutoria.' : 'No se pudo publicar la tutoria.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (session) => {
    setDeletingId(session.id)
    setError('')
    setMessage('')

    try {
      await deleteTutorialSession(session.id)
      if (editingSessionId === session.id) {
        resetEditor()
      }
      setMessage(
        session.enrolled_count > 0
          ? 'Tutoria eliminada. Las inscripciones se cancelaron y los estudiantes fueron notificados.'
          : 'Bloque de tutoria eliminado correctamente.',
      )
      setAvailabilityRefreshNonce((value) => value + 1)
      await loadSessions()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la tutoria.')
    } finally {
      setDeletingId('')
    }
  }

  const handleDownloadEnrolledCsv = (session) => {
    const students = Array.isArray(session?.enrolled_students) ? session.enrolled_students : []
    const csvLines = [
      ['Tema', session.topic || ''],
      ['Fecha tutoria', session.session_date || ''],
      ['Horario', `${session.start_time || '-'} - ${session.end_time || '-'}`],
      ['Laboratorio', session.location || ''],
      ['Inscritos', String(students.length)],
      [],
      ['N', 'Estudiante', 'Correo', 'Fecha de inscripcion', 'Hora de inscripcion'],
      ...students.map((student, index) => ([
        String(index + 1),
        student.student_name || 'Estudiante',
        student.student_email || '',
        formatEnrollmentDate(student.created_at),
        formatEnrollmentTime(student.created_at),
      ])),
    ]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
      .join('\r\n')

    const fileSafeTopic = normalizeFilePart(session.topic) || 'tutoria'
    const fileSafeDate = normalizeFilePart(session.session_date) || 'fecha'
    downloadTextFile(
      `inscritos-${fileSafeTopic}-${fileSafeDate}.csv`,
      csvLines,
      'text/csv;charset=utf-8',
    )
    setMessage('Lista de inscritos descargada en CSV.')
  }

  const handleDownloadEnrolledPdf = async (session) => {
    const students = Array.isArray(session?.enrolled_students) ? session.enrolled_students : []
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const marginX = 44
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let cursorY = 54

    const writeLine = (text, size = 11, weight = 'normal', color = [19, 33, 68]) => {
      doc.setFont('helvetica', weight)
      doc.setFontSize(size)
      doc.setTextColor(color[0], color[1], color[2])
      doc.text(text, marginX, cursorY)
      cursorY += size + 8
    }

    const drawPageFooter = () => {
      doc.setDrawColor(214, 224, 238)
      doc.line(marginX, pageHeight - 32, pageWidth - marginX, pageHeight - 32)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(96, 112, 138)
      doc.text('Universidad Catolica Boliviana - LabConnect', marginX, pageHeight - 18)
      doc.text(`Generado: ${new Date().toLocaleString('es-BO')}`, pageWidth - marginX, pageHeight - 18, { align: 'right' })
    }

    doc.setFillColor(10, 53, 89)
    doc.rect(0, 0, pageWidth, 88, 'F')
    doc.setFillColor(244, 197, 66)
    doc.rect(0, 84, pageWidth, 4, 'F')

    try {
      const logoDataUrl = await loadImageAsDataUrl(ucbEscudoLogo)
      doc.addImage(logoDataUrl, 'PNG', marginX, 16, 44, 56)
    } catch {
      // If logo loading fails, PDF still renders with branded colors.
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text('Lista de Estudiantes Inscritos', marginX + 56, 38)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text('LabConnect - Soporte Academico', marginX + 56, 58)

    cursorY = 120

    writeLine(`Tutoria: ${session.topic || '-'}`, 12, 'bold')
    writeLine(`Fecha: ${session.session_date || '-'} | Horario: ${session.start_time || '-'} - ${session.end_time || '-'}`)
    writeLine(`Laboratorio: ${session.location || '-'}`)
    writeLine(`Inscritos: ${students.length} / ${Number(session.max_students || 0)}`)

    cursorY += 6
    doc.setFillColor(235, 242, 250)
    doc.roundedRect(marginX, cursorY - 8, pageWidth - (marginX * 2), 28, 8, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(10, 53, 89)
    doc.text('N°', marginX + 10, cursorY + 9)
    doc.text('Estudiante', marginX + 36, cursorY + 9)
    doc.text('Correo', marginX + 220, cursorY + 9)
    doc.text('Fecha', marginX + 400, cursorY + 9)
    doc.text('Hora', marginX + 490, cursorY + 9)
    cursorY += 30

    if (students.length === 0) {
      writeLine('No hay estudiantes inscritos en esta tutoria.', 11, 'bold', [88, 102, 126])
    } else {
      students.forEach((student, index) => {
        if (cursorY > 742) {
          drawPageFooter()
          doc.addPage()
          cursorY = 56

          doc.setFillColor(235, 242, 250)
          doc.roundedRect(marginX, cursorY - 8, pageWidth - (marginX * 2), 28, 8, 8, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.setTextColor(10, 53, 89)
          doc.text('N°', marginX + 10, cursorY + 9)
          doc.text('Estudiante', marginX + 36, cursorY + 9)
          doc.text('Correo', marginX + 220, cursorY + 9)
          doc.text('Fecha', marginX + 400, cursorY + 9)
          doc.text('Hora', marginX + 490, cursorY + 9)
          cursorY += 30
        }

        if (index % 2 === 0) {
          doc.setFillColor(248, 251, 255)
          doc.rect(marginX, cursorY - 12, pageWidth - (marginX * 2), 24, 'F')
        }

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(26, 43, 72)
        doc.text(String(index + 1), marginX + 10, cursorY + 4)
        doc.text(String(student.student_name || 'Estudiante'), marginX + 36, cursorY + 4)
        doc.text(String(student.student_email || '-'), marginX + 220, cursorY + 4)
        doc.text(formatEnrollmentDate(student.created_at), marginX + 400, cursorY + 4)
        doc.text(formatEnrollmentTime(student.created_at), marginX + 490, cursorY + 4)
        cursorY += 24
      })
    }

    drawPageFooter()

    const fileSafeTopic = normalizeFilePart(session.topic) || 'tutoria'
    const fileSafeDate = normalizeFilePart(session.session_date) || 'fecha'
    doc.save(`inscritos-${fileSafeTopic}-${fileSafeDate}.pdf`)
    setMessage('Lista de inscritos descargada en PDF.')
  }

  return (
    <section className="tutorials-page" aria-label="Gestion de tutorias">
      <header className="tutorials-header">
        <div>
          <p className="tutorials-kicker">Soporte academico</p>
          <h2>Tutorias docentes</h2>
          <p>Publica sesiones con fecha, hora y cupos. El sistema ayuda a evitar cruces con reservas de laboratorio.</p>
        </div>
        <div className="tutorials-summary">
          <div><span>Sesiones</span><strong>{visibleSessions.length}</strong></div>
          <div><span>Cupos</span><strong>{totalSeats}</strong></div>
        </div>
      </header>

      {message ? <p className="tutorials-message success">{message}</p> : null}
      {error ? <p className="tutorials-message error">{error}</p> : null}

      <section className="tutorials-panel">
        <details className="ux-extra-toggle" open={Boolean(editingSessionId)}>
          <summary>{editingSessionId ? 'Editar bloque seleccionado' : 'Publicar nueva tutoria'}</summary>
          <div className="ux-extra-toggle-content">
            <form className="tutorials-form" onSubmit={handleSubmit}>
          <div className="tutorials-form-grid">
            <label>
              <span>Tema</span>
              <input
                type="text"
                value={form.topic}
                maxLength={120}
                onChange={(event) => handleFormChange('topic', event.target.value)}
                placeholder="Ej. Refuerzo de algoritmos"
                required
              />
            </label>
            <label>
              <span>Tutor visible</span>
              <input
                type="text"
                value={form.tutor_name}
                maxLength={120}
                onChange={(event) => handleFormChange('tutor_name', event.target.value)}
                placeholder="Se mostrara este nombre a los estudiantes"
              />
            </label>
            <label>
              <span>Laboratorio</span>
              <select
                value={form.laboratory_id}
                onChange={(event) => handleFormChange('laboratory_id', event.target.value)}
                required
              >
                <option value="">Selecciona un laboratorio</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Fecha</span>
              <input
                type="date"
                value={form.session_date}
                min={todayIso}
                max={maxReservationIso}
                onChange={(event) => handleFormChange('session_date', event.target.value)}
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
              />
            </label>
            <label>
              <span>Hora de fin</span>
              <input
                type="text"
                value={form.end_time}
                readOnly
                placeholder="Selecciona un bloque"
              />
            </label>
            <label>
              <span>Cupo maximo</span>
              <input
                type="number"
                min="1"
                max={String(MAX_SEATS)}
                step="1"
                value={form.max_students}
                onChange={(event) => handleFormChange('max_students', event.target.value)}
                required
              />
            </label>
          </div>

          {selectedLab ? (
            <div className="tutorial-slot-panel">
              <div className="tutorial-slot-header">
                <div>
                  <strong>Bloques del dia</strong>
                  <p>Asi el tutor puede ver que espacios estan libres, ocupados, bloqueados o en mantenimiento antes de publicar.</p>
                </div>
                <div className="tutorial-slot-legend">
                  <span className="tutorial-slot-legend-item available">
                    <span className="tutorial-slot-legend-dot" /> Disponible
                  </span>
                  <span className="tutorial-slot-legend-item tutorial">
                    <span className="tutorial-slot-legend-dot" /> Tutoria
                  </span>
                  <span className="tutorial-slot-legend-item busy">
                    <span className="tutorial-slot-legend-dot" /> Ocupado
                  </span>
                  <span className="tutorial-slot-legend-item class">
                    <span className="tutorial-slot-legend-dot" /> Clase
                  </span>
                  <span className="tutorial-slot-legend-item maintenance">
                    <span className="tutorial-slot-legend-dot" /> Mantenimiento
                  </span>
                  <span className="tutorial-slot-legend-item blocked-other">
                    <span className="tutorial-slot-legend-dot" /> Bloqueado
                  </span>
                  <span className="tutorial-slot-legend-item past">
                    <span className="tutorial-slot-legend-dot" /> Hora pasada
                  </span>
                </div>
              </div>

              {isLoadingSlots ? (
                <p className="tutorials-empty">Cargando bloques del laboratorio...</p>
              ) : slots.length === 0 ? (
                <p className="tutorials-empty">No hay bloques configurados o disponibles para la fecha seleccionada.</p>
              ) : (
                <div className="tutorial-slot-grid">
                  {slots.map((slot) => {
                    const slotKey = getSlotKey(slot)
                    const isSelected = selectedSlotKey === slotKey
                    const isCurrentTutorial = slot.source === 'tutorial_session' && slot.source_id === editingSessionId
                    const isAvailable = (slot.state === 'available' || isCurrentTutorial) && !isPastSlotForDate(slot, form.session_date, nowReference)
                    const isTutorial = slot.source === 'tutorial_session'
                    return (
                      <button
                        key={slotKey}
                        type="button"
                        className={`tutorial-slot ${getSlotTone(slot, form.session_date, nowReference)}${isSelected ? ' is-selected' : ''}`}
                        disabled={!isAvailable && !isTutorial}
                        title={slot.source === 'class' && slot.status ? `Clase: ${slot.status}` : undefined}
                        onClick={() => {
                          if (isTutorial && !isCurrentTutorial) {
                            handleOpenTutorialDetails(slot.source_id)
                            return
                          }
                          handleSelectSlot(slot)
                        }}
                      >
                        <strong>{slot.start_time} - {slot.end_time}</strong>
                        <span>{getSlotLabel(slot, form.session_date, nowReference)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          <label>
            <span>Descripcion</span>
            <textarea
              rows="4"
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={form.description}
              onChange={(event) => handleFormChange('description', event.target.value)}
              placeholder="Explica para que temas o estudiantes esta orientada la tutoria."
            />
          </label>

          <div className="tutorials-inline-meta">
            <span>Ubicacion asignada: {selectedLab?.name || 'Selecciona un laboratorio'}</span>
            <span>Solo se permiten bloques futuros y hasta un mes de anticipacion.</span>
          </div>

          {selectedLab && !editingSessionId ? (
            <div className="tutorial-materials">
              <div className="tutorial-materials-header">
                <strong>Materiales requeridos (opcional)</strong>
                <p>Reserva insumos del mismo laboratorio. Quedan en pendiente y el encargado los aprueba antes de descontar stock.</p>
              </div>

              {isLoadingMaterials ? (
                <p className="tutorials-empty">Cargando catalogo de materiales...</p>
              ) : materialsCatalog.length === 0 ? (
                <p className="tutorials-empty">El laboratorio no tiene materiales registrados.</p>
              ) : (
                <>
                  {form.requested_materials.length === 0 ? (
                    <p className="tutorials-empty">Aun no agregaste materiales a la tutoria.</p>
                  ) : (
                    <ul className="tutorial-materials-list">
                      {form.requested_materials.map((entry, index) => {
                        const material = materialsCatalog.find((item) => String(item.id) === String(entry.stock_item_id))
                        const stock = Number(material?.quantity_available || 0)
                        const isOutOfStock = stock <= 0
                        return (
                          <li key={`${entry.stock_item_id}-${index}`} className={`tutorial-material-row${isOutOfStock ? ' out-of-stock' : ''}`}>
                            <div className="tutorial-material-row-info">
                              <strong>{material?.name || entry.stock_item_id}</strong>
                              <span>
                                {isOutOfStock
                                  ? <span className="material-badge agotado">Agotado</span>
                                  : `${stock} ${material?.unit || ''} disponibles`}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max={Math.max(stock, 1)}
                              value={entry.quantity}
                              disabled={isOutOfStock}
                              onChange={(event) => {
                                const value = Math.max(1, Number(event.target.value) || 1)
                                setForm((previous) => {
                                  const next = previous.requested_materials.slice()
                                  next[index] = { ...next[index], quantity: value }
                                  return { ...previous, requested_materials: next }
                                })
                              }}
                            />
                            <button
                              type="button"
                              className="tutorials-secondary"
                              onClick={() => {
                                setForm((previous) => ({
                                  ...previous,
                                  requested_materials: previous.requested_materials.filter((_, i) => i !== index),
                                }))
                              }}
                            >
                              Quitar
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <div className="tutorial-materials-add">
                    <select
                      value=""
                      onChange={(event) => {
                        const stockItemId = event.target.value
                        if (!stockItemId) return
                        setForm((previous) => {
                          if (previous.requested_materials.some((entry) => String(entry.stock_item_id) === String(stockItemId))) {
                            return previous
                          }
                          return {
                            ...previous,
                            requested_materials: [
                              ...previous.requested_materials,
                              { stock_item_id: String(stockItemId), quantity: 1 },
                            ],
                          }
                        })
                      }}
                    >
                      <option value="">Agregar material...</option>
                      {materialsCatalog
                        .filter((material) => !form.requested_materials.some((entry) => String(entry.stock_item_id) === String(material.id)))
                        .map((material) => {
                          const stock = Number(material.quantity_available || 0)
                          const out = stock <= 0
                          return (
                            <option key={material.id} value={material.id} disabled={out}>
                              {material.name}{out ? ' (Agotado)' : ` - ${stock} ${material.unit || ''}`}
                            </option>
                          )
                        })}
                    </select>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {validationMessage ? <p className="tutorials-inline-hint">{validationMessage}</p> : null}

              <div className="tutorials-actions">
                {editingSessionId ? (
                  <button type="button" className="tutorials-secondary" onClick={resetEditor}>
                    Cancelar edicion
                  </button>
                ) : null}
                <button type="submit" className="tutorials-primary" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? (editingSessionId ? 'Guardando...' : 'Publicando...') : (editingSessionId ? 'Guardar cambios' : 'Publicar tutoria')}
                </button>
              </div>
            </form>
          </div>
        </details>
      </section>

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Mis tutorias publicadas</h3>
          <p className="tutorials-panel-subtitle">
            Consulta sesiones vigentes y finalizadas. Desde cada tarjeta puedes tomar lista y registrar observaciones de desempeno por estudiante.
          </p>
        </div>

        {visibleSessions.length === 0 ? (
          <p className="tutorials-empty">Todavia no publicaste tutorias.</p>
        ) : (
          <div className="tutorials-grid">
            {visibleSessions.map((session) => {
              const { hasStarted, hasEnded } = getSessionTimeState(session, nowReference)
              return (
              <article key={session.id} className="tutorial-card tutor-card">
                <div className="tutorial-card-head">
                  <div>
                    <span className="tutorial-badge">
                      {hasEnded
                        ? 'Finalizada'
                        : session.approval_status === 'pending'
                          ? 'Pendiente de aprobacion'
                          : session.approval_status === 'rejected'
                            ? 'Rechazada'
                            : 'Aprobada'}
                    </span>
                    <h4>{session.topic}</h4>
                  </div>
                  <strong className="tutorial-seats">{session.enrolled_count}/{session.max_students}</strong>
                </div>

                <p className="tutorial-copy">{session.description || 'Sin descripcion adicional.'}</p>

                {session.approval_status === 'rejected' && session.approval_reason ? (
                  <p className="tutorials-inline-hint">
                    Motivo del rechazo: {session.approval_reason}
                  </p>
                ) : null}

                <div className="tutorial-meta">
                  <span>{session.session_date}</span>
                  <span>{session.start_time} - {session.end_time}</span>
                  <span>{session.location || 'Ubicacion por definir'}</span>
                </div>

                <div className="tutorial-enrolled-list">
                  <strong>Inscritos</strong>
                  <p>
                    {session.enrolled_count > 0
                      ? `${session.enrolled_count} estudiante(s) inscrito(s).`
                      : 'Aun no hay estudiantes registrados.'}
                  </p>
                </div>

                {session.tutor_observation ? (
                  <div className="tutorial-card-observation">
                    <strong>Observacion guardada</strong>
                    <p>{session.tutor_observation}</p>
                  </div>
                ) : null}

                <div className="tutorials-actions tutorial-card-actions">
                  <button
                    type="button"
                    className="tutorials-primary tutorial-card-primary-action"
                    onClick={() => handleOpenTutorialDetails(session.id)}
                  >
                    Tomar lista
                  </button>
                  <button
                    type="button"
                    className="tutorials-secondary tutorial-card-secondary-action"
                    disabled={hasStarted}
                    title={hasStarted ? 'No puedes editar una tutoria que ya inicio.' : undefined}
                    onClick={() => handleStartEditing(session)}
                  >
                    Editar bloque
                  </button>
                  <button
                    type="button"
                    className="tutorials-danger tutorial-card-danger-action"
                    disabled={deletingId === session.id}
                    onClick={() => handleDelete(session)}
                  >
                    {deletingId === session.id ? 'Eliminando...' : 'Eliminar bloque'}
                  </button>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </section>

      {focusedSession || isLoadingFocusedSession ? (
        <TutorialSessionDetailModal
          session={focusedSession}
          title="Tomar lista"
          showEnrollmentDetails
          observationDraft={observationDraft}
          onObservationDraftChange={(value) => setObservationDraft(String(value || '').slice(0, MAX_TUTOR_OBSERVATION_LENGTH))}
          onPrimaryAction={handleSaveAttendanceList}
          primaryActionLabel={isSavingAttendanceList ? 'Guardando lista...' : 'Guardar lista'}
          primaryActionDisabled={isSavingAttendanceList}
          observationHint="Desde aqui puedes marcar asistencia y registrar observaciones individuales por cada estudiante inscrito en la tutoria."
          attendanceDrafts={attendanceDrafts}
          onAttendanceDraftChange={handleAttendanceDraftChange}
          isSavingAttendanceList={isSavingAttendanceList}
          enrollmentDownloadActions={{
            onDownloadPdf: () => handleDownloadEnrolledPdf(focusedSession),
            onDownloadCsv: () => handleDownloadEnrolledCsv(focusedSession),
          }}
          onClose={() => {
            if (!isLoadingFocusedSession) {
              setFocusedSession(null)
            }
          }}
        />
      ) : null}
    </section>
  )
}

export default TutorTutorialSessionsPage
