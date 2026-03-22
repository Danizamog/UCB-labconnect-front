type Props = {
  open: boolean;
  onClick: () => void;
};

export default function MobileMenuButton({ open, onClick }: Props) {
  return (
    <button className={`sidebar-mobile-button ${open ? "open" : ""}`} type="button" onClick={onClick} aria-label="Abrir menu">
      <span />
      <span />
      <span />
    </button>
  );
}
