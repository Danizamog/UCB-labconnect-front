import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar, { userSidebarItems } from "../../../components/dashboard/Sidebar";
import DashboardHero from "../../../components/dashboard/DashboardHero";
import PracticePlanningForm from "../components/PracticePlanningForm";

export default function PlanificarPracticaPage() {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const rawUser = localStorage.getItem("user");
  const user = useMemo(() => {
    if (!rawUser) return null;
    try {
      return JSON.parse(rawUser);
    } catch {
      return null;
    }
  }, [rawUser]);

  const onLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleSidebarChange = (key: string) => {
    if (key === "home") {
      navigate("/user");
      return;
    }

    if (key === "reservations") {
      navigate("/user");
      return;
    }

    if (key === "schedule") {
      navigate("/laboratorios/calendario");
      return;
    }

    if (key === "new-practice") {
      navigate("/user/practicas/nueva");
      return;
    }

    if (key === "profile") {
      navigate("/user");
    }
  };

  return (
    <div className={`dashboard-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        title="Planificación académica"
        subtitle="Reserva de práctica"
        activeKey="new-practice"
        onChange={handleSidebarChange}
        onLogout={onLogout}
        userName={user?.full_name || "Usuario"}
        userEmail={user?.email || ""}
        roleLabel="Usuario"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        items={userSidebarItems}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <DashboardHero
            title="Planificación de práctica"
            subtitle="Reserva espacio, materiales y apoyo técnico en una sola solicitud, con una experiencia clara y organizada para las prácticas académicas."
          />

          <PracticePlanningForm />
        </div>
      </main>
    </div>
  );
}