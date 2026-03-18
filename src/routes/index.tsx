import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import AdminPage from "../pages/AdminPage";
import UserPage from "../pages/UserPage";
import PlanificarPracticaPage from "../features/reservations/pages/PlanificarPracticaPage";
import LabsCalendarPage from "../features/availability/pages/LabsCalendarPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/user" element={<UserPage />} />
        <Route path="/user/practicas/nueva" element={<PlanificarPracticaPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/laboratorios/calendario" element={<LabsCalendarPage />} />
      </Routes>
    </BrowserRouter>
  );
}