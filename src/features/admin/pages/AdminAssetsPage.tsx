import { useEffect, useMemo, useState } from "react";
import { getAllLabs } from "../api/labsAdminApi";
import {
  createAsset,
  getAssets,
  updateAsset,
  updateAssetStatus,
} from "../api/inventoryAdminApi";
import { Asset, AssetCreate } from "../types/inventory";
import { Lab } from "../types/lab";

export default function AdminAssetsPage() {
  const token = localStorage.getItem("token") || "";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const [form, setForm] = useState<AssetCreate>({
    name: "",
    category: "",
    description: "",
    serial_number: "",
    laboratory_id: undefined,
    quantity_total: 1,
    quantity_available: 1,
    status: "available",
  });

  const [drafts, setDrafts] = useState<Record<number, AssetCreate>>({});

  const loadData = async (labId?: number) => {
    try {
      const [assetsData, labsData] = await Promise.all([getAssets(token, labId), getAllLabs(token)]);
      setAssets(assetsData);
      setLabs(labsData);
      setForm((prev) => ({ ...prev, laboratory_id: prev.laboratory_id || labsData[0]?.id }));
      setDrafts(
        Object.fromEntries(
          assetsData.map((asset) => [
            asset.id,
            {
              name: asset.name,
              category: asset.category,
              description: asset.description || "",
              serial_number: asset.serial_number || "",
              laboratory_id: asset.laboratory_id,
              quantity_total: asset.quantity_total,
              quantity_available: asset.quantity_available,
              status: asset.status,
            },
          ])
        )
      );
    } catch (err: any) {
      setError(err.message || "Error al cargar equipos");
    }
  };

  useEffect(() => {
    loadData(selectedLabId);
  }, [selectedLabId]);

  const validateAsset = (payload: AssetCreate) => {
    if (!payload.name.trim()) return "El nombre del equipo es obligatorio.";
    if (!payload.category.trim()) return "La categoria es obligatoria.";
    if (!payload.description?.trim()) return "La descripcion es obligatoria.";
    if (!payload.laboratory_id) return "Debes seleccionar un laboratorio.";
    if (payload.quantity_total <= 0) return "La cantidad total debe ser mayor a 0.";
    if (payload.quantity_available < 0) return "La cantidad disponible no puede ser negativa.";
    if (payload.quantity_available > payload.quantity_total) return "La cantidad disponible no puede ser mayor a la total.";
    return "";
  };

  return (
    <div className="content-stack">
      <div className="policy-card">
        <h3>Politica de custodia y uso de equipos</h3>
        <p>
          Todo registro debe reflejar la cantidad real disponible, el estado operativo y el responsable del prestamo.
          Cada movimiento debe quedar trazable para auditoria interna.
        </p>
      </div>

      <div className="card">
        <h2 className="section-title">Filtro por laboratorio</h2>
        <select
          className="select"
          value={selectedLabId || ""}
          onChange={(e) => setSelectedLabId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Todos los laboratorios</option>
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>{lab.name}</option>
          ))}
        </select>
      </div>

      <div className="card professional-form">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            const validationError = validateAsset(form);
            if (validationError) {
              setError(validationError);
              return;
            }
            createAsset(
              {
                ...form,
                name: form.name.trim(),
                category: form.category.trim(),
                description: form.description?.trim(),
                serial_number: form.serial_number?.trim(),
              },
              token
            )
              .then(() => {
                setSuccess("Equipo registrado correctamente.");
                setForm({
                  name: "",
                  category: "",
                  description: "",
                  serial_number: "",
                  laboratory_id: form.laboratory_id,
                  quantity_total: 1,
                  quantity_available: 1,
                  status: "available",
                });
                return loadData(selectedLabId);
              })
              .catch((err: any) => setError(err.message || "Error al crear equipo"));
          }}
        >
          <h2 className="section-title">Registrar equipo</h2>
          <p className="section-copy">El control de prestamos y el historial operativo ahora viven en una seccion independiente de trazabilidad.</p>
          <div className="grid-2">
            <div className="field">
              <label>Nombre</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Categoria</label>
              <input className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Numero de serie</label>
              <input className="input" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div className="field">
              <label>Laboratorio</label>
              <select className="select" value={form.laboratory_id || ""} onChange={(e) => setForm({ ...form, laboratory_id: e.target.value ? Number(e.target.value) : undefined })}>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-3">
            <div className="field">
              <label>Cantidad total</label>
              <input className="input" type="number" min={1} required value={form.quantity_total} onChange={(e) => {
                const quantityTotal = Number(e.target.value);
                setForm({
                  ...form,
                  quantity_total: quantityTotal,
                  quantity_available: Math.min(form.quantity_available, Math.max(quantityTotal, 1)),
                });
              }} />
            </div>
            <div className="field">
              <label>Cantidad disponible</label>
              <input className="input" type="number" min={0} required value={form.quantity_available} onChange={(e) => setForm({ ...form, quantity_available: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Estado</label>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="available">Disponible</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="damaged">Danado</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Descripcion</label>
            <textarea className="textarea" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">Registrar equipo</button>
        </form>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <div className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Editar equipos y herramientas</h2>
            <p className="section-copy">Cada tarjeta permite corregir estado, cantidades, laboratorio y descripcion.</p>
          </div>
        </div>

        <div className="editor-grid">
          {assets.map((asset) => {
            const draft = drafts[asset.id];
            if (!draft) return null;
            return (
              <div key={asset.id} className="editor-card">
                <div className="grid-2">
                  <div className="field">
                    <label>Nombre</label>
                    <input className="input" value={draft.name} onChange={(e) => setDrafts((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], name: e.target.value } }))} />
                  </div>
                  <div className="field">
                    <label>Categoria</label>
                    <input className="input" value={draft.category} onChange={(e) => setDrafts((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], category: e.target.value } }))} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label>Serie</label>
                    <input className="input" value={draft.serial_number} onChange={(e) => setDrafts((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], serial_number: e.target.value } }))} />
                  </div>
                  <div className="field">
                    <label>Laboratorio</label>
                    <select className="select" value={draft.laboratory_id || ""} onChange={(e) => setDrafts((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], laboratory_id: e.target.value ? Number(e.target.value) : undefined } }))}>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>{lab.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-3">
                  <div className="field">
                    <label>Total</label>
                    <input className="input" type="number" min={1} value={draft.quantity_total} onChange={(e) => {
                      const quantityTotal = Number(e.target.value);
                      setDrafts((prev) => ({
                        ...prev,
                        [asset.id]: {
                          ...prev[asset.id],
                          quantity_total: quantityTotal,
                          quantity_available: Math.min(prev[asset.id].quantity_available, Math.max(quantityTotal, 1)),
                        },
                      }));
                    }} />
                  </div>
                  <div className="field">
                    <label>Disponible</label>
                    <input className="input" type="number" min={0} value={draft.quantity_available} onChange={(e) => setDrafts((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], quantity_available: Number(e.target.value) } }))} />
                  </div>
                  <div className="field">
                    <label>Estado</label>
                    <select className="select" value={draft.status} onChange={(e) => {
                      const status = e.target.value;
                      setDrafts((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], status } }));
                      updateAssetStatus(asset.id, status, token)
                        .then(() => loadData(selectedLabId))
                        .catch((err: any) => setError(err.message || "No se pudo actualizar el estado"));
                    }}>
                      <option value="available">Disponible</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="damaged">Danado</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Descripcion</label>
                  <textarea className="textarea" value={draft.description} onChange={(e) => setDrafts((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], description: e.target.value } }))} />
                </div>

                <div className="editor-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={savingId === asset.id}
                    onClick={() => {
                      const validationError = validateAsset(draft);
                      if (validationError) {
                        setError(validationError);
                        return;
                      }
                      setSavingId(asset.id);
                      setError("");
                      setSuccess("");
                      updateAsset(
                        asset.id,
                        {
                          ...draft,
                          name: draft.name.trim(),
                          category: draft.category.trim(),
                          description: draft.description?.trim(),
                          serial_number: draft.serial_number?.trim(),
                        },
                        token
                      )
                        .then(() => {
                          setSuccess("Equipo actualizado correctamente.");
                          return loadData(selectedLabId);
                        })
                        .catch((err: any) => setError(err.message || "No se pudo actualizar el equipo"))
                        .finally(() => setSavingId(null));
                    }}
                  >
                    {savingId === asset.id ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
