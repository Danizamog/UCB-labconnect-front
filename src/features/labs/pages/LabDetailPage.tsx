import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardHero from "../../../components/dashboard/DashboardHero";
import { getAssets, getStockItems } from "../../admin/api/inventoryAdminApi";
import { Asset, StockItem } from "../../admin/types/inventory";
import { getLabById } from "../../reservations/api/reservationsApi";
import { LabOption } from "../../reservations/types/reservation";

export default function LabDetailPage() {
  const navigate = useNavigate();
  const { labId } = useParams();
  const token = localStorage.getItem("token") || "";

  const [lab, setLab] = useState<LabOption | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !labId) {
      navigate("/login");
      return;
    }

    const numericLabId = Number(labId);

    Promise.all([
      getLabById(numericLabId, token),
      getAssets(token, numericLabId),
      getStockItems(token, numericLabId),
    ])
      .then(([labData, assetsData, stockData]) => {
        setLab(labData);
        setAssets(assetsData);
        setStockItems(stockData);
      })
      .catch((err: any) => {
        setError(err.message || "No se pudo cargar la informacion del laboratorio");
      });
  }, [labId, navigate, token]);

  if (!lab) {
    return (
      <div className="page-shell">
        <div className="page-container">
          {error ? <div className="alert-error">{error}</div> : <div className="card">Cargando laboratorio...</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container content-stack">
        <DashboardHero
          title={lab.name}
          subtitle={`${lab.area_name || "Area"} · ${lab.location} · Capacidad ${lab.capacity}`}
        />

        {error && <div className="alert-error">{error}</div>}

        <div className="grid-2">
          <div className="card">
            <h2 className="section-title">Informacion general</h2>
            <p><b>Area:</b> {lab.area_name || "-"}</p>
            <p><b>Ubicacion:</b> {lab.location}</p>
            <p><b>Capacidad:</b> {lab.capacity}</p>
            <p><b>Estado:</b> {lab.is_active ? "Activo" : "Inactivo"}</p>
            <p><b>Descripcion:</b> {lab.description || "Sin descripcion registrada."}</p>
          </div>

          <div className="card">
            <h2 className="section-title">Acciones</h2>
            <div className="content-stack">
              <button className="btn btn-primary" onClick={() => navigate(`/user/practicas/nueva?lab=${lab.id}`)}>
                Reservar este laboratorio
              </button>
              <button className="btn btn-secondary" onClick={() => navigate(`/laboratorios/calendario?lab=${lab.id}`)}>
                Consultar horarios
              </button>
              <button className="btn btn-secondary" onClick={() => navigate("/user")}>
                Volver al portal
              </button>
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <h2 className="section-title">Equipos y herramientas</h2>
            {assets.length === 0 ? (
              <p>No hay equipos registrados para este laboratorio.</p>
            ) : (
              <div className="content-stack">
                {assets.map((asset) => (
                  <div key={asset.id} className="card" style={{ padding: 16 }}>
                    <strong>{asset.name}</strong>
                    <p style={{ marginBottom: 6 }}>{asset.category}</p>
                    <span className="badge badge-available">{asset.status}</span>
                    {asset.description && <p>{asset.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Reactivos y stock</h2>
            {stockItems.length === 0 ? (
              <p>No hay reactivos registrados para este laboratorio.</p>
            ) : (
              <div className="content-stack">
                {stockItems.map((item) => (
                  <div key={item.id} className="card" style={{ padding: 16 }}>
                    <strong>{item.name}</strong>
                    <p style={{ marginBottom: 6 }}>{item.category}</p>
                    <p style={{ margin: 0 }}>
                      Stock: {item.quantity_available} {item.unit} · Minimo: {item.minimum_stock}
                    </p>
                    {item.description && <p>{item.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
