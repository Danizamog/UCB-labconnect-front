import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getReservationById,
  listMyReservationHistoryPage,
  listReservations,
} from '../services/reservationsService'
import ReservationDetailModal from './ReservationDetailModal'
import './ReservationsPages.css'

const PAGE_SIZE = 8
const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  in_progress: 'En curso',
  completed: 'Completada',
  absent: 'Ausente',
}
const INCIDENT_STATUSES = new Set(['rejected', 'cancelled', 'absent'])

function buildReservationStart(reservation) {
  return new Date(`${reservation.date}T${reservation.start_time}:00`)
}

function compareReservationsByStartDesc(left, right) {
  return buildReservationStart(right).getTime() - buildReservationStart(left).getTime()
}

function isHistoricalReservation(reservation) {
  const endAt = new Date(`${reservation.date}T${reservation.end_time}:00`)
  if (!Number.isNaN(endAt.getTime()) && endAt.getTime() <= Date.now()) {
    return true
  }

  const startAt = buildReservationStart(reservation)
  return INCIDENT_STATUSES.has(reservation.status) && !Number.isNaN(startAt.getTime()) && startAt.getTime() <= Date.now()
}

function paginateReservationHistory(items, pageNumber) {
  const totalElements = items.length
  const totalPages = totalElements > 0 ? Math.ceil(totalElements / PAGE_SIZE) : 0
  const safePageNumber = totalPages === 0 ? 0 : Math.min(Math.max(pageNumber, 0), totalPages - 1)
  const startIndex = safePageNumber * PAGE_SIZE
  const paginatedItems = items.slice(startIndex, startIndex + PAGE_SIZE)

  return {
    items: paginatedItems,
    pageNumber: safePageNumber,
    pageSize: PAGE_SIZE,
    totalElements,
    totalPages,
  }
}

function buildReservationActionState() {
  return {
    hasStarted: true,
    withinTwoHours: false,
    canModify: false,
    canCancel: false,
  }
}

function formatUsageDate(value) {
  if (!value) {
    return 'Sin fecha registrada'
  }

  const normalized = String(value).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('es-BO', {
    dateStyle: 'full',
  })
}

function UserReservationHistoryPage({ user }) {
  const [historyItems, setHistoryItems] = useState([])
  const [pageMeta, setPageMeta] = useState({
    pageNumber: 0,
    pageSize: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [focusedReservationId, setFocusedReservationId] = useState('')
  const [focusedReservationDetails, setFocusedReservationDetails] = useState(null)
  const [isReservationDetailOpen, setIsReservationDetailOpen] = useState(false)
  const [isLoadingReservationDetails, setIsLoadingReservationDetails] = useState(false)
  const [isUsingFallbackData, setIsUsingFallbackData] = useState(false)

  const loadFallbackHistoryPage = useCallback(async (pageNumber = 0) => {
    const reservations = await listReservations({ requested_by: user?.user_id || '' })
    const history = reservations.filter(isHistoricalReservation).sort(compareReservationsByStartDesc)
    const page = paginateReservationHistory(history, pageNumber)

    setHistoryItems(page.items)
    setPageMeta({
      pageNumber: page.pageNumber,
      pageSize: page.pageSize,
      totalElements: page.totalElements,
      totalPages: page.totalPages,
    })
  }, [user?.user_id])

  const loadHistoryPage = useCallback(async (pageNumber = 0, options = {}) => {
    setIsLoading(true)
    try {
      const page = await listMyReservationHistoryPage(
        {
          pageNumber,
          pageSize: PAGE_SIZE,
          sortBy: 'start_at',
          sortType: 'DESC',
        },
        options,
      )
      setHistoryItems(Array.isArray(page.items) ? page.items : [])
      setPageMeta({
        pageNumber: Number(page.pageNumber || 0),
        pageSize: Number(page.pageSize || PAGE_SIZE),
        totalElements: Number(page.totalElements || 0),
        totalPages: Number(page.totalPages || 0),
      })
      setIsUsingFallbackData(false)
      setError('')
    } catch (err) {
      const normalizedMessage = String(err?.message || '')
      const canFallback = normalizedMessage.includes('404') || normalizedMessage.includes('503') || normalizedMessage.includes('Not Found')

      if (canFallback) {
        try {
          await loadFallbackHistoryPage(pageNumber)
          setIsUsingFallbackData(true)
          setError('')
          return
        } catch (fallbackError) {
          setError(fallbackError.message || 'No se pudo cargar tu historial de reservas.')
        }
      } else {
        setError(err.message || 'No se pudo cargar tu historial de reservas.')
      }

      setHistoryItems([])
      setPageMeta({ pageNumber, pageSize: PAGE_SIZE, totalElements: 0, totalPages: 0 })
      setIsUsingFallbackData(false)
    } finally {
      setIsLoading(false)
    }
  }, [loadFallbackHistoryPage])

  useEffect(() => {
    loadHistoryPage(0)
  }, [loadHistoryPage, user?.user_id])

  useEffect(() => {
    if (!focusedReservationId || !isReservationDetailOpen) {
      setFocusedReservationDetails(null)
      setIsLoadingReservationDetails(false)
      return
    }

    const localReservation = historyItems.find((item) => item.id === focusedReservationId)
    if (!localReservation) {
      setFocusedReservationId('')
      setFocusedReservationDetails(null)
      setIsLoadingReservationDetails(false)
    }
  }, [focusedReservationId, historyItems, isReservationDetailOpen])

  const handleOpenReservationDetails = async (reservation) => {
    if (!reservation?.id) {
      return
    }

    setFocusedReservationId(reservation.id)
    setFocusedReservationDetails(reservation)
    setIsReservationDetailOpen(true)
    setIsLoadingReservationDetails(true)

    try {
      const detail = await getReservationById(reservation.id)
      setFocusedReservationDetails(detail)
    } catch {
      setFocusedReservationDetails(reservation)
    } finally {
      setIsLoadingReservationDetails(false)
    }
  }

  const handleCloseReservationDetails = () => {
    setIsReservationDetailOpen(false)
    setFocusedReservationId('')
    setFocusedReservationDetails(null)
    setIsLoadingReservationDetails(false)
  }

  const focusedReservation = useMemo(
    () => focusedReservationDetails || historyItems.find((item) => item.id === focusedReservationId) || null,
    [focusedReservationDetails, focusedReservationId, historyItems],
  )

  const summary = useMemo(() => {
    const completedCount = historyItems.filter((item) => item.status === 'completed').length
    const incidentCount = historyItems.filter((item) => INCIDENT_STATUSES.has(item.status)).length
    const latestReservation = historyItems[0] || null

    return {
      completedCount,
      incidentCount,
      latestReservationDate: latestReservation?.date || '',
    }
  }, [historyItems])

  return (
    <section className="reservations-page" aria-label="Historial de reservas del usuario">
      <header className="reservations-header">
        <div className="reservation-history-page-copy">
          <p className="reservations-kicker">Mis reservas</p>
          <h2>Historial de reservas</h2>
          <p>
            Revisa cuando reservaste, que laboratorio te fue asignado y en que termino cada solicitud.
          </p>
        </div>
        <div className="reservations-summary">
          <div>
            <span>Total</span>
            <strong>{pageMeta.totalElements}</strong>
          </div>
          <div>
            <span>Completadas</span>
            <strong>{summary.completedCount}</strong>
          </div>
          <div>
            <span>Incidencias</span>
            <strong>{summary.incidentCount}</strong>
          </div>
        </div>
      </header>

      {error ? <p className="reservations-message error">{error}</p> : null}

      <section className="reservations-panel reservations-panel-secondary">
        <div className="reservation-history-toolbar">
          <div className="reservations-panel-header">
            <h3>Reservas pasadas</h3>
            <p className="reservations-panel-subtitle">
              Aqui veras solo reservas cuyo horario ya termino o solicitudes cerradas asociadas a una fecha pasada.
            </p>
            {isUsingFallbackData ? (
              <p className="reservations-panel-subtitle">
                Se esta usando el listado general de reservas como respaldo mientras el endpoint dedicado no esta disponible.
              </p>
            ) : null}
          </div>
          <p className="reservation-history-pagination-copy">
            Ultimo uso registrado: {summary.latestReservationDate ? formatUsageDate(summary.latestReservationDate) : 'Sin registros'}
          </p>
        </div>

        {isLoading && historyItems.length === 0 ? (
          <p className="reservations-empty">Cargando tu historial de reservas...</p>
        ) : null}

        {!isLoading && historyItems.length === 0 ? (
          <p className="reservations-empty">
            Aun no tienes reservas pasadas registradas. Cuando completes una reserva, aparecera aqui.
          </p>
        ) : null}

        {historyItems.length > 0 ? (
          <div className="reservation-card-grid">
            {historyItems.map((item) => (
              <article
                key={item.id}
                className={`reservation-user-card${focusedReservationId === item.id ? ' is-focused' : ''}`}
              >
                <div className="reservation-user-card-head">
                  <div>
                    <span className="reservation-user-card-kicker">Reserva pasada</span>
                    <h4>{item.laboratory_name || 'Laboratorio'}</h4>
                  </div>
                  <span className={`reservations-status ${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span>
                </div>

                <div className="reservation-user-card-meta">
                  <span>{formatUsageDate(item.date)}</span>
                  <span>{item.start_time} - {item.end_time}</span>
                  <span>{item.purpose || 'Sin motivo registrado'}</span>
                  {item.check_in_time || item.check_out_time ? (
                    <span>
                      Ingreso: {item.check_in_time || 'No registrado'} | Salida: {item.check_out_time || 'No registrada'}
                    </span>
                  ) : null}
                </div>

                {item.cancel_reason ? (
                  <p className="reservation-user-card-warning">Observacion: {item.cancel_reason}</p>
                ) : null}

                <div className="reservation-history-card-foot">
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
                    Este registro es solo de consulta y ya no admite acciones de edicion o cancelacion.
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {pageMeta.totalPages > 1 ? (
          <div className="reservations-pagination">
            <button
              type="button"
              className="reservations-secondary"
              onClick={() => loadHistoryPage(pageMeta.pageNumber - 1)}
              disabled={isLoading || pageMeta.pageNumber <= 0}
            >
              Anterior
            </button>
            <p className="reservation-history-pagination-copy">
              Pagina {pageMeta.pageNumber + 1} de {pageMeta.totalPages}
            </p>
            <button
              type="button"
              className="reservations-secondary"
              onClick={() => loadHistoryPage(pageMeta.pageNumber + 1)}
              disabled={isLoading || pageMeta.pageNumber >= pageMeta.totalPages - 1}
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </section>

      <ReservationDetailModal
        reservation={focusedReservation}
        actionState={buildReservationActionState()}
        isLoading={isLoadingReservationDetails}
        laboratoryName={focusedReservation?.laboratory_name || 'Laboratorio'}
        onClose={handleCloseReservationDetails}
        onEdit={() => {}}
        onCancel={() => {}}
      />
    </section>
  )
}

export default UserReservationHistoryPage