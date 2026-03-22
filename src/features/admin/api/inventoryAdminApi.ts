import { Asset, AssetCreate, AssetLoan, StockItem, StockItemCreate } from "../types/inventory";

const INVENTORY_API = "http://localhost:8003/api/v1";

export async function getAssets(token: string, laboratoryId?: number): Promise<Asset[]> {
  const url = new URL(`${INVENTORY_API}/assets/`);
  if (laboratoryId) url.searchParams.set("laboratory_id", String(laboratoryId));

  const response = await fetch(url.toString(), {
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

export async function updateAsset(id: number, payload: AssetCreate, token: string): Promise<Asset> {
  const response = await fetch(`${INVENTORY_API}/assets/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo actualizar el equipo");
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

export async function getStockItems(token: string, laboratoryId?: number): Promise<StockItem[]> {
  const url = new URL(`${INVENTORY_API}/stock-items/`);
  if (laboratoryId) url.searchParams.set("laboratory_id", String(laboratoryId));

  const response = await fetch(url.toString(), {
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

export async function updateStockItem(id: number, payload: StockItemCreate, token: string): Promise<StockItem> {
  const response = await fetch(`${INVENTORY_API}/stock-items/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo actualizar el reactivo");
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

export async function getAssetLoans(token: string, assetId?: number): Promise<AssetLoan[]> {
  const url = new URL(`${INVENTORY_API}/assets/loans`);
  if (assetId) url.searchParams.set("asset_id", String(assetId));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data?.detail || "No se pudieron obtener los prestamos");
  return data;
}

export async function createAssetLoan(
  payload: { asset_id: number; borrower_name: string; borrower_email: string; quantity: number; notes?: string; due_at?: string },
  token: string
): Promise<AssetLoan> {
  const response = await fetch(`${INVENTORY_API}/assets/loans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo registrar el prestamo");
  return data;
}

export async function returnAssetLoan(id: number, token: string): Promise<AssetLoan> {
  const response = await fetch(`${INVENTORY_API}/assets/loans/${id}/return`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "No se pudo registrar la devolucion");
  return data;
}
