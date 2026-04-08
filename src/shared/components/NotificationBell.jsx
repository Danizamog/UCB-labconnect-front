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
    return `${notification.tutorial_date} | ${notification.tutorial_start_time} - ${notification.tutorial_end_time}`
  }

  if (notification.type === 'tutorial_session_updated') {
    return notification.change_kinds?.includes('schedule')
      ? `${notification.new_tutorial_date} | ${notification.new_tutorial_time_range}`
      : notification.message
  }

  if (notification.type === 'reservation_schedule_change') {
    return notification.change_kinds?.includes('schedule')
      ? `${notification.new_date} | ${notification.new_time_range}`
      : notification.message
  }

  if (notification.type === 'reservation_status_update' && notification.status === 'rejected') {
    return notification.cancel_reason ? `Motivo: ${notification.cancel_reason}` : 'Sin motivo registrado.'
  }

  if (notification.type === 'reservation_status_update' && notification.status === 'approved') {
    return `Programada: ${notification.start_date} | ${notification.start_time}`
  }

  if (notification.type === 'reservation_reminder') {
    return notification.reminder_kind === '30m' ? 'Empieza en 30 minutos' : 'Empieza en 24 horas'
  }

  if (notification.type === 'tutorial_reminder') {
    return notification.reminder_kind === '30m' ? 'La tutoria empieza en 30 minutos' : 'La tutoria empieza en 24 horas'
  }

  if (notification.type === 'penalty_applied') {
    return notification.penalty_end_at ? `Bloqueada hasta ${notification.penalty_end_at}` : 'Reserva bloqueada temporalmente'
  }

  if (notification.type === 'penalty_lifted') {
    return 'Puedes volver a solicitar reservas'
  }

  return notification.message
}

function NotificationChangePreview({ label, oldValue, newValue }) {
  if (!oldValue && !newValue) {
    return null
  }

  return (
    <div className="notification-bell-change-row">
      <span>{label}</span>
      <div className="notification-bell-change-values">
        {oldValue ? <strong className="notification-bell-old">{oldValue}</strong> : null}
        {newValue ? <strong className="notification-bell-new">{newValue}</strong> : null}
      </div>
    </div>
  )
}

function renderReminderDetails(notification) {
  if (notification.type !== 'reservation_reminder' && notification.type !== 'tutorial_reminder') {
    return null
  }

  const startsAt = [notification.reminder_date, notification.reminder_time].filter(Boolean).join(' | ')
  const location =
    notification.type === 'tutorial_reminder'
      ? notification.reminder_location || notification.reminder_laboratory_id || 'Sin ubicacion'
      : notification.reminder_location || notification.reminder_laboratory_id || 'Sin laboratorio'

  return (
    <div className="notification-bell-change-card">
      <NotificationChangePreview label="Comienza" newValue={startsAt} />
      <NotificationChangePreview
        label={notification.type === 'tutorial_reminder' ? 'Ubicacion' : 'Laboratorio'}
        newValue={location}
      />
      {notification.type === 'tutorial_reminder' ? (
        <NotificationChangePreview label="Tutor" newValue={notification.reminder_tutor_name || 'Tutor asignado'} />
      ) : null}
      <NotificationChangePreview
        label="Ventana"
        newValue={notification.reminder_kind === '30m' ? 'Faltan 30 minutos' : 'Faltan 24 horas'}
      />
    </div>
  )
}

function renderNotificationChangeDetails(notification) {
  if (notification.type === 'reservation_schedule_change') {
    return (
      <div className="notification-bell-change-card">
        {notification.change_kinds?.includes('schedule') ? (
          <NotificationChangePreview
            label="Horario"
            oldValue={[notification.old_date, notification.old_time_range].filter(Boolean).join(' | ')}
            newValue={[notification.new_date, notification.new_time_range].filter(Boolean).join(' | ')}
          />
        ) : null}
        {notification.change_kinds?.includes('location') ? (
          <NotificationChangePreview
            label="Laboratorio"
            oldValue={notification.old_laboratory_id}
            newValue={notification.new_laboratory_id}
          />
        ) : null}
      </div>
    )
  }

  if (notification.type === 'tutorial_session_updated') {
    return (
      <div className="notification-bell-change-card">
        {notification.change_kinds?.includes('schedule') ? (
          <NotificationChangePreview
            label="Horario"
            oldValue={[notification.old_tutorial_date, notification.old_tutorial_time_range].filter(Boolean).join(' | ')}
            newValue={[notification.new_tutorial_date, notification.new_tutorial_time_range].filter(Boolean).join(' | ')}
          />
        ) : null}
        {notification.change_kinds?.includes('location') ? (
          <NotificationChangePreview
            label="Laboratorio"
            oldValue={notification.old_tutorial_location}
            newValue={notification.new_tutorial_location}
          />
        ) : null}
        {notification.change_kinds?.includes('tutor') ? (
          <NotificationChangePreview
            label="Tutor"
            oldValue={notification.old_tutor_name}
            newValue={notification.new_tutor_name}
          />
        ) : null}
      </div>
    )
  }

  return null
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

  const visibleNotifications = useMemo(() => notifications, [notifications])

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

          {visibleNotifications.length === 0 ? (
            <p className="notification-bell-empty">Aun no tienes notificaciones.</p>
          ) : (
            <div className="notification-bell-list">
              {visibleNotifications.map((notification) => (
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
                    {renderReminderDetails(notification)}
                    {renderNotificationChangeDetails(notification)}
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
