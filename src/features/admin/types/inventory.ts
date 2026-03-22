export type Asset = {
  id: number;
  name: string;
  category: string;
  description?: string;
  serial_number?: string;
  laboratory_id?: number;
  quantity_total: number;
  quantity_available: number;
  status: string;
};

export type AssetCreate = {
  name: string;
  category: string;
  description?: string;
  serial_number?: string;
  laboratory_id?: number;
  quantity_total: number;
  quantity_available: number;
  status: string;
};

export type AssetLoan = {
  id: number;
  asset_id: number;
  borrower_name: string;
  borrower_email: string;
  quantity: number;
  notes?: string;
  created_at: string;
  due_at?: string;
  returned_at?: string;
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
