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
  maxAdults: number | null;
  maxChildren: number | null;
  conditional: boolean;
};
export type Availability = {
  configured: boolean;
  slots: {
    id: string;
    startsAt: string;
    remaining: number;
    remainingAdults: number;
    remainingChildren: number;
    conditional: boolean;
  }[];
};
export type ReservationInput = {
  date: string;
  scheduleId: string;
  adults: number;
  children: number;
  referralCode: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  consent: boolean;
};
export type Booking = {
  id: string;
  reference: string;
  schedule_id: string;
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
  adults: number | null;
  children: number | null;
  paid_cents: number;
  partner_id: string | null;
  partner_name: string | null;
};
export type Partner = {
  id: string;
  name: string;
  kind: "company" | "person";
  code: string;
  contact: string;
  active: boolean;
};
export type Expense = {
  id: string;
  category: string;
  description: string;
  payee: string;
  amount_cents: number;
  currency: "CRC" | "USD";
  paid_on: string;
  reference: string;
  voided: boolean;
};
export type Payment = {
  id: string;
  reservation_id: string;
  booking_reference: string;
  full_name: string;
  amount_cents: number;
  currency: "CRC" | "USD";
  method: string;
  paid_on: string;
  reference: string;
  voided: boolean;
};
export type CommissionBalance = {
  partner_id: string;
  name: string;
  code: string;
  currency: "CRC" | "USD";
  earned_cents: number;
  paid_cents: number;
  pending_cents: number;
  reservations: number;
};
export type MonthlyReport = {
  month: string;
  totals: {
    currency: "CRC" | "USD";
    income_cents: number;
    expenses_cents: number;
    balance_cents: number;
    commissions_earned_cents: number;
    commissions_paid_cents: number;
    commissions_pending_cents: number;
  }[];
  categories: {
    currency: "CRC" | "USD";
    category: string;
    amount_cents: number;
  }[];
  days: {
    day: string;
    currency: "CRC" | "USD";
    income_cents: number;
    expenses_cents: number;
  }[];
};
export type DaySchedule = Schedule & {
  enabled: boolean;
  booked: number;
  adultsBooked: number;
  childrenBooked: number;
  unclassified: number;
  remaining: number;
};
