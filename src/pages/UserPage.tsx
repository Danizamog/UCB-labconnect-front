import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar, { userSidebarItems } from "../components/dashboard/Sidebar";
import DashboardHero from "../components/dashboard/DashboardHero";
import { getMe, updateMe } from "../services/api";
import { getAreas, getLabs, getMyNotifications, getMyPracticePlannings, markNotificationAsRead } from "../features/reservations/api/reservationsApi";
import { AreaOption, LabOption, PracticeRequestResponse, ReservationNotification } from "../features/reservations/types/reservation";

type UserTab = "home" | "reservations" | "notifications" | "schedule" | "profile";
type ReservationView = "active" | "pending" | "history";

const SETTINGS_KEY = "labconnect_notification_settings";

function reservationTime(item: PracticeRequestResponse) {
  return new Date(`${item.date}T${item.start_time}:00`).getTime();
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function UserPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<UserTab>("home");
  const [reservationView, setReservationView] = useState<ReservationView>("active");
  const [reservationSearch, setReservationSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reservations, setReservations] = useState<PracticeRequestResponse[]>([]);
  const [notifications, setNotifications] = useState<ReservationNotification[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profileForm, setProfileForm] = useState({
    phone: "",
    academic_page: "",
    faculty: "",
    career: "",
    student_code: "",
    campus: "",
    bio: "",
  });
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return { reminders: true, approvals: true, alerts: true, digest: false };
    try {
      return JSON.parse(saved);
    } catch {
      return { reminders: true, approvals: true, alerts: true, digest: false };
    }
  });

  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (!token || !rawUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(rawUser);
    if (user.role === "admin" || user.role === "lab_manager") {
      navigate("/admin");
      return;
    }

    Promise.all([getMe(token), getMyPracticePlannings(token), getMyNotifications(token), getAreas(token), getLabs(token)])
      .then(([me, reservationsData, notificationsData, areasData, labsData]) => {
        setName(me.full_name);
        setEmail(me.email);
        setProfileForm({
          phone: me.phone || "",
          academic_page: me.academic_page || "",
          faculty: me.faculty || "",
          career: me.career || "",
          student_code: me.student_code || "",
          campus: me.campus || "",
          bio: me.bio || "",
        });
        setReservations(reservationsData.sort((a, b) => reservationTime(a) - reservationTime(b)));
        setNotifications(notificationsData);
        setAreas(areasData.filter((area) => area.is_active));
        setLabs(labsData.filter((lab) => lab.is_active !== false));
        setSelectedAreaId(areasData.find((area) => area.is_active)?.id || null);
      })
      .catch((err: any) => setError(err.message || "No se pudieron cargar tus datos"));
  }, [navigate, token]);

  const unread = notifications.filter((item) => !item.read).length;
  const activeReservations = useMemo(() => reservations.filter((item) => ["approved", "pending"].includes(item.status) && reservationTime(item) >= Date.now()), [reservations]);
  const pendingReservations = useMemo(() => reservations.filter((item) => item.status === "pending"), [reservations]);
  const historyReservations = useMemo(() => reservations.filter((item) => reservationTime(item) < Date.now() || ["rejected", "cancelled"].includes(item.status)), [reservations]);
  const nextReservation = activeReservations[0] || null;
  const currentReservations = useMemo(() => {
    const source = reservationView === "active" ? activeReservations : reservationView === "pending" ? pendingReservations : historyReservations;
    return source.filter((item) => item.laboratory_name.toLowerCase().includes(reservationSearch.toLowerCase()));
  }, [activeReservations, pendingReservations, historyReservations, reservationView, reservationSearch]);
  const filteredLabs = useMemo(() => labs.filter((lab) => lab.area_id === selectedAreaId), [labs, selectedAreaId]);
  const highlightedLabs = useMemo(() => labs.slice(0, 3), [labs]);

  const onLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const updated = await updateMe(profileForm, token);
      localStorage.setItem("user", JSON.stringify(updated));
      setSuccess("Perfil actualizado correctamente.");
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar tu perfil");
    }
  };

  const handleMarkAll = async () => {
    try {
      await Promise.all(notifications.filter((item) => !item.read).map((item) => markNotificationAsRead(item.id, token)));
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setSuccess("Notificaciones marcadas como leidas.");
    } catch (err: any) {
      setError(err.message || "No se pudieron actualizar las notificaciones");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        title="Portal del estudiante"
        subtitle="Laboratorios y practicas"
        activeKey={activeTab}
        onChange={(key) => {
          if (key === "new-practice") return navigate("/user/practicas/nueva");
          if (key === "schedule") return navigate("/laboratorios/calendario");
          setActiveTab(key as UserTab);
        }}
        onLogout={onLogout}
        userName={name}
        userEmail={email}
        roleLabel="Estudiante"
        items={userSidebarItems.map((item) => item.key === "notifications" ? { ...item, badge: unread || undefined } : item)}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <div className="dashboard-topbar">
            <div>
              <strong>Bienvenido, {name || "estudiante"}</strong>
              <span>{new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div className="dashboard-topbar-actions">
              <button className="topbar-pill" type="button" onClick={() => setActiveTab("notifications")}>Notificaciones <span>{unread}</span></button>
              <div className="topbar-avatar">{name ? name.slice(0, 1).toUpperCase() : "U"}</div>
            </div>
          </div>

          <DashboardHero
            title={`Bienvenido, ${name || "estudiante"}`}
            subtitle="Una experiencia mas clara para consultar laboratorios, reservar practicas y mantener el seguimiento academico en tiempo real."
          />

          {error && <div className="alert-error">{error}</div>}
          {success && <div className="alert-success">{success}</div>}

          {activeTab === "home" && (
            <div className="content-stack">
              <div className="stats-grid">
                <div className="stats-card"><div className="stats-icon blue">LB</div><div><span>Laboratorios disponibles</span><strong>{labs.length}</strong><small>Espacios habilitados</small></div></div>
                <div className="stats-card"><div className="stats-icon amber">RA</div><div><span>Reservas activas</span><strong>{activeReservations.length}</strong><small>{pendingReservations.length} pendientes</small></div></div>
                <div className="stats-card"><div className="stats-icon sky">RM</div><div><span>Reservas este mes</span><strong>{reservations.filter((item) => item.status === "approved").length}</strong><small>Actividad acumulada</small></div></div>
                <div className="stats-card"><div className="stats-icon gold">PR</div><div><span>Proxima reserva</span><strong>{nextReservation ? formatDate(nextReservation.date) : "Sin agenda"}</strong><small>{nextReservation ? `${nextReservation.laboratory_name} · ${nextReservation.start_time}` : "Programa una practica"}</small></div></div>
              </div>

              <div className="dashboard-panel-grid">
                <div className="card">
                  <div className="section-head">
                    <div><h2 className="section-title">Areas disponibles</h2><p className="section-copy">Selecciona un area para explorar sus laboratorios visibles.</p></div>
                  </div>
                  <div className="lab-areas-grid">
                    {areas.map((area) => (
                      <button key={area.id} type="button" className={`lab-area-card ${selectedAreaId === area.id ? "selected" : ""}`} onClick={() => setSelectedAreaId(area.id)}>
                        <div className="lab-area-header"><h3>{area.name}</h3><p>{area.description || "Sin descripcion registrada"}</p></div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="section-head">
                    <div><h2 className="section-title">Laboratorios del area</h2><p className="section-copy">Consulta equipamiento, capacidad y acceso rapido a reserva.</p></div>
                  </div>
                  <div className="mini-list-grid">
                    {filteredLabs.length === 0 ? <div className="empty-panel">No hay laboratorios visibles para esta area.</div> : filteredLabs.map((lab) => (
                      <div key={lab.id} className="mini-lab-card">
                        <strong>{lab.name}</strong>
                        <span>{lab.location} · Cap. {lab.capacity}</span>
                        <button className="btn btn-secondary" onClick={() => navigate(`/laboratorios/${lab.id}`)}>Ver detalle</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="section-head">
                  <div><h2 className="section-title">Laboratorios destacados</h2><p className="section-copy">Accesos directos a los espacios mas solicitados por los estudiantes.</p></div>
                </div>
                <div className="featured-labs-grid">
                  {highlightedLabs.map((lab, index) => (
                    <div key={lab.id} className="featured-lab-card">
                      <div className={`featured-lab-visual visual-${(index % 3) + 1}`}><span className="featured-lab-badge">{lab.area_name || "Area"}</span></div>
                      <div className="featured-lab-content">
                        <h3>{lab.name}</h3>
                        <p>{lab.description || "Espacio preparado para actividades practicas universitarias."}</p>
                        <div className="chip-row"><span className="info-chip">{lab.capacity} estudiantes</span><span className="info-chip">{lab.location}</span></div>
                        <button className="btn btn-accent" onClick={() => navigate(`/laboratorios/${lab.id}`)}>Reservar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="section-head">
                  <div><h2 className="section-title">Mis proximas reservas</h2><p className="section-copy">Seguimiento rapido de tus solicitudes activas.</p></div>
                </div>
                <div className="upcoming-reservations-strip">
                  {activeReservations.length === 0 ? <div className="empty-panel">No tienes reservas activas por ahora.</div> : activeReservations.slice(0, 5).map((item) => (
                    <div key={item.id} className="upcoming-reservation-card">
                      <div className="section-head"><strong>{item.laboratory_name}</strong><span className={`badge ${item.status === "approved" ? "badge-available" : "badge-pending"}`}>{item.status === "approved" ? "Confirmada" : "Pendiente"}</span></div>
                      <p>{formatDate(item.date)} · {item.start_time} - {item.end_time}</p>
                      <div className="editor-actions">
                        <button className="btn btn-secondary" onClick={() => navigate(`/laboratorios/calendario?lab=${item.laboratory_id}`)}>Horario</button>
                        <button className="btn btn-accent" onClick={() => navigate(`/laboratorios/${item.laboratory_id}`)}>Abrir</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="mobile-reserve-fab" onClick={() => navigate("/user/practicas/nueva")}>+</button>
            </div>
          )}

          {activeTab === "reservations" && (
            <div className="content-stack">
              <div className="card">
                <div className="reservation-toolbar">
                  <div className="tab-pills">
                    <button className={`tab-pill ${reservationView === "active" ? "active" : ""}`} onClick={() => setReservationView("active")} type="button">Activas</button>
                    <button className={`tab-pill ${reservationView === "pending" ? "active" : ""}`} onClick={() => setReservationView("pending")} type="button">Pendientes</button>
                    <button className={`tab-pill ${reservationView === "history" ? "active" : ""}`} onClick={() => setReservationView("history")} type="button">Historial</button>
                  </div>
                  <input className="input reservation-search" placeholder="Buscar laboratorio" value={reservationSearch} onChange={(e) => setReservationSearch(e.target.value)} />
                </div>
              </div>
              <div className="reservation-card-grid">
                {currentReservations.length === 0 ? <div className="card empty-panel">No hay reservas para este filtro.</div> : currentReservations.map((item) => (
                  <div key={item.id} className="reservation-card">
                    <div className="section-head"><div><h3>{item.laboratory_name}</h3><p>{formatDate(item.date)} · {item.start_time} - {item.end_time}</p></div><span className={`badge ${item.status === "approved" ? "badge-available" : item.status === "pending" ? "badge-pending" : "badge-damaged"}`}>{item.status}</span></div>
                    <p>{item.notes || "Sin observaciones adicionales."}</p>
                    <div className="chip-row">{item.materials.slice(0, 3).map((material) => <span key={material.id} className="info-chip">{material.material_name}</span>)}</div>
                    <div className="editor-actions"><button className="btn btn-secondary" onClick={() => navigate(`/laboratorios/calendario?lab=${item.laboratory_id}`)}>Consultar</button><button className="btn btn-primary" onClick={() => navigate(`/laboratorios/${item.laboratory_id}`)}>Ver laboratorio</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="content-stack">
              <div className="card">
                <div className="section-head"><div><h2 className="section-title">Centro de notificaciones</h2><p className="section-copy">Configura tus avisos y revisa estados recientes.</p></div><button className="btn btn-secondary" onClick={handleMarkAll}>Marcar todo como leido</button></div>
                <div className="notification-settings-grid">
                  {[
                    ["reminders", "Recordatorios"],
                    ["approvals", "Aprobaciones"],
                    ["alerts", "Alertas"],
                    ["digest", "Resumen semanal"],
                  ].map(([key, label]) => (
                    <label key={key} className="toggle-card"><span>{label}</span><input type="checkbox" checked={settings[key as keyof typeof settings]} onChange={(e) => setSettings((prev: any) => ({ ...prev, [key]: e.target.checked }))} /></label>
                  ))}
                </div>
              </div>
              {notifications.length === 0 ? <div className="card empty-panel">No tienes notificaciones nuevas.</div> : notifications.map((item) => (
                <div key={item.id} className={`notification-card ${item.status}`}>
                  <div className="notification-icon">{item.status === "approved" ? "OK" : item.status === "rejected" ? "AL" : "NT"}</div>
                  <div className="notification-copy">
                    <div className="section-head"><div><h3>{item.title}</h3><p>{item.message}</p></div>{!item.read && <span className="badge badge-pending">Nueva</span>}</div>
                    <div className="chip-row"><span className="info-chip">{item.laboratory_name}</span><span className="info-chip">{item.date}</span><span className="info-chip">{item.start_time} - {item.end_time}</span></div>
                    <p>{item.review_comment || "Sin comentario del administrador."}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "profile" && (
            <form onSubmit={handleProfileSubmit} className="card profile-editor-card">
              <div className="profile-hero">
                <div className="profile-avatar profile-avatar-large">{name ? name.slice(0, 1).toUpperCase() : "U"}</div>
                <div><h3>{name}</h3><p>{email}</p><div className="chip-row"><span className="info-chip">{profileForm.career || "Carrera"}</span><span className="info-chip">{profileForm.faculty || "Facultad"}</span></div></div>
              </div>
              <div className="grid-2"><div className="field"><label>Nombre completo</label><input className="input" value={name} disabled /></div><div className="field"><label>Correo institucional</label><input className="input" value={email} disabled /></div></div>
              <div className="grid-2"><div className="field"><label>Telefono</label><input className="input" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div><div className="field"><label>Codigo institucional</label><input className="input" value={profileForm.student_code} onChange={(e) => setProfileForm({ ...profileForm, student_code: e.target.value })} /></div></div>
              <div className="grid-2"><div className="field"><label>Facultad</label><input className="input" value={profileForm.faculty} onChange={(e) => setProfileForm({ ...profileForm, faculty: e.target.value })} /></div><div className="field"><label>Carrera</label><input className="input" value={profileForm.career} onChange={(e) => setProfileForm({ ...profileForm, career: e.target.value })} /></div></div>
              <div className="grid-2"><div className="field"><label>Campus</label><input className="input" value={profileForm.campus} onChange={(e) => setProfileForm({ ...profileForm, campus: e.target.value })} /></div><div className="field"><label>Pagina academica</label><input className="input" value={profileForm.academic_page} onChange={(e) => setProfileForm({ ...profileForm, academic_page: e.target.value })} placeholder="https://..." /></div></div>
              <div className="field"><label>Resumen academico</label><textarea className="textarea" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} /></div>
              <button type="submit" className="btn btn-primary">Guardar cambios</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
