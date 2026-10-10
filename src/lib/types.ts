export type TourSettings = {
  priceCents: number | null;
  currency: "CRC" | "USD";
};
export type Schedule = {
  id: string;
  startsAt: string;
  capacity: number;
  weekdays: number[];
  active: boolean;
};
export type Availability = {
  configured: boolean;
  slots: { id: string; startsAt: string; remaining: number }[];
};
export type ReservationInput = {
  date: string;
  scheduleId: string;
  participants: number;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  consent: boolean;
};
export type Booking = {
  reference: string;
  visit_date: string;
  starts_at: string;
  participants: number;
  full_name: string;
  email: string;
  phone: string;
  total_cents: number;
  currency: "CRC" | "USD";
  status: string;
  payment_status: string;
};
