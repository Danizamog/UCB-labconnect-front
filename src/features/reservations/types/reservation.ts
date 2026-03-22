export type MaterialOption = {
  id: number;
  name: string;
  availableQuantity: number;
  source?: "asset" | "stock";
};

export type LabOption = {
  id: number;
  name: string;
  location: string;
  capacity: number;
  description?: string;
  is_active?: boolean;
  area_id: number;
  area_name?: string;
};

export type AreaOption = {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
};

export type GroupedLaboratories = {
  area_id: number;
  area_name: string;
  laboratories: LabOption[];
};

export type PracticeMaterialItem = {
  asset_id: number;
  quantity: number;
  material_name?: string;
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
  review_comment?: string;
  status: string;
  created_at: string;
  status_updated_at: string;
  user_notification_read: boolean;
  materials: PracticeMaterialResponse[];
};

export type ReservationNotification = {
  id: number;
  title: string;
  message: string;
  status: string;
  review_comment?: string;
  created_at: string;
  read: boolean;
  laboratory_name: string;
  date: string;
  start_time: string;
  end_time: string;
};
