export type MaterialOption = {
  id: number;
  name: string;
  availableQuantity: number;
};

export type LabOption = {
  id: number;
  name: string;
  location: string;
  capacity: number;
  description?: string;
  is_active?: boolean;
};

export type PracticeMaterialItem = {
  asset_id: number;
  quantity: number;
};

export type PracticeRequestCreate = {
  laboratory_id: number;
  date: string;
  start_time: string;
  end_time: string;
  materials: PracticeMaterialItem[];
  needs_support: boolean;
  support_topic?: string;
  notes?: string;
};

export type PracticeMaterialResponse = {
  id: number;
  asset_id: number;
  material_name: string;
  quantity: number;
};

export type PracticeRequestResponse = {
  id: number;
  user_id: number;
  username: string;
  laboratory_id: number;
  laboratory_name: string;
  date: string;
  start_time: string;
  end_time: string;
  needs_support: boolean;
  support_topic?: string;
  notes?: string;
  status: string;
  created_at: string;
  materials: PracticeMaterialResponse[];
};