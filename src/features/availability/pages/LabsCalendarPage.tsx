import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar, { userSidebarItems, adminSidebarItems } from "../../../components/dashboard/Sidebar";
import DashboardHero from "../../../components/dashboard/DashboardHero";
import { getMe } from "../../../services/api";
import { getDayReservations, getLabsCalendar } from "../api/availabilityApi";
import { DayReservationsGroup, LabCalendar } from "../types/availability";
import LabsSidebar from "../components/LabsSidebar";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import AvailabilityLegend from "../components/AvailabilityLegend";
import DayReservationsPanel from "../components/DayReservationsPanel";

type TabType = "calendar" | "profile";
type ViewMode = "day" | "month";

export default function LabsCalendarPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "user">("user");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [calendarData, setCalendarData] = useState<LabCalendar[]>([]);
  const [dayReservations, setDayReservations] = useState<DayReservationsGroup[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    const rawUser = localStorage.getItem("user");

    if (!token || !rawUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(rawUser);
    const role = user.role === "admin" ? "admin" : "user";

    setUserRole(role);
    setRoleLabel(role === "admin" ? "Administrador" : "Usuario");

    getMe(token)
      .then((data) => {
        setName(data.full_name);
        setEmail(data.email);
      })
      .catch(() => {
        localStorage.clear();
        navigate("/login");
      });
  }, [navigate, token]);

  useEffect(() => {
    setError("");

    getLabsCalendar(year, month, token)
      .then((data) => {
        setCalendarData(data);
      })
      .catch((err: any) => {
        setError(err.message || "No se pudo cargar el calendario mensual");
      });
  }, [year, month, token]);

  useEffect(() => {
    setError("");

    getDayReservations(selectedDate, token, selectedLabId ?? undefined)
      .then((data) => {
        setDayReservations(data);
      })
      .catch((err: any) => {
        setError(err.message || "No se pudo cargar la agenda del día");
      });
  }, [selectedDate, selectedLabId, token]);

  const selectedCalendar = useMemo(() => {
    if (calendarData.length === 0) return null;
    if (selectedLabId === null) return null;
    return calendarData.find((lab) => lab.laboratory_id === selectedLabId) || null;
  }, [calendarData, selectedLabId]);

  const onLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const moveMonth = (direction: number) => {
    let newMonth = month + direction;
    let newYear = year;

    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }

    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }

    setMonth(newMonth);
    setYear(newYear);
  };

  const handleSidebarChange = (key: string) => {
    if (key === "profile") {
      setActiveTab("profile");
      return;
    }

    if (key === "home") {
      navigate(userRole === "admin" ? "/admin" : "/user");
      return;
    }

    if (key === "reservations") {
      navigate(userRole === "admin" ? "/admin" : "/user");
      return;
    }

    if (key === "new-practice") {
      navigate("/user/practicas/nueva");
      return;
    }

    if (key === "schedule" || key === "calendar") {
      setActiveTab("calendar");
      navigate("/laboratorios/calendario");
      return;
    }

    if (key === "labs" || key === "assets" || key === "stock") {
      navigate("/admin");
      return;
    }
  };

  const sidebarItems = userRole === "admin"
    ? adminSidebarItems
    : userSidebarItems;

  const sidebarActiveKey =
    activeTab === "profile"
      ? "profile"
      : userRole === "admin"
      ? "labs"
      : "schedule";

  return (
    <div className={`dashboard-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        title="Disponibilidad"
        subtitle="Calendario de laboratorios"
        activeKey={sidebarActiveKey}
        onChange={handleSidebarChange}
        onLogout={onLogout}
        userName={name}
        userEmail={email}
        roleLabel={roleLabel}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        items={sidebarItems}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <DashboardHero
            title="Calendario dinámico de laboratorios"
            subtitle="Consulta reservas del día y revisa la disponibilidad general del mes para planificar mejor las prácticas."
          />

          {error && <div className="alert-error">{error}</div>}

          {activeTab === "profile" && (
            <div className="card">
              <h2 className="section-title">Mi perfil</h2>
              <p><b>Nombre:</b> {name}</p>
              <p><b>Correo:</b> {email}</p>
              <p><b>Rol:</b> {roleLabel}</p>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="grid-2" style={{ gridTemplateColumns: "280px 1fr" }}>
              <div className="content-stack">
                <LabsSidebar
                  labs={calendarData}
                  selectedLabId={selectedLabId}
                  onSelectLab={setSelectedLabId}
                />
                <AvailabilityLegend />
              </div>

              <div className="content-stack">
                <div className="card">
                  <div className="topbar">
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className={`btn ${viewMode === "day" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setViewMode("day")}
                      >
                        Ver reservas del día
                      </button>
                      <button
                        className={`btn ${viewMode === "month" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setViewMode("month")}
                      >
                        Ver disponibilidad del mes
                      </button>
                    </div>

                    {viewMode === "day" ? (
                      <input
                        className="input"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ maxWidth: 220 }}
                      />
                    ) : (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn btn-secondary" onClick={() => moveMonth(-1)}>
                          ← Mes anterior
                        </button>
                        <button className="btn btn-secondary" onClick={() => moveMonth(1)}>
                          Mes siguiente →
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {viewMode === "day" ? (
                  <DayReservationsPanel
                    selectedDate={selectedDate}
                    groups={dayReservations}
                  />
                ) : (
                  <AvailabilityCalendar
                    calendarData={selectedCalendar}
                    allCalendars={calendarData}
                    selectedLabId={selectedLabId}
                    year={year}
                    month={month}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}