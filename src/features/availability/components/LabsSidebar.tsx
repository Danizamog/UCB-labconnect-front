import { LabCalendar } from "../types/availability";

type Props = {
  labs: LabCalendar[];
  selectedLabId: number | null;
  onSelectLab: (labId: number | null) => void;
};

export default function LabsSidebar({ labs, selectedLabId, onSelectLab }: Props) {
  return (
    <div className="card" style={{ height: "100%" }}>
      <h3 className="section-title">Laboratorios UCB</h3>

      <div className="sidebar-nav" style={{ gap: 10 }}>
        <button
          className={`tab-btn ${selectedLabId === null ? "active" : ""}`}
          onClick={() => onSelectLab(null)}
        >
          Todos los laboratorios
        </button>

        {labs.map((lab) => (
          <button
            key={lab.laboratory_id}
            className={`tab-btn ${selectedLabId === lab.laboratory_id ? "active" : ""}`}
            onClick={() => onSelectLab(lab.laboratory_id)}
            style={{ textAlign: "left" }}
          >
            {lab.laboratory_name}
          </button>
        ))}
      </div>
    </div>
  );
}