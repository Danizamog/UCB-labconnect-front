export type Lab = {
  id: number;
  name: string;
  location: string;
  capacity: number;
  description?: string;
  is_active: boolean;
};

export type LabCreate = {
  name: string;
  location: string;
  capacity: number;
  description?: string;
  is_active: boolean;
};