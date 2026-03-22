import { MaterialOption, PracticeMaterialItem } from "../types/reservation";

type Props = {
  materials: MaterialOption[];
  selectedMaterials: PracticeMaterialItem[];
  onToggleMaterial: (materialId: number) => void;
  onQuantityChange: (materialId: number, quantity: number) => void;
};

export default function MaterialsSelector({
  materials,
  selectedMaterials,
  onToggleMaterial,
  onQuantityChange,
}: Props) {
  const isSelected = (materialId: number) =>
    selectedMaterials.some((item) => item.asset_id === materialId);

  const getQuantity = (materialId: number) =>
    selectedMaterials.find((item) => item.asset_id === materialId)?.quantity ?? 1;

  return (
    <div className="material-grid">
      {materials.map((material) => {
        const selected = isSelected(material.id);

        return (
          <button
            key={material.id}
            type="button"
            className={`material-card ${selected ? "selected" : ""}`}
            onClick={() => onToggleMaterial(material.id)}
          >
            <div className="material-card-top">
              <strong>{material.name}</strong>
              <span className="lab-option-badge">Disponible: {material.availableQuantity}</span>
            </div>
            <p className="material-card-copy">
              {material.source === "asset" ? "Equipo o herramienta del laboratorio." : "Reactivo o insumo disponible para la practica."}
            </p>

            {selected && (
              <div className="material-quantity-row" onClick={(e) => e.stopPropagation()}>
                <label className="form-label">Cantidad solicitada</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={material.availableQuantity}
                  value={getQuantity(material.id)}
                  onChange={(e) => onQuantityChange(material.id, Number(e.target.value))}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
