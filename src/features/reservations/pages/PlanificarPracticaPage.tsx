import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar, { userSidebarItems } from "../../../components/dashboard/Sidebar";
import DashboardHero from "../../../components/dashboard/DashboardHero";
import PracticePlanningForm from "../components/PracticePlanningForm";

export default function PlanificarPracticaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialLabId = Number(searchParams.get("lab") || "") || null;

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
    if (key === "home" || key === "reservations" || key === "profile") {
      navigate("/user");
      return;
    }

    if (key === "schedule") {
      navigate("/laboratorios/calendario");
      return;
    }

    if (key === "new-practice") {
      navigate("/user/practicas/nueva");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        title="Planificacion academica"
        subtitle="Reserva de practica"
        activeKey="new-practice"
        onChange={handleSidebarChange}
        onLogout={onLogout}
        userName={user?.full_name || "Usuario"}
        userEmail={user?.email || ""}
        roleLabel="Estudiante"
        items={userSidebarItems}
      />

      <main className="dashboard-main">
        <div className="content-stack">
          <DashboardHero
            title="Planificacion de practica"
            subtitle="Reserva espacio, materiales y apoyo tecnico en una sola solicitud, con una experiencia clara y organizada para las practicas academicas."
          />

          <PracticePlanningForm initialLabId={initialLabId} />
        </div>
      </main>
    </div>
  );
}
