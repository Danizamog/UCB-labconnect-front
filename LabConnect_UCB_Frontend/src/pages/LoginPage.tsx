import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleLoginRequest, loginRequest } from "../services/api";

declare global {
  interface Window {
    google: any;
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleAuthSuccess = (data: any) => {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));

    if (data.user.role === "admin") {
      navigate("/admin");
    } else {
      navigate("/user");
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!window.google || !clientId || !googleBtnRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: any) => {
        try {
          const data = await googleLoginRequest(response.credential);
          handleAuthSuccess(data);
        } catch (err: any) {
          setError(err.message || "Error con Google");
        }
      },
    });

    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 250,
    });
  }, [navigate]);

  const validateInstitutionalEmail = (value: string) => {
    return value.trim().toLowerCase().endsWith("@ucb.edu.bo");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!validateInstitutionalEmail(normalizedEmail)) {
      setError("Debes ingresar un correo institucional @ucb.edu.bo");
      return;
    }

    try {
      const data = await loginRequest(normalizedEmail, password);
      handleAuthSuccess(data);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    }
  };

  return (
    <div className="login-shell">
      <div className="login-wrapper">
        <div className="login-left">
          <div
            className="brand-chip"
            style={{
              background: "rgba(255,255,255,0.14)",
              color: "white",
              borderColor: "rgba(255,255,255,0.18)",
            }}
          >
            <span className="brand-dot" />
            UCB LabConnect
          </div>

          <h1>Gestión moderna de laboratorios</h1>
          <p>
            Plataforma universitaria para reservas, inventario, control de apoyo técnico
            y administración de espacios académicos de la UCB.
          </p>

          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 10 }}>Acceso institucional</h3>
            <p style={{ lineHeight: 1.7 }}>
              Usa tu correo académico <b>@ucb.edu.bo</b> para ingresar al sistema.
              También puedes iniciar sesión con Google si tu cuenta pertenece al dominio institucional.
            </p>
          </div>
        </div>

        <div className="login-right">
          <h2 style={{ marginTop: 0, color: "var(--ucb-blue-dark)" }}>Iniciar sesión</h2>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Correo institucional</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu_correo@ucb.edu.bo"
              />
            </div>

            <div className="field">
              <label>Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
              />
            </div>

            {error && <div className="alert-error">{error}</div>}

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginBottom: 14 }}>
              Iniciar sesión
            </button>
          </form>

          <div style={{ marginBottom: 16 }}>
            <div ref={googleBtnRef}></div>
          </div>
        </div>
      </div>
    </div>
  );
}