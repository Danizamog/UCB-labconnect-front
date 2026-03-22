type Props = {
  fullName: string;
  email?: string;
  roleLabel: string;
};

export default function ProfileCard({ fullName, email, roleLabel }: Props) {
  const initials = fullName
    ? fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div className="profile-card">
      <div className="profile-avatar">{initials}</div>
      <h3 style={{ margin: "0 0 6px", color: "var(--ucb-blue-dark)" }}>{fullName}</h3>
      <div className="profile-meta">
        <div><b>Rol:</b> {roleLabel}</div>
        {email && <div><b>Correo:</b> {email}</div>}
      </div>
    </div>
  );
}