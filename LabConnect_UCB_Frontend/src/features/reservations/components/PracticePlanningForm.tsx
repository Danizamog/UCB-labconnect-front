import { useEffect, useState } from "react";
import LabSelector from "./LabSelector";
import MaterialsSelector from "./MaterialsSelector";
import SupportSelector from "./SupportSelector";
import {
  createPracticePlanning,
  getLabs,
  getMaterialsMock,
} from "../api/reservationsApi";
import {
  LabOption,
  MaterialOption,
  PracticeMaterialItem,
  PracticeRequestCreate,
} from "../types/reservation";

export default function PracticePlanningForm() {
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);

  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<PracticeMaterialItem[]>([]);
  const [needsSupport, setNeedsSupport] = useState(false);
  const [supportTopic, setSupportTopic] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLabs().then(setLabs).catch(() => setLabs([]));
    getMaterialsMock().then(setMaterials);
  }, []);

  const handleToggleMaterial = (materialId: number) => {
    setSelectedMaterials((prev) => {
      const exists = prev.some((item) => item.asset_id === materialId);
      if (exists) {
        return prev.filter((item) => item.asset_id !== materialId);
      }
      return [...prev, { asset_id: materialId, quantity: 1 }];
    });
  };

  const handleQuantityChange = (materialId: number, quantity: number) => {
    setSelectedMaterials((prev) =>
      prev.map((item) =>
        item.asset_id === materialId
          ? { ...item, quantity: quantity > 0 ? quantity : 1 }
          : item
      )
    );
  };

  const validateForm = () => {
    if (!selectedLabId) return "Debes seleccionar un laboratorio.";
    if (!date) return "Debes seleccionar una fecha.";
    if (!startTime || !endTime) return "Debes seleccionar un horario.";
    if (startTime >= endTime) return "La hora de inicio debe ser menor que la hora de fin.";
    if (needsSupport && !supportTopic.trim()) return "Debes indicar el tipo de apoyo requerido.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("No hay sesión activa.");
      return;
    }

    const payload: PracticeRequestCreate = {
      laboratory_id: selectedLabId!,
      date,
      start_time: startTime,
      end_time: endTime,
      materials: selectedMaterials,
      needs_support: needsSupport,
      support_topic: needsSupport ? supportTopic : undefined,
      notes: notes.trim() || undefined,
    };

    try {
      setLoading(true);
      await createPracticePlanning(payload, token);
      setSuccess("La práctica fue planificada correctamente.");
      setSelectedLabId(null);
      setDate("");
      setStartTime("");
      setEndTime("");
      setSelectedMaterials([]);
      setNeedsSupport(false);
      setSupportTopic("");
      setNotes("");
    } catch (err: any) {
      setError(err.message || "No se pudo registrar la planificación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="grid-2">
        <div>
          <LabSelector
            labs={labs}
            selectedLabId={selectedLabId}
            date={date}
            startTime={startTime}
            endTime={endTime}
            onLabChange={setSelectedLabId}
            onDateChange={setDate}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
          />
        </div>

        <div>
          <MaterialsSelector
            materials={materials}
            selectedMaterials={selectedMaterials}
            onToggleMaterial={handleToggleMaterial}
            onQuantityChange={handleQuantityChange}
          />
        </div>
      </div>

      <SupportSelector
        needsSupport={needsSupport}
        supportTopic={supportTopic}
        notes={notes}
        onNeedsSupportChange={setNeedsSupport}
        onSupportTopicChange={setSupportTopic}
        onNotesChange={setNotes}
      />

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? "Guardando..." : "Planificar práctica"}
      </button>
    </form>
  );
}