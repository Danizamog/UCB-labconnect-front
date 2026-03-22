export type Lab = {
  id: number;
  name: string;
  location: string;
  capacity: number;
  description?: string;
  is_active: boolean;
  area_id: number;
  area_name?: string;
};

export type LabCreate = {
  name: string;
  location: string;
  capacity: number;
  description?: string;
  is_active: boolean;
  area_id: number;
};
