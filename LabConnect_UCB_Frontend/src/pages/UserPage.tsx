import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/api";
import { getMyPracticePlannings } from "../features/reservations/api/reservationsApi";
import { PracticeRequestResponse } from "../features/reservations/types/reservation";
import Sidebar, { userSidebarItems } from "../components/dashboard/Sidebar";
import DashboardHero from "../components/dashboard/DashboardHero";

type UserTab = "home" | "reservations" | "new-practice" | "schedule" | "profile";

export default function UserPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<UserTab>("home");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reservations, setReservations] = useState<PracticeRequestResponse[]>([]);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    const rawUser = localStorage.getItem("user");

    if (!token || !rawUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(rawUser);
    if (user.role !== "user") {
      navigate("/admin");
      return;
    }

    getMe(token)
      .then((data) => {
        setName(data.full_name);
        setEmail(data.email);
        return getMyPracticePlannings(token);
      })
      .then((data) => {
        setReservations(data);
      })
      .catch((err: any) => {
        setError(err.message || "No se pudieron cargar tus reservas");
      });
  }, [navigate, token]);

  const onLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const badgeClass = (status: string) => {
    if (status === "pending") return "badge badge-pending";
    if (status === "approved") return "badge badge-available";
    if (status === "rejected") return "badge badge-damaged";
    if (status === "cancelled") return "badge badge-maintenance";
    return "badge";
  };

  const getStatusLabel = (status: string) => {
    if (status === "pending") return "Pendiente";
    if (status === "approved") return "Aprobada";
    if (status === "rejected") return "Rechazada";
    if (status === "cancelled") return "Cancelada";
    return status;
  };

  const handleTabChange = (key: string) => {
    if (key === "new-practice") {
      navigate("/user/practicas/nueva");
      return;
    }

    if (key === "schedule") {
      navigate("/laboratorios/calendario");
      return;
    }

    setActiveTab(key as UserTab);
  };

  return (
    <div className={`dashboard-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        title="Portal del estudiante"
        subtitle="Laboratorios y prácticas"
        activeKey={activeTab}
        onChange={handleTabChange}
        onLogout={onLogout}
        userName={name}
        userEmail={email}
        roleLabel="Usuario"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        items={userSidebarItems}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <DashboardHero
            title={`Bienvenido, ${name || "estudiante"}`}
            subtitle="Consulta tus reservas, revisa el estado de tus solicitudes y explora horarios disponibles para planificar mejor tus prácticas."
          />

          {error && <div className="alert-error">{error}</div>}

          {activeTab === "home" && (
            <div className="card">
              <h2 className="section-title">Panel inicial</h2>
              <div className="quick-actions">
                <div className="action-card">
                  <h3>Horarios libres</h3>
                  <p>Consulta bloques disponibles para programar tus prácticas sin conflictos.</p>
                  <button className="btn btn-primary" onClick={() => navigate("/laboratorios/calendario")}>
                    Ver horarios
                  </button>
                </div>

                <div className="action-card">
                  <h3>Mis reservas</h3>
                  <p>Revisa si tus solicitudes están pendientes, aprobadas o rechazadas.</p>
                  <button className="btn btn-secondary" onClick={() => setActiveTab("reservations")}>
                    Consultar reservas
                  </button>
                </div>

                <div className="action-card">
                  <h3>Nueva solicitud</h3>
                  <p>Reserva espacio, materiales y apoyo técnico en una sola operación.</p>
                  <button className="btn btn-accent" onClick={() => navigate("/user/practicas/nueva")}>
                    Planificar práctica
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="card">
              <h2 className="section-title">Mi perfil</h2>
              <div className="grid-2">
                <div>
                  <p><b>Nombre completo:</b> {name}</p>
                  <p><b>Correo institucional:</b> {email}</p>
                  <p><b>Rol:</b> Usuario</p>
                </div>
                <div>
                  <p><b>Estado de cuenta:</b> Activa</p>
                  <p><b>Acceso:</b> Portal de estudiante</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reservations" && (
            <div className="card">
              <h2 className="section-title">Mis reservas</h2>
              {reservations.length === 0 ? (
                <p>Todavía no tienes reservas registradas.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Laboratorio</th>
                        <th>Fecha</th>
                        <th>Horario</th>
                        <th>Materiales</th>
                        <th>Apoyo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((reservation) => (
                        <tr key={reservation.id}>
                          <td>{reservation.laboratory_name}</td>
                          <td>{reservation.date}</td>
                          <td>{reservation.start_time} - {reservation.end_time}</td>
                          <td>
                            {reservation.materials.length === 0
                              ? "Sin materiales"
                              : reservation.materials.map((m) => `${m.material_name} x${m.quantity}`).join(", ")}
                          </td>
                          <td>{reservation.needs_support ? reservation.support_topic || "Sí" : "No"}</td>
                          <td>
                            <span className={badgeClass(reservation.status)}>
                              {getStatusLabel(reservation.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}