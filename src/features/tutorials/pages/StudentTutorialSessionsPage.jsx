import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import ucbEscudoLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import {
  cancelTutorialEnrollment,
  enrollInTutorialSession,
  listMyEnrolledTutorialSessions,
  listPublicTutorialSessions,
  subscribeTutorialSessionsRealtime,
} from '../services/tutorialSessionsService'
import { listAdminLabs as getLaboratories } from '../../admin/services/infrastructureService'
import { FOCUSED_TUTORIAL_KEY, OPEN_TUTORIAL_EVENT } from '../utils/focusTutorialNavigation'
import { Search, X } from 'lucide-react'
import './TutorialPages.css'

const CLOCK_REFRESH_MS = 30 * 1000
const PAGE_SIZE_OPTIONS = [6, 12, 24]
const MY_SESSIONS_PAGE_SIZE = 6

function normalizeFilePart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

function parseSessionDate(value) {
  if (!value) return null
  // Eliminar la 'Z' para evitar que JS lo convierta de UTC a hora local
  const normalizedValue = value.replace('Z', '')
  const parsed = new Date(normalizedValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getEnrollmentState(session, userId, referenceNow = new Date()) {
  const normalizedUserId = String(userId || '')
  const isOwnSession = session.tutor_id === normalizedUserId
  const isEnrolled = session.enrolled_students.some((student) => student.student_id === normalizedUserId)
  const isFull = session.seats_left <= 0
  
  const sessionStart = parseSessionDate(session?.start_at);
  const sessionEnd = parseSessionDate(session?.end_at);

  const hasStarted = Boolean(sessionStart) && sessionStart.getTime() <= referenceNow.getTime()
  const hasEnded = Boolean(sessionEnd) && sessionEnd.getTime() <= referenceNow.getTime()

  return {
    isOwnSession,
    isEnrolled,
    isFull,
    hasStarted,
    hasEnded,
    canEnroll: !isOwnSession && !isEnrolled && !isFull && !hasStarted && !hasEnded,
    canCancel: isEnrolled && !hasStarted && !hasEnded,
  }
}

function resolveCurrentEnrollment(session, user) {
  const normalizedUserId = String(user?.user_id || '')
  const enrolledStudents = Array.isArray(session?.enrolled_students) ? session.enrolled_students : []
  const currentEnrollment = enrolledStudents.find((student) => String(student?.student_id || '') === normalizedUserId) || null

  return {
    studentId: currentEnrollment?.student_id || normalizedUserId || '-',
    studentName: currentEnrollment?.student_name || user?.name || user?.username || 'Estudiante',
    studentEmail: currentEnrollment?.student_email || user?.email || user?.username || '-',
    enrolledAt: currentEnrollment?.created_at || session?.updated || session?.created || '',
  }
}

function buildReceiptQrPayload(session, enrollment) {
  return [
    'LABCONNECT_COMPROBANTE_TUTORIA',
    `estudiante=${enrollment.studentName || '-'}`,
    `correo=${enrollment.studentEmail || '-'}`,
    `codigo=${enrollment.studentId || '-'}`,
    `tutoria=${session?.topic || '-'}`,
    `laboratorio=${session?.location || 'Por definir'}`,
    `fecha=${session?.session_date || '-'}`,
    `horario=${session?.start_time || '-'} - ${session?.end_time || '-'}`,
    `tutor=${session?.tutor_name || '-'}`,
    `inscrito=${enrollment.enrolledAt || '-'}`,
  ].join('\n')
}

function StudentTutorialSessionsPage({ user }) {
  const [sessions, setSessions] = useState([])
  const [mySessions, setMySessions] = useState([])
  const [laboratories, setLaboratories] = useState([])
  const [filters, setFilters] = useState({
    topic_search: '',
    session_date: '',
    laboratory_id: '',
    status: 'all', // 'all', 'active', 'finished'
  })
  const [focusedSessionId, setFocusedSessionId] = useState('')
  const [enrollingId, setEnrollingId] = useState('')
  const [cancellingId, setCancellingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [clockTick, setClockTick] = useState(() => Date.now())
  const [publicPage, setPublicPage] = useState(0)
  const [publicPageSize, setPublicPageSize] = useState(PAGE_SIZE_OPTIONS[1])
  const [myPage, setMyPage] = useState(0)

  const loadPublicSessions = useCallback(async (currentFilters) => {
    try {
      const publicSessions = await listPublicTutorialSessions({
        topic_search: currentFilters?.topic_search,
        session_date: currentFilters?.session_date,
        laboratory_id: currentFilters?.laboratory_id,
      })
      setSessions(publicSessions)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la cartelera de tutorias.')
    }
  }, [])

  const loadLaboratories = useCallback(async () => {
    try {
      const labs = await getLaboratories()
      setLaboratories(labs.filter((l) => l.is_active !== false))
    } catch {
      // ignore
    }
  }, [])

  const loadMyEnrollments = useCallback(async () => {
    try {
      const enrolledSessions = await listMyEnrolledTutorialSessions()
      setMySessions(enrolledSessions)
    } catch {
      // ignore — la cartelera publica sigue siendo util sin las inscripciones
    }
  }, [])

  const publicReloadTimerRef = useRef(null)
  const myReloadTimerRef = useRef(null)
  const filtersRef = useRef(filters)
  const loadPublicSessionsRef = useRef(loadPublicSessions)
  const loadMyEnrollmentsRef = useRef(loadMyEnrollments)

  useEffect(() => { filtersRef.current = filters }, [filters])
  useEffect(() => { loadPublicSessionsRef.current = loadPublicSessions }, [loadPublicSessions])
  useEffect(() => { loadMyEnrollmentsRef.current = loadMyEnrollments }, [loadMyEnrollments])

  // Labs cambian raramente: una sola carga.
  useEffect(() => { loadLaboratories() }, [loadLaboratories])

  // Mis inscripciones: una carga inicial; el realtime las refresca despues.
  useEffect(() => { loadMyEnrollments() }, [loadMyEnrollments])

  // Cartelera publica: debounce de la busqueda; fecha/lab refrescan apenas cambian.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadPublicSessions({
        topic_search: filters.topic_search,
        session_date: filters.session_date,
        laboratory_id: filters.laboratory_id,
      })
    }, filters.topic_search ? 350 : 0)
    return () => window.clearTimeout(handle)
  }, [filters.topic_search, filters.session_date, filters.laboratory_id, loadPublicSessions])

  // Realtime: solo se suscribe cuando cambia el usuario. Los reloads usan refs
  // para no resuscribir en cada cambio de filtro.
  useEffect(() => {
    const userId = String(user?.user_id || '')
    const schedulePublicReload = () => {
      window.clearTimeout(publicReloadTimerRef.current)
      publicReloadTimerRef.current = window.setTimeout(() => {
        loadPublicSessionsRef.current?.({
          topic_search: filtersRef.current.topic_search,
          session_date: filtersRef.current.session_date,
          laboratory_id: filtersRef.current.laboratory_id,
        })
      }, 1000)
    }
    const scheduleMyReload = () => {
      window.clearTimeout(myReloadTimerRef.current)
      myReloadTimerRef.current = window.setTimeout(() => {
        loadMyEnrollmentsRef.current?.()
      }, 1000)
    }

    const unsubscribe = subscribeTutorialSessionsRealtime((event) => {
      if (event?.topic === 'tutorial_session') {
        schedulePublicReload()
        if (!userId) return
        const tutorId = String(event?.record?.tutor_id || '')
        const enrolled = Array.isArray(event?.record?.enrolled_students) ? event.record.enrolled_students : []
        const concerns = tutorId === userId
          || enrolled.some((student) => String(student?.student_id || '') === userId)
        if (concerns) scheduleMyReload()
        return
      }

      if (event?.topic === 'user_notification') {
        const recipients = Array.isArray(event?.recipients) ? event.recipients : []
        const isCurrentUserNotification =
          event?.record?.recipient_user_id === userId || recipients.includes(userId)
        if (isCurrentUserNotification) scheduleMyReload()
      }
    })

    return () => {
      window.clearTimeout(publicReloadTimerRef.current)
      window.clearTimeout(myReloadTimerRef.current)
      unsubscribe?.()
    }
  }, [user?.user_id])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now())
    }, CLOCK_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const applyFocus = (sessionId) => {
      const normalizedId = String(sessionId || '').trim()
      if (!normalizedId) {
        return
      }
      setFocusedSessionId(normalizedId)
      localStorage.removeItem(FOCUSED_TUTORIAL_KEY)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const storedId = localStorage.getItem(FOCUSED_TUTORIAL_KEY)
    if (storedId) {
      applyFocus(storedId)
    }

    const handleOpenTutorial = (event) => {
      applyFocus(event?.detail?.sessionId)
    }

    window.addEventListener(OPEN_TUTORIAL_EVENT, handleOpenTutorial)
    return () => {
      window.removeEventListener(OPEN_TUTORIAL_EVENT, handleOpenTutorial)
    }
  }, [])

  const allKnownSessions = useMemo(() => {
    const sessionMap = new Map()
    ;[...mySessions, ...sessions].forEach((session) => {
      sessionMap.set(session.id, session)
    })
    return Array.from(sessionMap.values())
  }, [mySessions, sessions])

  const focusedSession = useMemo(
    () => allKnownSessions.find((session) => session.id === focusedSessionId) || null,
    [allKnownSessions, focusedSessionId],
  )

  const nowReference = useMemo(() => new Date(clockTick), [clockTick])

  const filteredSessions = useMemo(() => {
    let result = [...sessions]

    if (filters.status === 'active') {
      result = result.filter((s) => {
        const endAt = parseSessionDate(s.end_at)
        return endAt && endAt.getTime() > nowReference.getTime()
      })
    } else if (filters.status === 'finished') {
      result = result.filter((s) => {
        const endAt = parseSessionDate(s.end_at)
        return endAt && endAt.getTime() <= nowReference.getTime()
      })
    }

    return result.sort((a, b) => {
      const dateA = parseSessionDate(a.start_at)
      const dateB = parseSessionDate(b.start_at)
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0)
    })
  }, [sessions, filters.status, nowReference])

  const availableSessions = useMemo(
    () => filteredSessions.filter((session) => session.is_published),
    [filteredSessions],
  )

  const publicTotalPages = Math.max(1, Math.ceil(availableSessions.length / publicPageSize))
  const safePublicPage = Math.min(publicPage, publicTotalPages - 1)
  const visibleAvailableSessions = useMemo(() => {
    const start = safePublicPage * publicPageSize
    return availableSessions.slice(start, start + publicPageSize)
  }, [availableSessions, safePublicPage, publicPageSize])

  const myTotalPages = Math.max(1, Math.ceil(mySessions.length / MY_SESSIONS_PAGE_SIZE))
  const safeMyPage = Math.min(myPage, myTotalPages - 1)
  const visibleMySessions = useMemo(() => {
    const start = safeMyPage * MY_SESSIONS_PAGE_SIZE
    return mySessions.slice(start, start + MY_SESSIONS_PAGE_SIZE)
  }, [mySessions, safeMyPage])

  useEffect(() => {
    setPublicPage(0)
  }, [filters.topic_search, filters.session_date, filters.laboratory_id, filters.status, publicPageSize])

  const visibleAvailableStates = useMemo(() => {
    const map = new Map()
    visibleAvailableSessions.forEach((session) => {
      map.set(session.id, getEnrollmentState(session, user?.user_id, nowReference))
    })
    return map
  }, [visibleAvailableSessions, user?.user_id, nowReference])

  const visibleMyStates = useMemo(() => {
    const map = new Map()
    visibleMySessions.forEach((session) => {
      map.set(session.id, getEnrollmentState(session, user?.user_id, nowReference))
    })
    return map
  }, [visibleMySessions, user?.user_id, nowReference])

  const focusedState = useMemo(
    () => (focusedSession ? getEnrollmentState(focusedSession, user?.user_id, nowReference) : null),
    [focusedSession, nowReference, user?.user_id],
  )

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleResetFilters = () => {
    setFilters({ topic_search: '', session_date: '', laboratory_id: '', status: 'all' })
  }

  const handleEnroll = async (session) => {
    setEnrollingId(session.id)
    setError('')
    setMessage('')

    try {
      await enrollInTutorialSession(session.id)
      setMessage('Inscripcion realizada correctamente. Ya tienes tu cupo reservado en la tutoria.')
      setFocusedSessionId(session.id)
      await Promise.all([
        loadPublicSessions({
          topic_search: filtersRef.current.topic_search,
          session_date: filtersRef.current.session_date,
          laboratory_id: filtersRef.current.laboratory_id,
        }),
        loadMyEnrollments(),
      ])
    } catch (err) {
      setError(err.message || 'No se pudo completar la inscripcion.')
    } finally {
      setEnrollingId('')
    }
  }

  const handleCancelEnrollment = async (session) => {
    setCancellingId(session.id)
    setError('')
    setMessage('')

    try {
      await cancelTutorialEnrollment(session.id)
      setMessage('Tu asistencia fue cancelada y el cupo se libero automaticamente para otros estudiantes.')
      await Promise.all([
        loadPublicSessions({
          topic_search: filtersRef.current.topic_search,
          session_date: filtersRef.current.session_date,
          laboratory_id: filtersRef.current.laboratory_id,
        }),
        loadMyEnrollments(),
      ])
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la asistencia a la tutoria.')
    } finally {
      setCancellingId('')
    }
  }

  const handleDownloadEnrollmentReceipt = useCallback(async (session) => {
    if (!session) return

    const enrollment = resolveCurrentEnrollment(session, user)
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const marginX = 44
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = pageWidth - (marginX * 2)
    let cursorY = 54

    const writeLine = (label, value, options = {}) => {
      const { muted = false, multiline = false } = options
      const text = `${label}: ${value || '-'}`
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(19, 33, 68)
      doc.text(label + ':', marginX, cursorY)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(muted ? 96 : 36, muted ? 112 : 52, muted ? 138 : 82)
      if (multiline) {
        const lines = doc.splitTextToSize(String(value || '-'), contentWidth - 110)
        doc.text(lines, marginX + 110, cursorY)
        cursorY += (lines.length * 14) + 8
        return
      }

      doc.text(String(value || '-'), marginX + 110, cursorY)
      cursorY += 20
    }

    const drawFooter = () => {
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
      // El comprobante sigue siendo valido aunque no cargue el logo.
    }

    let qrDataUrl = ''
    try {
      qrDataUrl = await QRCode.toDataURL(buildReceiptQrPayload(session, enrollment), {
        margin: 1,
        width: 220,
        color: {
          dark: '#0A3559',
          light: '#FFFFFF',
        },
      })
    } catch {
      qrDataUrl = ''
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text('Comprobante de Inscripcion a Tutoria', marginX + 56, 38)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text('LabConnect - Soporte Academico', marginX + 56, 58)

    cursorY = 120

    doc.setFillColor(248, 251, 255)
    doc.roundedRect(marginX, cursorY - 18, contentWidth, 84, 16, 16, 'F')
    doc.setDrawColor(220, 230, 240)
    doc.roundedRect(marginX, cursorY - 18, contentWidth, 84, 16, 16)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(10, 53, 89)
    doc.text(session.topic || 'Tutoria', marginX + 18, cursorY + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(63, 85, 108)
    doc.text(`Tutor: ${session.tutor_name || '-'}`, marginX + 18, cursorY + 30)
    doc.text(`Laboratorio: ${session.location || 'Por definir'}`, marginX + 18, cursorY + 48)
    doc.text(`Horario exacto: ${session.session_date || '-'} | ${session.start_time || '-'} - ${session.end_time || '-'}`, marginX + 18, cursorY + 66)

    cursorY += 92
    writeLine('Estudiante', enrollment.studentName)
    writeLine('Correo', enrollment.studentEmail)
    writeLine('Codigo', enrollment.studentId)
    writeLine('Tutoria', session.topic || '-')
    writeLine('Laboratorio asignado', session.location || 'Por definir')
    writeLine('Fecha', session.session_date || '-')
    writeLine('Horario', `${session.start_time || '-'} - ${session.end_time || '-'}`)
    writeLine('Tutor responsable', session.tutor_name || '-')
    writeLine('Inscripcion registrada', enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleString('es-BO') : '-')
    writeLine('Estado', 'Inscripcion confirmada')

    cursorY += 10
    if (qrDataUrl) {
      const qrBoxY = cursorY - 2
      const qrBoxHeight = 152
      doc.setFillColor(248, 251, 255)
      doc.roundedRect(marginX, qrBoxY, contentWidth, qrBoxHeight, 14, 14, 'F')
      doc.setDrawColor(220, 230, 240)
      doc.roundedRect(marginX, qrBoxY, contentWidth, qrBoxHeight, 14, 14)
      doc.addImage(qrDataUrl, 'PNG', marginX + 14, qrBoxY + 16, 96, 96)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(10, 53, 89)
      doc.text('QR de verificacion del comprobante', marginX + 126, qrBoxY + 30)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(63, 85, 108)
      const qrHelpLines = doc.splitTextToSize(
        'Al escanearlo se muestran los datos clave de esta inscripcion para validacion rapida del estudiante, laboratorio y horario.',
        contentWidth - 144,
      )
      doc.text(qrHelpLines, marginX + 126, qrBoxY + 50)
      cursorY += qrBoxHeight + 10
    }

    doc.setFillColor(255, 248, 225)
    doc.roundedRect(marginX, cursorY - 6, contentWidth, 58, 12, 12, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(122, 85, 0)
    doc.text('Presenta este comprobante al ingresar a la tutoria.', marginX + 14, cursorY + 14)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(110, 84, 12)
    const noteLines = doc.splitTextToSize('Verifica que el nombre del estudiante, el laboratorio asignado y los horarios exactos coincidan con la sesion programada.', contentWidth - 28)
    doc.text(noteLines, marginX + 14, cursorY + 30)

    drawFooter()

    const fileSafeTopic = normalizeFilePart(session.topic) || 'tutoria'
    const fileSafeDate = normalizeFilePart(session.session_date) || 'fecha'
    doc.save(`comprobante-tutoria-${fileSafeTopic}-${fileSafeDate}.pdf`)
    setMessage('Comprobante de inscripcion descargado en PDF.')
    setError('')
  }, [user])

  return (
    <section className="tutorials-page tutorials-page-student" aria-label="Tutorias disponibles">
      <header className="tutorials-header">
        <div>
          <p className="tutorials-kicker">Apoyo academico</p>
          <h2>Apoyo y tutorias</h2>
          <p>Encuentra sesiones disponibles, revisa cupos y registrate en la que mejor encaje con tu horario.</p>
        </div>
        <div className="tutorials-summary">
          <div><span>Disponibles</span><strong>{availableSessions.length}</strong></div>
          <div><span>Mis tutorias</span><strong>{mySessions.length}</strong></div>
        </div>
      </header>

      {message ? <p className="tutorials-message success">{message}</p> : null}
      {error ? <p className="tutorials-message error">{error}</p> : null}

      {focusedSession ? (
        <section className="tutorials-panel tutorial-focus-panel">
          <div className="tutorials-panel-header">
            <h3>Tutoria destacada</h3>
            <p className="tutorials-panel-subtitle">
              Aqui se enfoca la sesion seleccionada desde el calendario, las notificaciones o tu panel de tutorias.
            </p>
          </div>

          <div className="tutorial-focus-hero">
            <div className="tutorial-focus-hero-copy">
              <span className="tutorial-badge">Sesion recomendada</span>
              <h4>{focusedSession.topic}</h4>
              <p>{focusedSession.description || 'Sesion pensada para reforzar contenidos y resolver dudas academicas con apoyo del tutor.'}</p>
            </div>
            <div className="tutorial-focus-hero-side">
              <span className="tutorial-focus-chip">{focusedSession.location || 'Laboratorio por definir'}</span>
              <strong>{focusedSession.seats_left} cupos disponibles</strong>
            </div>
          </div>

          <div className="tutorial-focus-grid">
            <div className="tutorial-focus-card">
              <span>Tutor</span>
              <strong>{focusedSession.tutor_name}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Horario</span>
              <strong>{focusedSession.session_date} | {focusedSession.start_time} - {focusedSession.end_time}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Cupos</span>
              <strong>{focusedSession.enrolled_count} / {focusedSession.max_students}</strong>
            </div>
            <div className="tutorial-focus-card">
              <span>Disponibles</span>
              <strong>{focusedSession.seats_left}</strong>
            </div>
          </div>

          <div className="tutorial-focus-copy">
            <p><strong>Ubicacion:</strong> {focusedSession.location || 'Por definir'}</p>
            <p><strong>Descripcion:</strong> {focusedSession.description || 'Sin descripcion adicional.'}</p>
          </div>

          <div className="tutorial-focus-actions">
            {focusedState?.isOwnSession ? (
              <button type="button" className="tutorials-secondary" disabled>
                Es tu tutoria
              </button>
            ) : focusedState?.canCancel ? (
              <>
                <button
                  type="button"
                  className="tutorials-secondary"
                  onClick={() => handleDownloadEnrollmentReceipt(focusedSession)}
                >
                  Descargar comprobante PDF
                </button>
                <button
                  type="button"
                  className="tutorials-danger"
                  disabled={cancellingId === focusedSession.id}
                  onClick={() => handleCancelEnrollment(focusedSession)}
                >
                  {cancellingId === focusedSession.id ? 'Cancelando...' : 'Cancelar asistencia'}
                </button>
              </>
            ) : focusedState?.isEnrolled ? (
              <>
                <button
                  type="button"
                  className="tutorials-secondary"
                  onClick={() => handleDownloadEnrollmentReceipt(focusedSession)}
                >
                  Descargar comprobante PDF
                </button>
                <button type="button" className="tutorials-secondary" disabled>
                  {focusedState.hasStarted ? 'Tutoria en curso' : 'Ya inscrito'}
                </button>
              </>
            ) : focusedState?.hasStarted ? (
              <button type="button" className="tutorials-secondary" disabled>
                Sesion iniciada
              </button>
            ) : (
              <button
                type="button"
                className="tutorials-primary"
                disabled={!focusedState?.canEnroll || enrollingId === focusedSession.id}
                onClick={() => handleEnroll(focusedSession)}
              >
                {enrollingId === focusedSession.id ? 'Inscribiendo...' : focusedState?.isFull ? 'Sin cupos' : 'Inscribirme ahora'}
              </button>
            )}
          </div>
        </section>
      ) : null}

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Mis tutorias</h3>
          <p className="tutorials-panel-subtitle">
            Aqui ves las sesiones donde ya reservaste cupo. Si todavia no empiezan, puedes cancelar tu asistencia y liberar el cupo.
          </p>
        </div>

        {mySessions.length === 0 ? (
          <p className="tutorials-empty">Todavia no reservaste cupos en tutorias. Cuando te inscribas, tus sesiones apareceran aqui.</p>
        ) : (
          <>
          <div className="tutorials-grid">
            {visibleMySessions.map((session) => {
              const sessionState = visibleMyStates.get(session.id)
                ?? getEnrollmentState(session, user?.user_id, nowReference)

              return (
                <article key={session.id} className="tutorial-card is-enrolled">
                  <div className="tutorial-card-head">
                    <div>
                      <span className="tutorial-badge">Mi tutoria</span>
                      <h4>{session.topic}</h4>
                    </div>
                    <strong className="tutorial-seats">{session.seats_left} cupos libres</strong>
                  </div>

                  <div className="tutorial-card-facts">
                    <span>{session.tutor_name}</span>
                    <span>{session.session_date}</span>
                    <span>{session.start_time} - {session.end_time}</span>
                    <span>{session.location || 'Ubicacion por definir'}</span>
                  </div>

                  <div className="tutorial-meta">
                    <span>Inscritos: {session.enrolled_count} de {session.max_students}</span>
                    <span className={`tutorial-status-pill${sessionState.hasStarted ? ' active' : ''}`}>
                      {sessionState.hasStarted ? 'Tutoria en curso' : 'Reserva confirmada'}
                    </span>
                  </div>

                  <div className="tutorial-card-action-row">
                    <button
                      type="button"
                      className="tutorials-secondary"
                      onClick={() => handleDownloadEnrollmentReceipt(session)}
                    >
                      Descargar PDF
                    </button>

                    <button
                      type="button"
                      className="tutorials-secondary"
                      onClick={() => {
                        setFocusedSessionId(session.id)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Ver detalle
                    </button>

                    {sessionState.canCancel ? (
                      <button
                        type="button"
                        className="tutorials-danger"
                        disabled={cancellingId === session.id}
                        onClick={() => handleCancelEnrollment(session)}
                      >
                        {cancellingId === session.id ? 'Cancelando...' : 'Cancelar asistencia'}
                      </button>
                    ) : (
                      <button type="button" className="tutorials-secondary" disabled>
                        {sessionState.hasStarted ? 'Tutoria iniciada' : 'Asistencia registrada'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          {mySessions.length > MY_SESSIONS_PAGE_SIZE ? (
            <div className="tutorials-pagination">
              <span className="tutorials-pagination-info">
                Página {safeMyPage + 1} de {myTotalPages} — {mySessions.length} tutoria{mySessions.length === 1 ? '' : 's'} reservada{mySessions.length === 1 ? '' : 's'}
              </span>
              <div className="tutorials-pagination-controls">
                <button
                  type="button"
                  onClick={() => setMyPage((prev) => Math.max(prev - 1, 0))}
                  disabled={safeMyPage <= 0}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setMyPage((prev) => Math.min(prev + 1, myTotalPages - 1))}
                  disabled={safeMyPage + 1 >= myTotalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>

      <section className="tutorials-panel">
        <div className="tutorials-panel-header">
          <h3>Cartelera publica</h3>
          <p className="tutorials-panel-subtitle">
            Explora todas las tutorias publicadas y reserva tu cupo solo en sesiones futuras con capacidad disponible.
          </p>
        </div>

        <div className="tutorials-toolbar">
          <div className="tutorials-search-row">
            <label className="tutorials-search-field">
              <span className="tutorials-search-icon">
                <Search size={16} />
              </span>
              <input
                type="search"
                value={filters.topic_search}
                onChange={(event) => handleFilterChange('topic_search', event.target.value)}
                placeholder="Buscar por tema o descripción..."
                aria-label="Buscar tutoria por tema"
              />
            </label>
            <button type="button" className="tutorials-reset-button" onClick={handleResetFilters} title="Limpiar filtros">
              <X size={16} />
              <span>Limpiar</span>
            </button>
          </div>

          <div className="tutorials-filters-row">
            <div className="tutorials-filter-group">
              <div className="tutorials-filter-item">
                <label htmlFor="filter-date">Fecha</label>
                <input
                  id="filter-date"
                  type="date"
                  value={filters.session_date}
                  onChange={(event) => handleFilterChange('session_date', event.target.value)}
                />
              </div>

              <div className="tutorials-filter-item">
                <label htmlFor="filter-lab">Laboratorio</label>
                <select
                  id="filter-lab"
                  value={filters.laboratory_id}
                  onChange={(event) => handleFilterChange('laboratory_id', event.target.value)}
                >
                  <option value="">Todos los laboratorios</option>
                  {laboratories.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tutorials-status-filters">
              <button
                type="button"
                className={`tutorials-status-chip ${filters.status === 'all' ? 'is-active' : ''}`}
                onClick={() => handleFilterChange('status', 'all')}
              >
                Todas
              </button>
              <button
                type="button"
                className={`tutorials-status-chip ${filters.status === 'active' ? 'is-active' : ''}`}
                onClick={() => handleFilterChange('status', 'active')}
              >
                Activas
              </button>
              <button
                type="button"
                className={`tutorials-status-chip ${filters.status === 'finished' ? 'is-active' : ''}`}
                onClick={() => handleFilterChange('status', 'finished')}
              >
                Finalizadas
              </button>
            </div>
          </div>
        </div>

        {availableSessions.length === 0 ? (
          <p className="tutorials-empty">No hay tutorias publicadas por el momento.</p>
        ) : (
          <>
          <div className="tutorials-grid">
            {visibleAvailableSessions.map((session) => {
              const isFocused = focusedSessionId === session.id
              const sessionState = visibleAvailableStates.get(session.id)
                ?? getEnrollmentState(session, user?.user_id, nowReference)

              return (
                <article
                  key={session.id}
                  className={`tutorial-card${isFocused ? ' is-focused' : ''}`}
                >
                  <div className="tutorial-card-head">
                    <div>
                      <span className="tutorial-badge">Tutorias</span>
                      <h4>{session.topic}</h4>
                    </div>
                    <strong className="tutorial-seats">{session.seats_left} cupos</strong>
                  </div>

                  <p className="tutorial-copy">{session.description || 'Sesion abierta para resolver dudas y reforzar contenidos.'}</p>

                  <div className="tutorial-card-facts">
                    <span>{session.tutor_name}</span>
                    <span>{session.session_date}</span>
                    <span>{session.start_time} - {session.end_time}</span>
                    <span>{session.location || 'Ubicacion por definir'}</span>
                  </div>

                  <div className="tutorial-meta">
                    <span>Inscritos: {session.enrolled_count} de {session.max_students}</span>
                    <span>{session.seats_left} cupos disponibles</span>
                  </div>

                  <div className="tutorial-card-action-row">
                    <button
                      type="button"
                      className="tutorials-secondary"
                      onClick={() => {
                        setFocusedSessionId(session.id)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      Ver detalle
                    </button>

                    {sessionState.isOwnSession ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        Es tu tutoria
                      </button>
                    ) : sessionState.canCancel ? (
                      <button
                        type="button"
                        className="tutorials-danger"
                        disabled={cancellingId === session.id}
                        onClick={() => handleCancelEnrollment(session)}
                      >
                        {cancellingId === session.id ? 'Cancelando...' : 'Cancelar asistencia'}
                      </button>
                    ) : sessionState.isEnrolled ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        {sessionState.hasStarted ? 'Tutoria iniciada' : 'Ya inscrito'}
                      </button>
                    ) : sessionState.hasStarted ? (
                      <button type="button" className="tutorials-secondary" disabled>
                        Sesion iniciada
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tutorials-primary"
                        disabled={!sessionState.canEnroll || enrollingId === session.id}
                        onClick={() => handleEnroll(session)}
                      >
                        {enrollingId === session.id ? 'Inscribiendo...' : sessionState.isFull ? 'Sin cupos' : 'Inscribirme'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          {availableSessions.length > publicPageSize ? (
            <div className="tutorials-pagination">
              <span className="tutorials-pagination-info">
                Página {safePublicPage + 1} de {publicTotalPages} — {availableSessions.length} tutoria{availableSessions.length === 1 ? '' : 's'}
              </span>
              <div className="tutorials-pagination-controls">
                <label>
                  <span className="visually-hidden">Tutorias por página</span>
                  <select
                    value={publicPageSize}
                    onChange={(event) => setPublicPageSize(Number(event.target.value) || PAGE_SIZE_OPTIONS[1])}
                    aria-label="Tutorias por página"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} por página</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setPublicPage((prev) => Math.max(prev - 1, 0))}
                  disabled={safePublicPage <= 0}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPublicPage((prev) => Math.min(prev + 1, publicTotalPages - 1))}
                  disabled={safePublicPage + 1 >= publicTotalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>
    </section>
  )
}

export default StudentTutorialSessionsPage
