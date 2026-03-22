type Props = {
  icon?: string;
  label: string;
  badge?: string | number;
  active?: boolean;
  showText: boolean;
  onClick: () => void;
};

export default function SidebarItem({ icon, label, badge, active = false, showText, onClick }: Props) {
  return (
    <button className={`sidebar-shell-item ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span className="sidebar-shell-item-icon">{icon || "IT"}</span>
      {showText && <span className="sidebar-shell-item-label">{label}</span>}
      {showText && badge !== undefined && <span className="sidebar-shell-item-badge">{badge}</span>}
    </button>
  );
}
