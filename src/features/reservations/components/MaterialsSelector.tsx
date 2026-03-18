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
    <div className="card" style={{ padding: 18 }}>
      <h3 className="section-title">Materiales e insumos</h3>

      {materials.map((material) => {
        const selected = isSelected(material.id);

        return (
          <div key={material.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #eef2f7" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleMaterial(material.id)}
                />
                <span>{material.name} (Disponible: {material.availableQuantity})</span>
              </label>
            </div>

            {selected && (
              <input
                className="input"
                style={{ width: 90 }}
                type="number"
                min={1}
                max={material.availableQuantity}
                value={getQuantity(material.id)}
                onChange={(e) => onQuantityChange(material.id, Number(e.target.value))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}