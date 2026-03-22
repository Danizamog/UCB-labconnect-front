import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar, { adminSidebarItems } from "../components/dashboard/Sidebar";
import DashboardHero from "../components/dashboard/DashboardHero";
import { createUser, getMe, getUsers, updateMe, updateUser } from "../services/api";
import { getAllPracticePlannings, updatePracticeStatus } from "../features/reservations/api/reservationsApi";
import { PracticeRequestResponse } from "../features/reservations/types/reservation";
import AdminLabsPage from "../features/admin/pages/AdminLabsPage";
import AdminAssetsPage from "../features/admin/pages/AdminAssetsPage";
import AdminStockPage from "../features/admin/pages/AdminStockPage";
import AdminTrackingPage from "../features/admin/pages/AdminTrackingPage";

type TabType = "home" | "reservations" | "tracking" | "labs" | "assets" | "stock" | "users" | "profile";

export default function AdminPage() {
  const navigate = useNavigate();
  const [currentRole, setCurrentRole] = useState<"admin" | "lab_manager">("admin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reservations, setReservations] = useState<PracticeRequestResponse[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [reviewComments, setReviewComments] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [myProfile, setMyProfile] = useState({
    phone: "",
    academic_page: "",
    faculty: "",
    career: "",
    student_code: "",
    campus: "",
    bio: "",
  });
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    role: "student" as "admin" | "lab_manager" | "student",
  });

  const token = localStorage.getItem("token") || "";

  const loadData = async (role: "admin" | "lab_manager") => {
    const me = await getMe(token);
    const reservationsData = await getAllPracticePlannings(token);
    setName(me.full_name);
    setEmail(me.email);
    setMyProfile({
      phone: me.phone || "",
      academic_page: me.academic_page || "",
      faculty: me.faculty || "",
      career: me.career || "",
      student_code: me.student_code || "",
      campus: me.campus || "",
      bio: me.bio || "",
    });
    setReservations(reservationsData);

    if (role === "admin") {
      const usersData = await getUsers(token);
      setUsers(usersData.map((user) => ({ ...user, password: "" })));
    } else {
      setUsers([]);
      if (activeTab === "users") setActiveTab("home");
    }
  };

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (!token || !rawUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(rawUser);
    if (user.role !== "admin" && user.role !== "lab_manager") {
      navigate("/user");
      return;
    }

    const role = user.role === "admin" ? "admin" : "lab_manager";
    setCurrentRole(role);
    loadData(role).catch((err: any) => setError(err.message || "No se pudieron cargar los datos"));
  }, [navigate, token]);

  const visibleSidebarItems = useMemo(
    () => adminSidebarItems.filter((item) => currentRole === "admin" || item.key !== "users"),
    [currentRole]
  );

  const onLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const roleLabel = currentRole === "admin" ? "Administrador" : "Encargado de laboratorio";

  return (
    <div className="dashboard-layout">
      <Sidebar
        title={currentRole === "admin" ? "Portal administrativo" : "Portal de laboratorio"}
        subtitle="Gestion institucional UCB"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabType)}
        onLogout={onLogout}
        userName={name}
        userEmail={email}
        roleLabel={roleLabel}
        items={visibleSidebarItems}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <DashboardHero
            title={`Bienvenido, ${name || "gestor"}`}
            subtitle={
              currentRole === "admin"
                ? "Administra areas, laboratorios, inventario, solicitudes y usuarios desde un solo panel."
                : "Gestiona laboratorios, equipos, stock y solicitudes con una interfaz mas fluida y operativa."
            }
          />

          {error && <div className="alert-error">{error}</div>}
          {success && <div className="alert-success">{success}</div>}

          {activeTab === "home" && (
            <div className="quick-actions">
              <div className="action-card">
                <h3>Reservas</h3>
                <p>{reservations.length} solicitudes registradas.</p>
              </div>
              <div className="action-card">
                <h3>Pendientes</h3>
                <p>{reservations.filter((item) => item.status === "pending").length} por revisar.</p>
              </div>
              <div className="action-card">
                <h3>Rol activo</h3>
                <p>{roleLabel}</p>
              </div>
            </div>
          )}

          {activeTab === "reservations" && (
            <div className="card">
              <h2 className="section-title">Revision de solicitudes</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Laboratorio</th>
                      <th>Fecha</th>
                      <th>Horario</th>
                      <th>Estado</th>
                      <th>Comentario</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <td>{reservation.username}</td>
                        <td>{reservation.laboratory_name}</td>
                        <td>{reservation.date}</td>
                        <td>{reservation.start_time} - {reservation.end_time}</td>
                        <td>{reservation.status}</td>
                        <td>
                          <textarea
                            className="textarea"
                            value={reviewComments[reservation.id] ?? reservation.review_comment ?? ""}
                            onChange={(e) => setReviewComments((prev) => ({ ...prev, [reservation.id]: e.target.value }))}
                          />
                        </td>
                        <td>
                          <select
                            className="select"
                            value={reservation.status}
                            onChange={(e) =>
                              updatePracticeStatus(reservation.id, e.target.value, token, reviewComments[reservation.id] ?? reservation.review_comment)
                                .then(() => {
                                  setSuccess("Solicitud actualizada correctamente.");
                                  return loadData(currentRole);
                                })
                                .catch((err: any) => setError(err.message || "No se pudo actualizar la solicitud"))
                            }
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
            </div>
          )}

          {activeTab === "tracking" && <AdminTrackingPage reservations={reservations} />}
          {activeTab === "labs" && <AdminLabsPage />}
          {activeTab === "assets" && <AdminAssetsPage />}
          {activeTab === "stock" && <AdminStockPage />}

          {activeTab === "users" && currentRole === "admin" && (
            <div className="content-stack">
              <div className="card professional-form">
                <h2 className="section-title">Crear usuario</h2>
                <div className="grid-2">
                  <div className="field">
                    <label>Username</label>
                    <input className="input" value={newUserForm.username} onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Nombre completo</label>
                    <input className="input" value={newUserForm.full_name} onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid-3">
                  <div className="field">
                    <label>Correo</label>
                    <input className="input" type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Rol</label>
                    <select className="select" value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as "admin" | "lab_manager" | "student" })}>
                      <option value="student">Estudiante</option>
                      <option value="lab_manager">Encargado de laboratorio</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Contrasena temporal</label>
                    <input className="input" type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    createUser(newUserForm, token)
                      .then(() => {
                        setSuccess("Usuario creado correctamente.");
                        setNewUserForm({ username: "", full_name: "", email: "", password: "", role: "student" });
                        return loadData(currentRole);
                      })
                      .catch((err: any) => setError(err.message || "No se pudo crear el usuario"))
                  }
                  type="button"
                >
                  Crear usuario
                </button>
              </div>

              <div className="card">
                <h2 className="section-title">Matriz de roles</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rol</th>
                        <th>Alcance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Estudiante</td>
                        <td>Consulta areas y laboratorios, reserva, ve calendario, perfil y notificaciones.</td>
                      </tr>
                      <tr>
                        <td>Encargado de laboratorio</td>
                        <td>Gestiona areas, laboratorios, equipos, prestamos, stock y revision de reservas.</td>
                      </tr>
                      <tr>
                        <td>Administrador</td>
                        <td>Control total del sistema, incluyendo gestion de usuarios y roles.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h2 className="section-title">Gestion de usuarios</h2>
                <div className="editor-grid">
                  {users.map((user) => (
                    <div key={user.id} className="editor-card">
                      <div className="grid-2">
                        <div className="field">
                          <label>Nombre completo</label>
                          <input className="input" value={user.full_name} onChange={(e) => setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, full_name: e.target.value } : item))} />
                        </div>
                        <div className="field">
                          <label>Email</label>
                          <input className="input" value={user.email} onChange={(e) => setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, email: e.target.value } : item))} />
                        </div>
                      </div>
                      <div className="grid-3">
                        <div className="field">
                          <label>Rol</label>
                          <select className="select" value={user.role} onChange={(e) => setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, role: e.target.value } : item))}>
                            <option value="student">Estudiante</option>
                            <option value="lab_manager">Encargado de laboratorio</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Estado</label>
                          <select className="select" value={user.is_active ? "true" : "false"} onChange={(e) => setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, is_active: e.target.value === "true" } : item))}>
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Nueva contrasena</label>
                          <input className="input" type="password" value={user.password || ""} onChange={(e) => setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, password: e.target.value } : item))} />
                        </div>
                      </div>
                      <div className="grid-2">
                        <div className="field">
                          <label>Telefono</label>
                          <input className="input" value={user.phone || ""} onChange={(e) => setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, phone: e.target.value } : item))} />
                        </div>
                        <div className="field">
                          <label>Pagina academica</label>
                          <input className="input" value={user.academic_page || ""} onChange={(e) => setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, academic_page: e.target.value } : item))} />
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          updateUser(user.id, {
                            full_name: user.full_name,
                            email: user.email,
                            role: user.role,
                            is_active: user.is_active,
                            password: user.password || undefined,
                            phone: user.phone || "",
                            academic_page: user.academic_page || "",
                            faculty: user.faculty || "",
                            career: user.career || "",
                            student_code: user.student_code || "",
                            campus: user.campus || "",
                            bio: user.bio || "",
                          }, token)
                            .then(() => {
                              setSuccess("Usuario actualizado correctamente.");
                              return loadData(currentRole);
                            })
                            .catch((err: any) => setError(err.message || "No se pudo actualizar el usuario"))
                        }
                      >
                        Guardar usuario
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMe(myProfile, token)
                  .then(() => setSuccess("Perfil actualizado correctamente."))
                  .catch((err: any) => setError(err.message || "No se pudo actualizar el perfil"));
              }}
              className="card profile-editor-card"
            >
              <h2 className="section-title">Mi perfil</h2>
              <div className="grid-2">
                <div className="field">
                  <label>Nombre completo</label>
                  <input className="input" value={name} disabled />
                </div>
                <div className="field">
                  <label>Correo institucional</label>
                  <input className="input" value={email} disabled />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Telefono</label>
                  <input className="input" value={myProfile.phone} onChange={(e) => setMyProfile({ ...myProfile, phone: e.target.value })} />
                </div>
                <div className="field">
                  <label>Pagina academica</label>
                  <input className="input" value={myProfile.academic_page} onChange={(e) => setMyProfile({ ...myProfile, academic_page: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Guardar cambios</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
