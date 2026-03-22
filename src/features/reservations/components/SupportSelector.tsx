type Props = {
  needsSupport: boolean;
  supportTopic: string;
  notes: string;
  onNeedsSupportChange: (value: boolean) => void;
  onSupportTopicChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export default function SupportSelector({
  needsSupport,
  supportTopic,
  notes,
  onNeedsSupportChange,
  onSupportTopicChange,
  onNotesChange,
}: Props) {
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <input
          type="checkbox"
          checked={needsSupport}
          onChange={(e) => onNeedsSupportChange(e.target.checked)}
        />
        Necesito apoyo durante la practica
      </label>

      {needsSupport && (
        <div className="field">
          <label>Tema o tipo de apoyo requerido</label>
          <input
            className="input"
            type="text"
            value={supportTopic}
            onChange={(e) => onSupportTopicChange(e.target.value)}
            placeholder="Ej. configuracion de equipos, redes, microscopia, etc."
          />
        </div>
      )}

      <div className="field">
        <label>Observaciones</label>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Describe brevemente el objetivo de la practica"
        />
      </div>
    </div>
  );
}
