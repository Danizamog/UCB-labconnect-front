type SidebarItem = {
  key: string;
  label: string;
  icon?: string;
};

type Props = {
  title: string;
  subtitle: string;
  items: SidebarItem[];
  activeKey: string;
  onChange: (key: string) => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  roleLabel?: string;
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({
  title,
  subtitle,
  items,
  activeKey,
  onChange,
  onLogout,
  userName,
  userEmail,
  roleLabel,
  collapsed,
  onToggle,
}: Props) {
  const initials = userName
    ? userName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand">
            <span className="sidebar-brand-dot" />
            {!collapsed && <span>UCB LabConnect</span>}
          </div>

          <button className="sidebar-toggle" onClick={onToggle} type="button">
            {collapsed ? "☰" : "✕"}
          </button>
        </div>

        {!collapsed && (
          <p className="sidebar-description">
            {title}
            <br />
            <small>{subtitle}</small>
          </p>
        )}
      </div>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>

        {!collapsed && (
          <div className="sidebar-user-info">
            <strong>{userName || "Usuario"}</strong>
            {userEmail && <span>{userEmail}</span>}
            {roleLabel && <small>{roleLabel}</small>}
          </div>
        )}
      </div>

      <div>
        {!collapsed && <div className="sidebar-section-title">Menú principal</div>}
        <div className="sidebar-nav">
          {items.map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${activeKey === item.key ? "active" : ""}`}
              onClick={() => onChange(item.key)}
              type="button"
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-link-icon">{item.icon || "•"}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        {!collapsed && <div className="sidebar-section-title">Cuenta</div>}
        <div className="sidebar-nav">
          <button
            className={`sidebar-link ${activeKey === "profile" ? "active" : ""}`}
            onClick={() => onChange("profile")}
            type="button"
            title={collapsed ? "Ver perfil" : undefined}
          >
            <span className="sidebar-link-icon">👤</span>
            {!collapsed && <span>Ver perfil</span>}
          </button>
        </div>
      </div>

      <div className="sidebar-bottom">
        {!collapsed && <div className="sidebar-section-title">Sesión</div>}
        <button
          className="sidebar-link"
          onClick={onLogout}
          type="button"
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <span className="sidebar-link-icon">⎋</span>
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}

export const userSidebarItems: SidebarItem[] = [
  { key: "home", label: "Inicio", icon: "⌂" },
  { key: "reservations", label: "Mis reservas", icon: "🗂" },
  { key: "schedule", label: "Consultar horarios libres", icon: "🗓" },
  { key: "new-practice", label: "Nueva práctica", icon: "＋" },
];

export const adminSidebarItems: SidebarItem[] = [
  { key: "home", label: "Inicio", icon: "⌂" },
  { key: "reservations", label: "Reservas", icon: "🗂" },
  { key: "labs", label: "Laboratorios", icon: "🧪" },
  { key: "assets", label: "Equipos", icon: "🖥" },
  { key: "stock", label: "Reactivos / Stock", icon: "📦" },
];