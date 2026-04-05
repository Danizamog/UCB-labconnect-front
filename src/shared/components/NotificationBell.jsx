import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import './NotificationBell.css'

function formatNotificationDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function buildNotificationSummary(notification) {
  if (notification.type === 'tutorial_session_cancelled') {
    return `${notification.tutorial_date} · ${notification.tutorial_start_time} - ${notification.tutorial_end_time}`
  }

  if (notification.type === 'reservation_status_update' && notification.status === 'rejected') {
    return notification.cancel_reason ? `Motivo: ${notification.cancel_reason}` : 'Sin motivo registrado.'
  }

  if (notification.type === 'reservation_status_update' && notification.status === 'approved') {
    return `Programada: ${notification.start_date} · ${notification.start_time}`
  }

  if (notification.type === 'reservation_reminder') {
    return notification.reminder_kind === '30m' ? 'Empieza en 30 minutos' : 'Empieza en 24 horas'
  }

  if (notification.type === 'penalty_applied') {
    return notification.penalty_end_at ? `Bloqueada hasta ${notification.penalty_end_at}` : 'Reserva bloqueada temporalmente'
  }

  if (notification.type === 'penalty_lifted') {
    return 'Puedes volver a solicitar reservas'
  }

  return notification.message
}

function NotificationBell({
  notifications = [],
  unreadCount = 0,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const latestNotifications = useMemo(() => notifications.slice(0, 12), [notifications])

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-trigger"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label="Abrir notificaciones"
        aria-expanded={isOpen}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 ? <span className="notification-bell-count">{unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <section className="notification-bell-panel" aria-label="Historial de notificaciones">
          <header className="notification-bell-header">
            <div>
              <strong>Notificaciones</strong>
              <small>{unreadCount > 0 ? `${unreadCount} pendientes` : 'Todo al dia'}</small>
            </div>
            <button
              type="button"
              className="notification-bell-action"
              disabled={unreadCount === 0}
              onClick={async () => {
                await onMarkAllAsRead?.()
              }}
            >
              Marcar todo
            </button>
          </header>

          {latestNotifications.length === 0 ? (
            <p className="notification-bell-empty">Aun no tienes notificaciones.</p>
          ) : (
            <div className="notification-bell-list">
              {latestNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`notification-bell-item${notification.is_read ? '' : ' is-unread'}`}
                >
                  <button
                    type="button"
                    className="notification-bell-link"
                    onClick={async () => {
                      await onNotificationClick?.(notification)
                      setIsOpen(false)
                    }}
                  >
                    <div className="notification-bell-item-head">
                      <strong>{notification.title}</strong>
                      <small>{formatNotificationDate(notification.created_at)}</small>
                    </div>
                    <p>{notification.purpose || notification.message}</p>
                    <span className="notification-bell-summary">{buildNotificationSummary(notification)}</span>
                  </button>
                  {!notification.is_read ? (
                    <button
                      type="button"
                      className="notification-bell-mark"
                      onClick={async () => {
                        await onMarkAsRead?.(notification.id)
                      }}
                    >
                      Leer
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

export default NotificationBell
