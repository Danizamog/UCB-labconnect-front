import { useEffect, useState } from "react";
import { getAllLabs } from "../api/labsAdminApi";
import { createStockItem, getStockItems, updateStockItem } from "../api/inventoryAdminApi";
import { StockItem, StockItemCreate } from "../types/inventory";
import { Lab } from "../types/lab";

export default function AdminStockPage() {
  const token = localStorage.getItem("token") || "";
  const [items, setItems] = useState<StockItem[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const [form, setForm] = useState<StockItemCreate>({
    name: "",
    category: "",
    unit: "",
    quantity_available: 0,
    minimum_stock: 0,
    laboratory_id: undefined,
    description: "",
  });
  const [drafts, setDrafts] = useState<Record<number, StockItemCreate>>({});

  const validateStock = (payload: StockItemCreate) => {
    if (!payload.name.trim()) return "El nombre del reactivo es obligatorio.";
    if (!payload.category.trim()) return "La categoria es obligatoria.";
    if (!payload.unit.trim()) return "La unidad es obligatoria.";
    if (!payload.description?.trim()) return "La descripcion es obligatoria.";
    if (!payload.laboratory_id) return "Debes seleccionar un laboratorio.";
    if (payload.quantity_available < 0) return "La cantidad no puede ser negativa.";
    if (payload.minimum_stock < 0) return "El stock minimo no puede ser negativo.";
    return "";
  };

  const loadData = async (labId?: number) => {
    try {
      const [itemsData, labsData] = await Promise.all([getStockItems(token, labId), getAllLabs(token)]);
      setItems(itemsData);
      setLabs(labsData);
      setForm((prev) => ({ ...prev, laboratory_id: prev.laboratory_id || labsData[0]?.id }));
      setDrafts(
        Object.fromEntries(
          itemsData.map((item) => [
            item.id,
            {
              name: item.name,
              category: item.category,
              unit: item.unit,
              quantity_available: item.quantity_available,
              minimum_stock: item.minimum_stock,
              laboratory_id: item.laboratory_id,
              description: item.description || "",
            },
          ])
        )
      );
    } catch (err: any) {
      setError(err.message || "Error al cargar reactivos");
    }
  };

  useEffect(() => {
    loadData(selectedLabId);
  }, [selectedLabId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateStock(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await createStockItem(
        {
          ...form,
          name: form.name.trim(),
          category: form.category.trim(),
          unit: form.unit.trim(),
          description: form.description?.trim(),
        },
        token
      );
      setForm({
        name: "",
        category: "",
        unit: "",
        quantity_available: 0,
        minimum_stock: 0,
        laboratory_id: form.laboratory_id,
        description: "",
      });
      setSuccess("Reactivo registrado correctamente.");
      await loadData(selectedLabId);
    } catch (err: any) {
      setError(err.message || "Error al crear reactivo");
    }
  };

  const handleSave = async (itemId: number) => {
    const draft = drafts[itemId];
    if (!draft) return;

    const validationError = validateStock(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSavingId(itemId);
      setError("");
      setSuccess("");
      await updateStockItem(
        itemId,
        {
          ...draft,
          name: draft.name.trim(),
          category: draft.category.trim(),
          unit: draft.unit.trim(),
          description: draft.description?.trim(),
        },
        token
      );
      setSuccess("Reactivo actualizado correctamente.");
      await loadData(selectedLabId);
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el reactivo");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="content-stack">
      <div className="policy-card">
        <h3>Control de reactivos y stock</h3>
        <p>
          Registra cantidades reales, unidades consistentes y umbrales minimos para evitar quiebres de stock y errores en las reservas.
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

      <form onSubmit={handleSubmit} className="card professional-form">
        <h2 className="section-title">Registrar reactivo</h2>
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
        <div className="grid-3">
          <div className="field">
            <label>Unidad</label>
            <input className="input" required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="field">
            <label>Cantidad disponible</label>
            <input className="input" type="number" min={0} required value={form.quantity_available} onChange={(e) => setForm({ ...form, quantity_available: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Stock minimo</label>
            <input className="input" type="number" min={0} required value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Laboratorio</label>
            <select className="select" value={form.laboratory_id || ""} onChange={(e) => setForm({ ...form, laboratory_id: e.target.value ? Number(e.target.value) : undefined })}>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Descripcion</label>
            <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary">Registrar reactivo</button>
      </form>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <div className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Editar reactivos</h2>
            <p className="section-copy">Corrige cantidades, unidades, descripcion y laboratorio sin salir del panel.</p>
          </div>
        </div>

        <div className="editor-grid">
          {items.map((item) => {
            const draft = drafts[item.id];
            if (!draft) return null;
            return (
              <div key={item.id} className="editor-card">
                <div className="grid-2">
                  <div className="field">
                    <label>Nombre</label>
                    <input className="input" value={draft.name} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], name: e.target.value } }))} />
                  </div>
                  <div className="field">
                    <label>Categoria</label>
                    <input className="input" value={draft.category} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], category: e.target.value } }))} />
                  </div>
                </div>

                <div className="grid-3">
                  <div className="field">
                    <label>Unidad</label>
                    <input className="input" value={draft.unit} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], unit: e.target.value } }))} />
                  </div>
                  <div className="field">
                    <label>Cantidad</label>
                    <input className="input" type="number" min={0} value={draft.quantity_available} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], quantity_available: Number(e.target.value) } }))} />
                  </div>
                  <div className="field">
                    <label>Minimo</label>
                    <input className="input" type="number" min={0} value={draft.minimum_stock} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], minimum_stock: Number(e.target.value) } }))} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label>Laboratorio</label>
                    <select className="select" value={draft.laboratory_id || ""} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], laboratory_id: e.target.value ? Number(e.target.value) : undefined } }))}>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>{lab.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Descripcion</label>
                    <input className="input" value={draft.description} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], description: e.target.value } }))} />
                  </div>
                </div>

                <button type="button" className="btn btn-secondary" disabled={savingId === item.id} onClick={() => handleSave(item.id)}>
                  {savingId === item.id ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
