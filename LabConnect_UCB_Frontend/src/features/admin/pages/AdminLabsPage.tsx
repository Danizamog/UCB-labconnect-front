import { useEffect, useState } from "react";
import { createLab, getAllLabs } from "../api/labsAdminApi";
import { Lab } from "../types/lab";

export default function AdminLabsPage() {
  const token = localStorage.getItem("token") || "";
  const [labs, setLabs] = useState<Lab[]>([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    location: "",
    capacity: 20,
    description: "",
    is_active: true,
  });

  const loadLabs = async () => {
    try {
      const data = await getAllLabs(token);
      setLabs(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar laboratorios");
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createLab(form, token);
      setForm({
        name: "",
        location: "",
        capacity: 20,
        description: "",
        is_active: true,
      });
      await loadLabs();
    } catch (err: any) {
      setError(err.message || "Error al crear laboratorio");
    }
  };

  return (
    <div>
      <h2 className="section-title">Gestión de laboratorios</h2>

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <div className="field">
            <label>Nombre</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Ubicación</label>
            <input
              className="input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Capacidad</label>
            <input
              className="input"
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </div>

          <div className="field">
            <label>Estado</label>
            <select
              className="select"
              value={form.is_active ? "true" : "false"}
              onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Descripción</label>
          <textarea
            className="textarea"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Crear laboratorio
        </button>
      </form>

      {error && <div className="alert-error">{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Ubicación</th>
              <th>Capacidad</th>
              <th>Descripción</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {labs.map((lab) => (
              <tr key={lab.id}>
                <td>{lab.name}</td>
                <td>{lab.location}</td>
                <td>{lab.capacity}</td>
                <td>{lab.description || "-"}</td>
                <td>
                  <span className={lab.is_active ? "badge badge-available" : "badge badge-damaged"}>
                    {lab.is_active ? "Sí" : "No"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}