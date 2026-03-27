export type MaterialOption = {
  id: number;
  name: string;
  category?: string;
  unit?: string;
  availableQuantity: number;
  minimumStock?: number;
  laboratory_id?: number | null;
  description?: string;
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

export type PracticeMaterialItem = {
  asset_id: number;
  quantity: number;
  material_name?: string;
};

export type PracticeRequestCreate = {
  subject_name: string;
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

export type PracticeMaterialLoanResponse = {
  loan_id: number;
  material_name: string;
  quantity: number;
  status: string;
  return_condition?: string | null;
  return_notes?: string | null;
  incident_notes?: string | null;
  due_at?: string | null;
};

export type PracticeRequestResponse = {
  id: number;
  user_id: string;
  username: string;
  subject_name?: string;
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
  status_updated_at: string;
  user_notification_read: boolean;
  material_tracking_status?: string | null;
  review_comment?: string;
  materials: PracticeMaterialResponse[];
  material_loans: PracticeMaterialLoanResponse[];
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
