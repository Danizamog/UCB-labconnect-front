import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "user">("user");

  const [calendarData, setCalendarData] = useState<LabCalendar[]>([]);
  const [dayReservations, setDayReservations] = useState<DayReservationsGroup[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(Number(searchParams.get("lab") || "") || null);
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
    const role = user.role === "admin" || user.role === "lab_manager" ? "admin" : "user";

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
      .then(setCalendarData)
      .catch((err: any) => setError(err.message || "No se pudo cargar el calendario mensual"));
  }, [year, month, token]);

  useEffect(() => {
    setError("");
    getDayReservations(selectedDate, token, selectedLabId ?? undefined)
      .then(setDayReservations)
      .catch((err: any) => setError(err.message || "No se pudo cargar la agenda del dia"));
  }, [selectedDate, selectedLabId, token]);

  const selectedCalendar = useMemo(() => {
    if (calendarData.length === 0 || selectedLabId === null) return null;
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
    if (key === "home" || key === "reservations" || key === "labs" || key === "assets" || key === "stock") {
      navigate(userRole === "admin" ? "/admin" : "/user");
      return;
    }
    if (key === "new-practice") {
      navigate("/user/practicas/nueva");
      return;
    }
    if (key === "schedule" || key === "calendar") {
      setActiveTab("calendar");
      return;
    }
  };

  const sidebarItems = userRole === "admin" ? adminSidebarItems : userSidebarItems;
  const sidebarActiveKey = activeTab === "profile" ? "profile" : userRole === "admin" ? "labs" : "schedule";

  return (
    <div className="dashboard-layout">
      <Sidebar
        title="Disponibilidad"
        subtitle="Calendario de laboratorios"
        activeKey={sidebarActiveKey}
        onChange={handleSidebarChange}
        onLogout={onLogout}
        userName={name}
        userEmail={email}
        roleLabel={roleLabel}
        items={sidebarItems}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <DashboardHero
            title="Calendario dinamico de laboratorios"
            subtitle="Consulta reservas del dia y revisa la disponibilidad general del mes con una vista mucho mas compacta para celular y escritorio."
          />

          {error && <div className="alert-error">{error}</div>}

          {activeTab === "profile" && (
            <div className="card profile-editor-card">
              <h2 className="section-title">Mi perfil</h2>
              <p><b>Nombre:</b> {name}</p>
              <p><b>Correo:</b> {email}</p>
              <p><b>Rol:</b> {roleLabel}</p>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="calendar-layout">
              <div className="content-stack">
                <LabsSidebar labs={calendarData} selectedLabId={selectedLabId} onSelectLab={setSelectedLabId} />
                <AvailabilityLegend />
              </div>

              <div className="content-stack">
                <div className="card">
                  <div className="calendar-toolbar">
                    <div className="editor-actions">
                      <button className={`btn ${viewMode === "day" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("day")}>
                        Dia
                      </button>
                      <button className={`btn ${viewMode === "month" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("month")}>
                        Mes
                      </button>
                    </div>

                    {viewMode === "day" ? (
                      <input className="input calendar-date-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                    ) : (
                      <div className="editor-actions">
                        <button className="btn btn-secondary" onClick={() => moveMonth(-1)}>Mes anterior</button>
                        <button className="btn btn-secondary" onClick={() => moveMonth(1)}>Mes siguiente</button>
                      </div>
                    )}
                  </div>
                </div>

                {viewMode === "day" ? (
                  <DayReservationsPanel selectedDate={selectedDate} groups={dayReservations} />
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
