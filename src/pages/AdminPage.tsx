import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/api";
import {
  getAllPracticePlannings,
  updatePracticeStatus,
} from "../features/reservations/api/reservationsApi";
import { PracticeRequestResponse } from "../features/reservations/types/reservation";
import AdminLabsPage from "../features/admin/pages/AdminLabsPage";
import AdminAssetsPage from "../features/admin/pages/AdminAssetsPage";
import AdminStockPage from "../features/admin/pages/AdminStockPage";
import Sidebar, { adminSidebarItems } from "../components/dashboard/Sidebar";
import DashboardHero from "../components/dashboard/DashboardHero";

type TabType = "home" | "profile" | "reservations" | "labs" | "assets" | "stock";

export default function AdminPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reservations, setReservations] = useState<PracticeRequestResponse[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const token = localStorage.getItem("token") || "";

  const loadReservations = async () => {
    try {
      const data = await getAllPracticePlannings(token);
      setReservations(data);
    } catch (err: any) {
      setError(err.message || "No se pudieron cargar las reservas");
    }
  };

  useEffect(() => {
    const rawUser = localStorage.getItem("user");

    if (!token || !rawUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(rawUser);
    if (user.role !== "admin") {
      navigate("/user");
      return;
    }

    getMe(token)
      .then((data) => {
        setName(data.full_name);
        setEmail(data.email);
        return loadReservations();
      })
      .catch((err: any) => {
        setError(err.message || "No se pudieron cargar los datos");
      });
  }, [navigate, token]);

  const handleStatusChange = async (reservationId: number, status: string) => {
    setError("");
    setSuccess("");
    try {
      await updatePracticeStatus(reservationId, status, token);
      setSuccess("Estado de la reserva actualizado correctamente.");
      await loadReservations();
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar la reserva");
    }
  };

  const onLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const getBadgeClass = (status: string) => {
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

  return (
    <div className={`dashboard-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        title="Portal administrativo"
        subtitle="Gestión institucional UCB"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabType)}
        onLogout={onLogout}
        userName={name}
        userEmail={email}
        roleLabel="Administrador"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        items={adminSidebarItems}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <DashboardHero
            title={`Bienvenido, ${name || "administrador"}`}
            subtitle="Administra laboratorios, equipos, reactivos y aprobaciones de reservas desde un solo panel institucional."
          />

          {error && <div className="alert-error">{error}</div>}
          {success && <div className="alert-success">{success}</div>}

          {activeTab === "home" && (
            <div className="card">
              <h2 className="section-title">Centro de administración</h2>
              <div className="quick-actions">
                <div className="action-card">
                  <h3>Reservas</h3>
                  <p>Solicitudes registradas por estudiantes y usuarios del sistema.</p>
                  <strong>{reservations.length}</strong>
                </div>
                <div className="action-card">
                  <h3>Pendientes</h3>
                  <p>Solicitudes esperando confirmación administrativa.</p>
                  <strong>{reservations.filter((r) => r.status === "pending").length}</strong>
                </div>
                <div className="action-card">
                  <h3>Sistema</h3>
                  <p>Panel listo para administrar laboratorios, equipos y stock.</p>
                  <strong>Operativo</strong>
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="card">
              <h2 className="section-title">Perfil del administrador</h2>
              <div className="grid-2">
                <div>
                  <p><b>Nombre completo:</b> {name}</p>
                  <p><b>Correo institucional:</b> {email}</p>
                  <p><b>Rol:</b> Administrador</p>
                </div>
                <div>
                  <p><b>Estado de cuenta:</b> Activa</p>
                  <p><b>Acceso:</b> Panel administrativo UCB</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reservations" && (
            <div className="card">
              <h2 className="section-title">Gestión de reservas</h2>

              {reservations.length === 0 ? (
                <p>No hay reservas registradas todavía.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Usuario</th>
                        <th>Laboratorio</th>
                        <th>Fecha</th>
                        <th>Horario</th>
                        <th>Apoyo</th>
                        <th>Materiales</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((reservation) => (
                        <tr key={reservation.id}>
                          <td>{reservation.id}</td>
                          <td>{reservation.username}</td>
                          <td>{reservation.laboratory_name}</td>
                          <td>{reservation.date}</td>
                          <td>{reservation.start_time} - {reservation.end_time}</td>
                          <td>{reservation.needs_support ? reservation.support_topic || "Sí" : "No"}</td>
                          <td>
                            {reservation.materials.length === 0
                              ? "Sin materiales"
                              : reservation.materials.map((m) => `${m.material_name} x${m.quantity}`).join(", ")}
                          </td>
                          <td>
                            <span className={getBadgeClass(reservation.status)}>
                              {getStatusLabel(reservation.status)}
                            </span>
                          </td>
                          <td>
                            <select
                              className="select"
                              value={reservation.status}
                              onChange={(e) => handleStatusChange(reservation.id, e.target.value)}
                            >
                              <option value="pending">Pendiente</option>
                              <option value="approved">Aprobar</option>
                              <option value="rejected">Rechazar</option>
                              <option value="cancelled">Cancelar</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "labs" && <AdminLabsPage />}
          {activeTab === "assets" && <AdminAssetsPage />}
          {activeTab === "stock" && <AdminStockPage />}
        </div>
      </main>
    </div>
  );
}