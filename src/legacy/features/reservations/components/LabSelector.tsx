import { LabOption } from "../types/reservation";

type Props = {
  labs: LabOption[];
  selectedLabId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  onLabChange: (labId: number) => void;
  onDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
};

export default function LabSelector({
  labs,
  selectedLabId,
  date,
  startTime,
  endTime,
  onLabChange,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: Props) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 className="section-title">Espacio y horario</h3>

      <div className="field">
        <label>Laboratorio</label>
        <select
          className="select"
          value={selectedLabId ?? ""}
          onChange={(e) => onLabChange(Number(e.target.value))}
        >
          <option value="">Selecciona un laboratorio</option>
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.name} - {lab.location} - Capacidad {lab.capacity}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Fecha</label>
        <input className="input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Hora de inicio</label>
          <input className="input" type="time" value={startTime} onChange={(e) => onStartTimeChange(e.target.value)} />
        </div>
        <div className="field">
          <label>Hora de fin</label>
          <input className="input" type="time" value={endTime} onChange={(e) => onEndTimeChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}