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

  const [username, setUsername] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const data = await loginRequest(username, password);
      handleAuthSuccess(data);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", fontFamily: "Arial" }}>
      <h1>LabConnect Login</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Usuario</label>
          <input
            style={{ width: "100%", padding: 10 }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin o ariel"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Contraseña</label>
          <input
            style={{ width: "100%", padding: 10 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="******"
          />
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit" style={{ padding: "10px 16px", marginBottom: 16 }}>
          Iniciar sesión
        </button>
      </form>

      <div style={{ marginBottom: 16 }}>
        <div ref={googleBtnRef}></div>
      </div>

      <div style={{ marginTop: 24 }}>
        <p><b>Admin:</b> admin / admin123</p>
        <p><b>Usuario:</b> ariel / user123</p>
      </div>
    </div>
  );
}