-- Additive migration: existing reservations, customers and prices are preserved.
ALTER TABLE tour_schedules ADD COLUMN IF NOT EXISTS max_adults integer CHECK (max_adults BETWEEN 0 AND 200);
ALTER TABLE tour_schedules ADD COLUMN IF NOT EXISTS max_children integer CHECK (max_children BETWEEN 0 AND 200);
ALTER TABLE tour_schedules ADD COLUMN IF NOT EXISTS conditional boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS schedule_openings (
  schedule_id uuid NOT NULL REFERENCES tour_schedules(id),
  visit_date date NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(schedule_id, visit_date)
);

CREATE TABLE IF NOT EXISTS referral_partners (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('company', 'person')),
  code text NOT NULL UNIQUE,
  contact text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS adults integer;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS children integer;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES referral_partners(id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_age_breakdown' AND conrelid = 'reservations'::regclass) THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_age_breakdown CHECK (
      (adults IS NULL AND children IS NULL) OR
      (adults IS NOT NULL AND children IS NOT NULL AND adults >= 0 AND children >= 0 AND adults + children = participants)
    );
  END IF;
END $$;
-- Historical records stay unclassified; do not invent adult/child counts.

CREATE TABLE IF NOT EXISTS reservation_commissions (
  reservation_id uuid PRIMARY KEY REFERENCES reservations(id),
  partner_id uuid NOT NULL REFERENCES referral_partners(id),
  rate_bps integer NOT NULL DEFAULT 1000 CHECK (rate_bps = 1000),
  earned_cents integer NOT NULL CHECK (earned_cents >= 0),
  paid_cents integer NOT NULL DEFAULT 0 CHECK (paid_cents >= 0 AND paid_cents <= earned_cents),
  currency text NOT NULL CHECK (currency IN ('CRC', 'USD')),
  earned_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Costa_Rica')::date
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_on date;
UPDATE payments SET paid_on = (recorded_at AT TIME ZONE 'America/Costa_Rica')::date WHERE paid_on IS NULL;
ALTER TABLE payments ALTER COLUMN paid_on SET NOT NULL;
ALTER TABLE payments ALTER COLUMN paid_on SET DEFAULT (now() AT TIME ZONE 'America/Costa_Rica')::date;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason text;
CREATE INDEX IF NOT EXISTS payments_monthly ON payments(paid_on) WHERE voided_at IS NULL;

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('salary', 'supplies', 'supplier', 'maintenance', 'services', 'other', 'commission')),
  description text NOT NULL,
  payee text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL CHECK (currency IN ('CRC', 'USD')),
  paid_on date NOT NULL,
  reference text NOT NULL DEFAULT '',
  partner_id uuid REFERENCES referral_partners(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  void_reason text
);
CREATE INDEX IF NOT EXISTS expenses_monthly ON expenses(paid_on) WHERE voided_at IS NULL;
CREATE TABLE IF NOT EXISTS commission_allocations (
  expense_id uuid NOT NULL REFERENCES expenses(id),
  reservation_id uuid NOT NULL REFERENCES reservation_commissions(reservation_id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  PRIMARY KEY(expense_id, reservation_id)
);

CREATE TABLE IF NOT EXISTS financial_requests (
  id uuid PRIMARY KEY,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
