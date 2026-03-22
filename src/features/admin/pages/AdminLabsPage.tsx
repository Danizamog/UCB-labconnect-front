import { useEffect, useState } from "react";
import { createArea, getAllAreas, updateArea } from "../api/areasAdminApi";
import { createLab, getAllLabs, updateLab } from "../api/labsAdminApi";
import { Area } from "../types/area";
import { Lab, LabCreate } from "../types/lab";

type AreaDraft = {
  name: string;
  description: string;
  is_active: boolean;
};

export default function AdminLabsPage() {
  const token = localStorage.getItem("token") || "";
  const [labs, setLabs] = useState<Lab[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const [areaForm, setAreaForm] = useState<AreaDraft>({
    name: "",
    description: "",
    is_active: true,
  });

  const [labForm, setLabForm] = useState<LabCreate>({
    name: "",
    location: "",
    capacity: 20,
    description: "",
    is_active: true,
    area_id: 0,
  });

  const [areaDrafts, setAreaDrafts] = useState<Record<number, AreaDraft>>({});
  const [labDrafts, setLabDrafts] = useState<Record<number, LabCreate>>({});

  const loadData = async () => {
    try {
      const [labsData, areasData] = await Promise.all([getAllLabs(token), getAllAreas(token)]);
      setLabs(labsData);
      setAreas(areasData);
      setLabForm((prev) => ({
        ...prev,
        area_id: prev.area_id || areasData[0]?.id || 0,
      }));
      setAreaDrafts(
        Object.fromEntries(
          areasData.map((area) => [
            area.id,
            {
              name: area.name,
              description: area.description || "",
              is_active: area.is_active,
            },
          ])
        )
      );
      setLabDrafts(
        Object.fromEntries(
          labsData.map((lab) => [
            lab.id,
            {
              name: lab.name,
              location: lab.location,
              capacity: lab.capacity,
              description: lab.description || "",
              is_active: lab.is_active,
              area_id: lab.area_id,
            },
          ])
        )
      );
    } catch (err: any) {
      setError(err.message || "Error al cargar areas y laboratorios");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateArea = (draft: AreaDraft) => {
    if (!draft.name.trim()) return "El nombre del area es obligatorio.";
    if (draft.name.trim().length < 3) return "El nombre del area debe tener al menos 3 caracteres.";
    return "";
  };

  const validateLab = (draft: LabCreate) => {
    if (!draft.area_id) return "Debes seleccionar un area.";
    if (!draft.name.trim()) return "El nombre del laboratorio es obligatorio.";
    if (!draft.location.trim()) return "La ubicacion es obligatoria.";
    if (!draft.description?.trim()) return "La descripcion del laboratorio es obligatoria.";
    if (!Number.isFinite(draft.capacity) || draft.capacity <= 0) return "La capacidad debe ser mayor a 0.";
    return "";
  };

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateArea(areaForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await createArea(
        {
          name: areaForm.name.trim(),
          description: areaForm.description.trim(),
          is_active: areaForm.is_active,
        },
        token
      );
      setAreaForm({ name: "", description: "", is_active: true });
      setSuccess("Area creada correctamente.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "No se pudo crear el area");
    }
  };

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateLab(labForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await createLab(
        {
          ...labForm,
          name: labForm.name.trim(),
          location: labForm.location.trim(),
          description: labForm.description?.trim(),
        },
        token
      );
      setLabForm({
        name: "",
        location: "",
        capacity: 20,
        description: "",
        is_active: true,
        area_id: areas[0]?.id || 0,
      });
      setSuccess("Laboratorio creado correctamente.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "No se pudo crear el laboratorio");
    }
  };

  const handleSaveArea = async (areaId: number) => {
    const draft = areaDrafts[areaId];
    if (!draft) return;
    const validationError = validateArea(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSavingId(areaId);
      setError("");
      setSuccess("");
      await updateArea(
        areaId,
        {
          name: draft.name.trim(),
          description: draft.description.trim(),
          is_active: draft.is_active,
        },
        token
      );
      setSuccess("Area actualizada correctamente.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el area");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveLab = async (labId: number) => {
    const draft = labDrafts[labId];
    if (!draft) return;
    const validationError = validateLab(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSavingId(labId);
      setError("");
      setSuccess("");
      await updateLab(
        labId,
        {
          ...draft,
          name: draft.name.trim(),
          location: draft.location.trim(),
          description: draft.description?.trim(),
        },
        token
      );
      setSuccess("Laboratorio actualizado correctamente.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el laboratorio");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="content-stack">
      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <div className="grid-2">
        <form onSubmit={handleCreateArea} className="card professional-form">
          <h2 className="section-title">Crear area academica</h2>
          <p className="section-copy">
            Define un area activa o inactiva para organizar laboratorios, equipos y reservas.
          </p>

          <div className="field">
            <label>Nombre del area</label>
            <input
              className="input"
              required
              minLength={3}
              value={areaForm.name}
              onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Descripcion</label>
            <textarea
              className="textarea"
              required
              value={areaForm.description}
              onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Estado</label>
            <select
              className="select"
              value={areaForm.is_active ? "true" : "false"}
              onChange={(e) => setAreaForm({ ...areaForm, is_active: e.target.value === "true" })}
            >
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary">Crear area</button>
        </form>

        <form onSubmit={handleCreateLab} className="card professional-form">
          <h2 className="section-title">Crear laboratorio</h2>
          <p className="section-copy">
            Registra un laboratorio con datos operativos completos y su estado de disponibilidad.
          </p>

          <div className="field">
            <label>Area</label>
            <select
              className="select"
              value={labForm.area_id}
              onChange={(e) => setLabForm({ ...labForm, area_id: Number(e.target.value) })}
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Nombre</label>
              <input
                className="input"
                required
                value={labForm.name}
                onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Ubicacion</label>
              <input
                className="input"
                required
                value={labForm.location}
                onChange={(e) => setLabForm({ ...labForm, location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Capacidad</label>
              <input
                className="input"
                type="number"
                min={1}
                required
                value={labForm.capacity}
                onChange={(e) => setLabForm({ ...labForm, capacity: Number(e.target.value) })}
              />
            </div>

            <div className="field">
              <label>Estado</label>
              <select
                className="select"
                value={labForm.is_active ? "true" : "false"}
                onChange={(e) => setLabForm({ ...labForm, is_active: e.target.value === "true" })}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Descripcion</label>
            <textarea
              className="textarea"
              required
              value={labForm.description}
              onChange={(e) => setLabForm({ ...labForm, description: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary">Crear laboratorio</button>
        </form>
      </div>

      <div className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Editar areas</h2>
            <p className="section-copy">Actualiza nombre, descripcion y estado de visibilidad del area.</p>
          </div>
        </div>
        <div className="lab-areas-grid">
          {areas.map((area) => {
            const draft = areaDrafts[area.id];
            if (!draft) return null;
            return (
              <div key={area.id} className="editor-card">
                <div className="field">
                  <label>Nombre</label>
                  <input
                    className="input"
                    value={draft.name}
                    onChange={(e) =>
                      setAreaDrafts((prev) => ({
                        ...prev,
                        [area.id]: { ...prev[area.id], name: e.target.value },
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label>Descripcion</label>
                  <textarea
                    className="textarea"
                    value={draft.description}
                    onChange={(e) =>
                      setAreaDrafts((prev) => ({
                        ...prev,
                        [area.id]: { ...prev[area.id], description: e.target.value },
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label>Estado</label>
                  <select
                    className="select"
                    value={draft.is_active ? "true" : "false"}
                    onChange={(e) =>
                      setAreaDrafts((prev) => ({
                        ...prev,
                        [area.id]: { ...prev[area.id], is_active: e.target.value === "true" },
                      }))
                    }
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={savingId === area.id}
                  onClick={() => handleSaveArea(area.id)}
                >
                  {savingId === area.id ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Editar laboratorios</h2>
            <p className="section-copy">
              El administrador y el encargado pueden activar, desactivar y corregir toda la informacion operativa.
            </p>
          </div>
        </div>

        <div className="editor-grid">
          {labs.map((lab) => {
            const draft = labDrafts[lab.id];
            if (!draft) return null;
            return (
              <div key={lab.id} className="editor-card">
                <div className="field">
                  <label>Area</label>
                  <select
                    className="select"
                    value={draft.area_id}
                    onChange={(e) =>
                      setLabDrafts((prev) => ({
                        ...prev,
                        [lab.id]: { ...prev[lab.id], area_id: Number(e.target.value) },
                      }))
                    }
                  >
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label>Nombre</label>
                    <input
                      className="input"
                      value={draft.name}
                      onChange={(e) =>
                        setLabDrafts((prev) => ({
                          ...prev,
                          [lab.id]: { ...prev[lab.id], name: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Ubicacion</label>
                    <input
                      className="input"
                      value={draft.location}
                      onChange={(e) =>
                        setLabDrafts((prev) => ({
                          ...prev,
                          [lab.id]: { ...prev[lab.id], location: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label>Capacidad</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={draft.capacity}
                      onChange={(e) =>
                        setLabDrafts((prev) => ({
                          ...prev,
                          [lab.id]: { ...prev[lab.id], capacity: Number(e.target.value) },
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Estado</label>
                    <select
                      className="select"
                      value={draft.is_active ? "true" : "false"}
                      onChange={(e) =>
                        setLabDrafts((prev) => ({
                          ...prev,
                          [lab.id]: { ...prev[lab.id], is_active: e.target.value === "true" },
                        }))
                      }
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Descripcion</label>
                  <textarea
                    className="textarea"
                    value={draft.description}
                    onChange={(e) =>
                      setLabDrafts((prev) => ({
                        ...prev,
                        [lab.id]: { ...prev[lab.id], description: e.target.value },
                      }))
                    }
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingId === lab.id}
                  onClick={() => handleSaveLab(lab.id)}
                >
                  {savingId === lab.id ? "Guardando..." : "Guardar laboratorio"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
