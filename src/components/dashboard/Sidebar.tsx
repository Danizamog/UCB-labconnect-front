import MobileMenuButton from "./sidebar/MobileMenuButton";
import SidebarHeader from "./sidebar/SidebarHeader";
import SidebarItem from "./sidebar/SidebarItem";
import { useSidebar } from "./sidebar/SidebarContext";

type SidebarItemType = {
  key: string;
  label: string;
  icon?: string;
  badge?: string | number;
};

type Props = {
  title: string;
  subtitle: string;
  items: SidebarItemType[];
  activeKey: string;
  onChange: (key: string) => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  roleLabel?: string;
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
}: Props) {
  const { isOpen, isCollapsed, isMobile, isTablet, toggleSidebar, closeSidebar, toggleCollapsed } = useSidebar();

  const showText = isMobile || isTablet || !isCollapsed;
  const initials = userName
    ? userName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const handleChange = (key: string) => {
    onChange(key);
    if (isMobile) closeSidebar();
  };

  return (
    <>
      {isMobile && <MobileMenuButton open={isOpen} onClick={toggleSidebar} />}
      {isMobile && isOpen && <button className="sidebar-shell-overlay" type="button" onClick={closeSidebar} aria-label="Cerrar menu" />}

      <aside
        className={`sidebar-shell ${isOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""} ${isTablet ? "tablet" : ""}`}
      >
        <SidebarHeader
          title={title}
          subtitle={subtitle}
          showText={showText}
          canCollapse={!isMobile && !isTablet}
          onCollapse={toggleCollapsed}
          onClose={closeSidebar}
        />

        <div className="sidebar-shell-user">
          <div className="sidebar-shell-avatar">{initials}</div>
          {showText && (
            <div className="sidebar-shell-user-copy">
              <strong>{userName || "Usuario"}</strong>
              {userEmail && <span>{userEmail}</span>}
              {roleLabel && <small>{roleLabel}</small>}
            </div>
          )}
        </div>

        <div className="sidebar-shell-section">
          {showText && <div className="sidebar-shell-caption">Menu principal</div>}
          <div className="sidebar-shell-nav">
            {items.map((item, index) => (
              <div key={item.key} className="sidebar-shell-stagger" style={{ animationDelay: `${index * 50}ms` }}>
                <SidebarItem
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                  active={activeKey === item.key}
                  showText={showText}
                  onClick={() => handleChange(item.key)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-shell-section">
          {showText && <div className="sidebar-shell-caption">Cuenta</div>}
          <div className="sidebar-shell-nav">
            <SidebarItem
              icon="PF"
              label="Mi perfil"
              active={activeKey === "profile"}
              showText={showText}
              onClick={() => handleChange("profile")}
            />
          </div>
        </div>

        <div className="sidebar-shell-footer">
          {showText && <div className="sidebar-shell-caption">Sesion</div>}
          <SidebarItem icon="CS" label="Cerrar sesion" showText={showText} onClick={onLogout} />
        </div>
      </aside>
    </>
  );
}

export const userSidebarItems: SidebarItemType[] = [
  { key: "home", label: "Inicio", icon: "IN" },
  { key: "reservations", label: "Mis reservas", icon: "MR" },
  { key: "notifications", label: "Notificaciones", icon: "NT" },
  { key: "schedule", label: "Horarios", icon: "CL" },
  { key: "new-practice", label: "Nueva practica", icon: "NP" },
];

export const adminSidebarItems: SidebarItemType[] = [
  { key: "home", label: "Inicio", icon: "IN" },
  { key: "reservations", label: "Reservas", icon: "RV" },
  { key: "tracking", label: "Trazabilidad", icon: "TR" },
  { key: "labs", label: "Laboratorios", icon: "LB" },
  { key: "assets", label: "Equipos", icon: "EQ" },
  { key: "stock", label: "Reactivos", icon: "ST" },
  { key: "users", label: "Usuarios", icon: "US" },
];
