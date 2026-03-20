import React from "react";

export default function AvailabilityLegend() {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 className="section-title" style={{ fontSize: 16, marginBottom: 12 }}>Leyenda de disponibilidad</h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 12,
            background: "#e8f8ec",
            border: "1px solid #7ac77a",
            color: "#2d5a27",
            fontSize: 12,
            fontWeight: 600
          }}>Disponible</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 12,
            background: "#fff6dd",
            border: "1px solid #f2c94c",
            color: "#856404",
            fontSize: 12,
            fontWeight: 600
          }}>Parcial</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 12,
            background: "#fdeaea",
            border: "1px solid #e57373",
            color: "#721c24",
            fontSize: 12,
            fontWeight: 600
          }}>Ocupado</span>
        </div>
      </div>
    </div>
  );
}
