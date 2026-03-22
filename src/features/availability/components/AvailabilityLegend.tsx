export default function AvailabilityLegend() {
  return (
    <div className="card">
      <h3 className="section-title">Leyenda</h3>
      <div className="legend-row">
        <div className="legend-item">
          <span className="badge badge-available">Disponible</span>
        </div>
        <div className="legend-item">
          <span className="badge badge-pending">Parcial</span>
        </div>
        <div className="legend-item">
          <span className="badge badge-damaged">Ocupado</span>
        </div>
      </div>
    </div>
  );
}
