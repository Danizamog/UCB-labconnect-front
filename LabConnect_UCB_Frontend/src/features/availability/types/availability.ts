export type DayAvailability = {
  day: number;
  date: string;
  status: "available" | "partial" | "occupied";
  occupied_slots: number;
  total_slots: number;
};

export type LabCalendar = {
  laboratory_id: number;
  laboratory_name: string;
  year: number;
  month: number;
  days: DayAvailability[];
};

export type DayReservationItem = {
  start_time: string;
  end_time: string;
  status: "occupied";
};

export type DayReservationsGroup = {
  laboratory_id: number;
  laboratory_name: string;
  reservations: DayReservationItem[];
};