export type Asset = {
  id: number;
  name: string;
  category: string;
  description?: string;
  serial_number?: string;
  laboratory_id?: number;
  status: string;
};

export type AssetCreate = {
  name: string;
  category: string;
  description?: string;
  serial_number?: string;
  laboratory_id?: number;
  status: string;
};

export type StockItem = {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity_available: number;
  minimum_stock: number;
  laboratory_id?: number;
  description?: string;
};

export type StockItemCreate = {
  name: string;
  category: string;
  unit: string;
  quantity_available: number;
  minimum_stock: number;
  laboratory_id?: number;
  description?: string;
};