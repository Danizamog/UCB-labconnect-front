import { useEffect, useMemo, useState } from "react";
import { getAssets, getStockItems } from "../../admin/api/inventoryAdminApi";
import LabSelector from "./LabSelector";
import MaterialsSelector from "./MaterialsSelector";
import SupportSelector from "./SupportSelector";
import { createPracticePlanning, getLabs } from "../api/reservationsApi";
import {
  LabOption,
  MaterialOption,
  PracticeMaterialItem,
  PracticeRequestCreate,
} from "../types/reservation";

type Props = {
  initialLabId?: number | null;
};

const buildDateRange = () => {
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 30);
  const toIsoDate = (value: Date) => value.toISOString().split("T")[0];
  return { minDate: toIsoDate(today), maxDate: toIsoDate(maxDate) };
};

export default function PracticePlanningForm({ initialLabId = null }: Props) {
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
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { minDate, maxDate } = useMemo(() => buildDateRange(), []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("No hay sesion activa.");
      return;
    }

    getLabs(token)
      .then((data) => setLabs(data.filter((lab) => lab.is_active !== false)))
      .catch((err: any) => {
        setError(err.message || "No se pudieron obtener los laboratorios");
        setLabs([]);
      });
  }, []);

  useEffect(() => {
    if (initialLabId) {
      setSelectedLabId(initialLabId);
    }
  }, [initialLabId]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !selectedLabId) {
      setMaterials([]);
      setSelectedMaterials([]);
      return;
    }

    Promise.all([getAssets(token, selectedLabId), getStockItems(token, selectedLabId)])
      .then(([assets, stock]) => {
        const nextMaterials: MaterialOption[] = [
          ...assets
            .filter((asset) => asset.status === "available" && asset.quantity_available > 0)
            .map((asset) => ({
              id: asset.id,
              name: `${asset.name} (${asset.category})`,
              availableQuantity: asset.quantity_available,
              source: "asset" as const,
            })),
          ...stock
            .filter((item) => item.quantity_available > 0)
            .map((item) => ({
              id: 100000 + item.id,
              name: `${item.name} (${item.category})`,
              availableQuantity: item.quantity_available,
              source: "stock" as const,
            })),
        ];
        setMaterials(nextMaterials);
        setSelectedMaterials([]);
      })
      .catch((err: any) => {
        setError(err.message || "No se pudo cargar el inventario del laboratorio");
      });
  }, [selectedLabId]);

  const selectedLab = useMemo(() => labs.find((lab) => lab.id === selectedLabId) || null, [labs, selectedLabId]);

  const handleToggleMaterial = (materialId: number) => {
    setSelectedMaterials((prev) => {
      const exists = prev.some((item) => item.asset_id === materialId);
      if (exists) {
        return prev.filter((item) => item.asset_id !== materialId);
      }
      const material = materials.find((item) => item.id === materialId);
      return [
        ...prev,
        {
          asset_id: materialId,
          quantity: 1,
          material_name: material?.name,
        },
      ];
    });
  };

  const handleQuantityChange = (materialId: number, quantity: number) => {
    const material = materials.find((item) => item.id === materialId);
    const normalizedQuantity = Math.max(1, Math.min(quantity || 1, material?.availableQuantity || 1));
    setSelectedMaterials((prev) =>
      prev.map((item) => (item.asset_id === materialId ? { ...item, quantity: normalizedQuantity } : item))
    );
  };

  const validateForm = () => {
    if (!selectedLabId) return "Debes seleccionar un laboratorio.";
    if (!date) return "Debes seleccionar una fecha.";
    if (date < minDate) return "No puedes reservar en una fecha pasada.";
    if (date > maxDate) return "Solo puedes reservar dentro de los proximos 30 dias.";
    if (!startTime || !endTime) return "Debes seleccionar un horario.";
    if (startTime < "09:00" || startTime > "19:00") return "La hora de inicio debe estar entre 09:00 y 19:00.";
    if (endTime < "09:00" || endTime > "19:00") return "La hora de fin debe estar entre 09:00 y 19:00.";
    if (startTime >= endTime) return "La hora de inicio debe ser menor que la hora de fin.";
    if (needsSupport && !supportTopic.trim()) return "Debes indicar el tipo de apoyo requerido.";
    if (!notes.trim()) return "Las observaciones son obligatorias.";
    if (!acceptedPolicy) return "Debes aceptar el compromiso de uso responsable del laboratorio.";
    return "";
  };

  const resetForm = () => {
    setDate("");
    setStartTime("");
    setEndTime("");
    setSelectedMaterials([]);
    setNeedsSupport(false);
    setSupportTopic("");
    setNotes("");
    setAcceptedPolicy(false);
    setShowPolicyModal(false);
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
      setError("No hay sesion activa.");
      return;
    }

    const payload: PracticeRequestCreate = {
      laboratory_id: selectedLabId!,
      date,
      start_time: startTime,
      end_time: endTime,
      materials: selectedMaterials,
      needs_support: needsSupport,
      support_topic: needsSupport ? supportTopic.trim() : undefined,
      notes: notes.trim(),
    };

    try {
      setLoading(true);
      await createPracticePlanning(payload, token);
      setSuccess("La practica fue planificada correctamente.");
      resetForm();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar la planificacion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="content-stack">
        <LabSelector
          labs={labs}
          selectedLabId={selectedLabId}
          hidePicker={Boolean(initialLabId)}
          date={date}
          startTime={startTime}
          endTime={endTime}
          minDate={minDate}
          maxDate={maxDate}
          onLabChange={setSelectedLabId}
          onDateChange={setDate}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
        />

        <div className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Materiales e insumos</h2>
              <p className="section-copy">
                Selecciona solo lo que realmente usaras. El prestamo operativo lo valida y registra el encargado en un espacio separado.
              </p>
            </div>
          </div>
          {!selectedLab ? (
            <p>Selecciona primero un laboratorio.</p>
          ) : materials.length === 0 ? (
            <p>No hay herramientas ni reactivos disponibles para este laboratorio.</p>
          ) : (
            <MaterialsSelector
              materials={materials}
              selectedMaterials={selectedMaterials}
              onToggleMaterial={handleToggleMaterial}
              onQuantityChange={handleQuantityChange}
            />
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Apoyo tecnico o tutoria</h2>
          <SupportSelector
            needsSupport={needsSupport}
            supportTopic={supportTopic}
            notes={notes}
            onNeedsSupportChange={setNeedsSupport}
            onSupportTopicChange={setSupportTopic}
            onNotesChange={setNotes}
          />
        </div>

        <div className="request-contract-card">
          <div>
            <h3>Compromiso de uso responsable</h3>
            <p>Revisa las politicas antes de enviar la solicitud academica.</p>
          </div>
          <button type="button" className="btn btn-accent" onClick={() => setShowPolicyModal(true)}>
            Ver compromiso
          </button>
        </div>

        <label className="consent-row">
          <input
            type="checkbox"
            checked={acceptedPolicy}
            onChange={(e) => setAcceptedPolicy(e.target.checked)}
          />
          Acepto las politicas de uso y custodia del laboratorio.
        </label>

        {error && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Guardando..." : "Planificar practica"}
          </button>
        </div>
      </form>

      {showPolicyModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Compromiso de uso responsable</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPolicyModal(false)}>
                Cerrar
              </button>
            </div>
            <p>
              Declaro que la solicitud responde a una practica academica real, que respetare los horarios asignados,
              cuidare equipos, herramientas y reactivos, y notificare cualquier incidente o dano al encargado del laboratorio.
            </p>
            <ul className="clean-list">
              <li>No se admiten fechas pasadas ni solicitudes fuera del rango de 30 dias.</li>
              <li>Las practicas deben programarse entre las 09:00 y las 19:00 horas.</li>
              <li>Solo deben solicitarse materiales coherentes con la practica academica.</li>
              <li>El encargado valida y registra formalmente los prestamos de equipos.</li>
            </ul>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setAcceptedPolicy(true);
                  setShowPolicyModal(false);
                }}
              >
                Aceptar compromiso
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
