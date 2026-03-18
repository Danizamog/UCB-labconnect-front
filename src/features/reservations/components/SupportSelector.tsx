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
    <div className="card" style={{ marginTop: 18 }}>
      <h3 className="section-title">Apoyo técnico o tutoría</h3>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <input
          type="checkbox"
          checked={needsSupport}
          onChange={(e) => onNeedsSupportChange(e.target.checked)}
        />
        Necesito apoyo durante la práctica
      </label>

      {needsSupport && (
        <div className="field">
          <label>Tema o tipo de apoyo requerido</label>
          <input
            className="input"
            type="text"
            value={supportTopic}
            onChange={(e) => onSupportTopicChange(e.target.value)}
            placeholder="Ej. Configuración de equipos, redes, microscopía, etc."
          />
        </div>
      )}

      <div className="field">
        <label>Observaciones</label>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Describe brevemente el objetivo de la práctica"
        />
      </div>
    </div>
  );
}