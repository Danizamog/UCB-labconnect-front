import { useEffect, useState } from "react";
import { createStockItem, getStockItems, updateStockQuantity } from "../api/inventoryAdminApi";
import { StockItem } from "../types/inventory";

export default function AdminStockPage() {
  const token = localStorage.getItem("token") || "";
  const [items, setItems] = useState<StockItem[]>([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "",
    unit: "",
    quantity_available: 0,
    minimum_stock: 0,
    laboratory_id: undefined as number | undefined,
    description: "",
  });

  const loadItems = async () => {
    try {
      const data = await getStockItems(token);
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar reactivos");
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createStockItem(form, token);
      setForm({
        name: "",
        category: "",
        unit: "",
        quantity_available: 0,
        minimum_stock: 0,
        laboratory_id: undefined,
        description: "",
      });
      await loadItems();
    } catch (err: any) {
      setError(err.message || "Error al crear reactivo");
    }
  };

  const handleQuantityChange = async (id: number, quantity: number) => {
    try {
      await updateStockQuantity(id, quantity, token);
      await loadItems();
    } catch (err: any) {
      setError(err.message || "Error al actualizar stock");
    }
  };

  return (
    <div>
      <h2 className="section-title">Gestión de reactivos y stock</h2>

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <div className="field">
            <label>Nombre</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Categoría</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
        </div>

        <div className="grid-3">
          <div className="field">
            <label>Unidad</label>
            <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input className="input" type="number" value={form.quantity_available} onChange={(e) => setForm({ ...form, quantity_available: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Stock mínimo</label>
            <input className="input" type="number" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: Number(e.target.value) })} />
          </div>
        </div>

        <div className="field">
          <label>Descripción</label>
          <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <button type="submit" className="btn btn-primary">Registrar reactivo</button>
      </form>

      {error && <div className="alert-error">{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th>Cantidad</th>
              <th>Stock mínimo</th>
              <th>Actualizar stock</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.unit}</td>
                <td>{item.quantity_available}</td>
                <td>{item.minimum_stock}</td>
                <td>
                  <input
                    className="input"
                    type="number"
                    defaultValue={item.quantity_available}
                    onBlur={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}