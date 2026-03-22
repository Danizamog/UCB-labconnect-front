import { LabOption } from "../types/reservation";

type Props = {
  labs: LabOption[];
  selectedLabId: number | null;
  hidePicker?: boolean;
  date: string;
  startTime: string;
  endTime: string;
  minDate: string;
  maxDate: string;
  onLabChange: (labId: number) => void;
  onDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
};

export default function LabSelector({
  labs,
  selectedLabId,
  hidePicker = false,
  date,
  startTime,
  endTime,
  minDate,
  maxDate,
  onLabChange,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: Props) {
  const selectedLab = labs.find((lab) => lab.id === selectedLabId) || null;

  return (
    <div className="content-stack">
      <div className="card">
        <h2 className="section-title">Espacio y horario</h2>

        {!hidePicker && (
          <div className="form-block">
            <label className="form-label">Selecciona un laboratorio</label>
            <select
              className="select"
              value={selectedLabId || ""}
              onChange={(e) => onLabChange(Number(e.target.value))}
            >
              <option value="" disabled>Selecciona un laboratorio</option>
              {labs.filter((lab) => lab.is_active !== false).map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.area_name || "Area"} - {lab.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedLab && (
          <div className="selected-lab-summary">
            <div>
              <strong>Laboratorio seleccionado:</strong> {selectedLab.name}
            </div>
            <div>
              <strong>Area:</strong> {selectedLab.area_name || "Sin area"}
            </div>
            <div>
              <strong>Ubicacion:</strong> {selectedLab.location}
            </div>
            <div>
              <strong>Capacidad:</strong> {selectedLab.capacity}
            </div>
          </div>
        )}

        <div className="grid-3">
          <div>
            <label className="form-label">Fecha</label>
            <input
              className="input"
              type="date"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Hora de inicio</label>
            <input
              className="input"
              type="time"
              min="09:00"
              max="19:00"
              step={1800}
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Hora de fin</label>
            <input
              className="input"
              type="time"
              min="09:00"
              max="19:00"
              step={1800}
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
