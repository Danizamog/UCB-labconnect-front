import { useEffect, useState } from "react";
import { createAsset, getAssets, updateAssetStatus } from "../api/inventoryAdminApi";
import { Asset } from "../types/inventory";

export default function AdminAssetsPage() {
  const token = localStorage.getItem("token") || "";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    serial_number: "",
    laboratory_id: undefined as number | undefined,
    status: "available",
  });

  const loadAssets = async () => {
    try {
      const data = await getAssets(token);
      setAssets(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar equipos");
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await createAsset(form, token);
      setForm({
        name: "",
        category: "",
        description: "",
        serial_number: "",
        laboratory_id: undefined,
        status: "available",
      });
      setSuccess("Equipo registrado correctamente.");
      await loadAssets();
    } catch (err: any) {
      setError(err.message || "Error al crear equipo");
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    setError("");
    setSuccess("");

    try {
      await updateAssetStatus(id, status, token);
      setSuccess("Estado del equipo actualizado correctamente.");
      await loadAssets();
    } catch (err: any) {
      setError(err.message || "Error al cambiar estado");
    }
  };

  const badgeClass = (status: string) => {
    if (status === "available") return "badge badge-available";
    if (status === "maintenance") return "badge badge-maintenance";
    if (status === "damaged") return "badge badge-damaged";
    return "badge";
  };

  const labelStatus = (status: string) => {
    if (status === "available") return "Disponible";
    if (status === "maintenance") return "En mantenimiento";
    if (status === "damaged") return "Dañado";
    return status;
  };

  return (
    <div>
      <h2 className="section-title">Gestión de equipos y herramientas</h2>

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <div className="field">
            <label>Nombre del equipo</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Categoría</label>
            <input
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Número de serie</label>
            <input
              className="input"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Estado inicial</label>
            <select
              className="select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="available">Disponible</option>
              <option value="maintenance">En mantenimiento</option>
              <option value="damaged">Dañado</option>
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
          Registrar equipo
        </button>
      </form>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Serie</th>
              <th>Estado actual</th>
              <th>Actualizar estado</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.name}</td>
                <td>{asset.category}</td>
                <td>{asset.serial_number || "-"}</td>
                <td>
                  <span className={badgeClass(asset.status)}>
                    {labelStatus(asset.status)}
                  </span>
                </td>
                <td>
                  <select
                    className="select"
                    value={asset.status}
                    onChange={(e) => handleStatusChange(asset.id, e.target.value)}
                  >
                    <option value="available">Disponible</option>
                    <option value="maintenance">En mantenimiento</option>
                    <option value="damaged">Dañado</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}