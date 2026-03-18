export default function AvailabilityLegend() {
  return (
    <div className="card">
      <h3 className="section-title">Leyenda</h3>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-available">Disponible</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-pending">Parcial</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-damaged">Ocupado</span>
        </div>
      </div>
    </div>
  );
}