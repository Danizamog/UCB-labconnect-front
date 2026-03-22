import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/api";

export default function UserPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
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
      .then((data) => setName(data.full_name))
      .catch(() => {
        localStorage.clear();
        navigate("/login");
      });
  }, [navigate]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Página principal del usuario</h1>
      <p>Bienvenido, {name}</p>
      <p>Desde aquí podrás gestionar tus prácticas de laboratorio.</p>

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <button
          onClick={() => navigate("/user/practicas/nueva")}
          style={primaryButton}
        >
          Planificar práctica
        </button>

        <button
          onClick={() => {
            localStorage.clear();
            navigate("/login");
          }}
          style={secondaryButton}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  backgroundColor: "#2563eb",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #ccc",
  backgroundColor: "#fff",
  cursor: "pointer",
};