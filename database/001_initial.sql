CREATE TABLE IF NOT EXISTS tour_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  price_cents integer CHECK (price_cents > 0),
  currency text NOT NULL DEFAULT 'CRC' CHECK (currency IN ('CRC', 'USD')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Deliberately no default price or real-world schedule.
INSERT INTO tour_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tour_schedules (
  id uuid PRIMARY KEY,
  starts_at time NOT NULL UNIQUE,
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 200),
  weekdays integer[] NOT NULL CHECK (cardinality(weekdays) > 0 AND weekdays <@ ARRAY[0,1,2,3,4,5,6]),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  schedule_id uuid NOT NULL REFERENCES tour_schedules(id),
  visit_date date NOT NULL,
  starts_at time NOT NULL,
  participants integer NOT NULL CHECK (participants BETWEEN 1 AND 50),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  total_cents integer NOT NULL CHECK (total_cents = participants * unit_price_cents),
  currency text NOT NULL CHECK (currency IN ('CRC', 'USD')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reservations_availability ON reservations (visit_date, schedule_id) WHERE status <> 'cancelled';
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL CHECK (method IN ('cash', 'card', 'transfer')),
  reference text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
