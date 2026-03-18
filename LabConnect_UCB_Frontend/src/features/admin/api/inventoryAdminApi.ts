import { Asset, AssetCreate, StockItem, StockItemCreate } from "../types/inventory";

const INVENTORY_API = "http://localhost:8003/api/v1";

export async function getAssets(token: string): Promise<Asset[]> {
  const response = await fetch(`${INVENTORY_API}/assets/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data?.detail || "No se pudieron obtener los equipos");
  return data;
}

export async function createAsset(payload: AssetCreate, token: string): Promise<Asset> {
  const response = await fetch(`${INVENTORY_API}/assets/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo crear el equipo");
  return data;
}

export async function updateAssetStatus(id: number, status: string, token: string): Promise<Asset> {
  const response = await fetch(`${INVENTORY_API}/assets/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo actualizar el estado");
  return data;
}

export async function getStockItems(token: string): Promise<StockItem[]> {
  const response = await fetch(`${INVENTORY_API}/stock-items/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data?.detail || "No se pudieron obtener los reactivos");
  return data;
}

export async function createStockItem(payload: StockItemCreate, token: string): Promise<StockItem> {
  const response = await fetch(`${INVENTORY_API}/stock-items/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo crear el reactivo");
  return data;
}

export async function updateStockQuantity(id: number, quantity: number, token: string): Promise<StockItem> {
  const response = await fetch(`${INVENTORY_API}/stock-items/${id}/quantity`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ quantity_available: quantity }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo actualizar el stock");
  return data;
}