type Props = {
  title: string;
  subtitle: string;
  showText: boolean;
  canCollapse: boolean;
  onCollapse: () => void;
  onClose: () => void;
};

export default function SidebarHeader({
  title,
  subtitle,
  showText,
  canCollapse,
  onCollapse,
  onClose,
}: Props) {
  return (
    <div className="sidebar-shell-header">
      <div className="sidebar-shell-brand">
        <div className="sidebar-shell-logo">U</div>
        {showText && (
          <div className="sidebar-shell-brand-copy">
            <strong>UCB LabConnect</strong>
            <span>{title}</span>
            <small>{subtitle}</small>
          </div>
        )}
      </div>

      <div className="sidebar-shell-actions">
        {canCollapse && (
          <button className="sidebar-shell-control" type="button" onClick={onCollapse}>
            CL
          </button>
        )}
        <button className="sidebar-shell-control mobile-only" type="button" onClick={onClose}>
          X
        </button>
      </div>
    </div>
  );
}
