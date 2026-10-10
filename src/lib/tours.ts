import { randomUUID } from "node:crypto";
import { db, databaseConfigured } from "./db";
import type {
  Availability,
  TourSettings,
  ReservationInput,
  Schedule,
  Booking,
} from "./types";

export async function getSettings(): Promise<TourSettings> {
  if (!databaseConfigured()) return { priceCents: null, currency: "CRC" };
  const result = await db().query(
    "SELECT price_cents, currency FROM tour_settings WHERE id = true",
  );
  const row = result.rows[0];
  return {
    priceCents: row?.price_cents ?? null,
    currency: row?.currency ?? "CRC",
  };
}
export async function getSchedules(): Promise<Schedule[]> {
  const result = await db().query(
    `SELECT id,to_char(starts_at, 'HH24:MI') AS "startsAt",capacity,weekdays,active,max_adults AS "maxAdults",max_children AS "maxChildren",conditional FROM tour_schedules ORDER BY starts_at`,
  );
  return result.rows;
}
export async function getAvailability(date: string): Promise<Availability> {
  const settings = await getSettings();
  if (settings.priceCents === null || !databaseConfigured())
    return { configured: false, slots: [] };
  const result = await db().query(
    `
    SELECT s.id, to_char(s.starts_at, 'HH24:MI') AS "startsAt", GREATEST(0, s.capacity - COALESCE(sum(r.participants), 0))::int AS remaining,
      LEAST(GREATEST(0,s.capacity-COALESCE(sum(r.participants),0)), GREATEST(0, COALESCE(s.max_adults,s.capacity)-COALESCE(sum(COALESCE(r.adults,r.participants)),0)))::int AS "remainingAdults",
      LEAST(GREATEST(0,s.capacity-COALESCE(sum(r.participants),0)), GREATEST(0, COALESCE(s.max_children,s.capacity)-COALESCE(sum(COALESCE(r.children,r.participants)),0)))::int AS "remainingChildren", s.conditional
    FROM tour_schedules s LEFT JOIN reservations r ON r.schedule_id = s.id AND r.visit_date = $1 AND r.status <> 'cancelled'
    WHERE s.active AND COALESCE((SELECT enabled FROM schedule_openings WHERE schedule_id=s.id AND visit_date=$1), NOT s.conditional) AND EXTRACT(DOW FROM $1::date)::int = ANY(s.weekdays)
      AND ($1::date + s.starts_at) AT TIME ZONE 'America/Costa_Rica' > now()
    GROUP BY s.id ORDER BY s.starts_at`,
    [date],
  );
  const { rows } = await db().query(
    "SELECT EXISTS(SELECT 1 FROM tour_schedules WHERE active) AS configured",
  );
  return { configured: rows[0].configured, slots: result.rows };
}
export class BookingError extends Error {}
export async function createReservation(input: ReservationInput) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const settings = (
      await client.query(
        "SELECT price_cents, currency FROM tour_settings WHERE id = true FOR SHARE",
      )
    ).rows[0];
    if (!settings?.price_cents)
      throw new BookingError("La tarifa aún no está configurada.");
    // Lock before counting: simultaneous requests cannot oversell a departure.
    const schedule = (
      await client.query(
        `SELECT *, ($1::date + starts_at) AT TIME ZONE 'America/Costa_Rica' > now() AS future
      FROM tour_schedules WHERE id = $2 FOR UPDATE`,
        [input.date, input.scheduleId],
      )
    ).rows[0];
    if (
      !schedule?.active ||
      !schedule.future ||
      !schedule.weekdays.includes(
        new Date(`${input.date}T12:00:00Z`).getUTCDay(),
      )
    ) {
      throw new BookingError(
        "Este horario ya no está disponible. Selecciona otro.",
      );
    }
    const opening = (
      await client.query(
        "SELECT enabled FROM schedule_openings WHERE schedule_id=$1 AND visit_date=$2",
        [schedule.id, input.date],
      )
    ).rows[0];
    if (!(opening?.enabled ?? !schedule.conditional))
      throw new BookingError(
        "Esta salida no está habilitada para la fecha seleccionada.",
      );
    const participants = input.adults + input.children;
    if (
      !Number.isInteger(participants) ||
      participants < 1 ||
      participants > 50 ||
      input.adults < 0 ||
      input.children < 0
    )
      throw new BookingError("Revisa adultos y niños.");
    const occupied = (
      await client.query(
        "SELECT COALESCE(sum(participants),0)::int AS count, COALESCE(sum(COALESCE(adults,participants)),0)::int AS adults, COALESCE(sum(COALESCE(children,participants)),0)::int AS children FROM reservations WHERE visit_date = $1 AND schedule_id = $2 AND status <> 'cancelled'",
        [input.date, input.scheduleId],
      )
    ).rows[0];
    if (
      occupied.count + participants > schedule.capacity ||
      occupied.adults + input.adults >
        (schedule.max_adults ?? schedule.capacity) ||
      occupied.children + input.children >
        (schedule.max_children ?? schedule.capacity)
    )
      throw new BookingError(
        "No quedan suficientes cupos. Selecciona otro horario.",
      );
    let partnerId: string | null = null;
    if (input.referralCode) {
      const partner = (
        await client.query(
          "SELECT id FROM referral_partners WHERE code=$1 AND active FOR UPDATE",
          [input.referralCode],
        )
      ).rows[0];
      if (!partner)
        throw new BookingError(
          "El código de referencia no está disponible. Consulta con quien te recomendó el tour.",
        );
      partnerId = partner.id;
    }
    const customer = (
      await client.query(
        `INSERT INTO customers (id,full_name,email,phone) VALUES ($1,$2,$3,$4)
      ON CONFLICT(email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone RETURNING id`,
        [randomUUID(), input.fullName, input.email, input.phone],
      )
    ).rows[0];
    const reference = `MS-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const totalCents = settings.price_cents * participants;
    if (totalCents > 2147483647)
      throw new BookingError(
        "El importe del grupo supera el límite admitido. Consulta con el personal.",
      );
    const reservationId = randomUUID();
    await client.query(
      `INSERT INTO reservations (id,reference,customer_id,schedule_id,visit_date,starts_at,participants,unit_price_cents,total_cents,currency,notes,adults,children,partner_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        reservationId,
        reference,
        customer.id,
        schedule.id,
        input.date,
        schedule.starts_at,
        participants,
        settings.price_cents,
        totalCents,
        settings.currency,
        input.notes,
        input.adults,
        input.children,
        partnerId,
      ],
    );
    if (partnerId)
      await client.query(
        "INSERT INTO reservation_commissions(reservation_id,partner_id,earned_cents,currency) VALUES($1,$2,$3,$4)",
        [
          reservationId,
          partnerId,
          Math.round(totalCents / 10),
          settings.currency,
        ],
      );
    await client.query("COMMIT");
    return { reference, totalCents, currency: settings.currency };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function getBookings(date?: string): Promise<Booking[]> {
  const result = await db().query(
    `SELECT r.id,r.schedule_id, r.reference, to_char(r.visit_date, 'YYYY-MM-DD') AS visit_date, to_char(r.starts_at, 'HH24:MI') AS starts_at,
    r.adults, r.children, r.partner_id, rp.name AS partner_name, COALESCE((SELECT sum(amount_cents) FROM payments WHERE reservation_id=r.id AND voided_at IS NULL),0)::int AS paid_cents, r.participants, c.full_name, c.email, c.phone, r.total_cents, r.currency, r.status, r.payment_status
    FROM reservations r JOIN customers c ON c.id = r.customer_id LEFT JOIN referral_partners rp ON rp.id=r.partner_id WHERE ($1::date IS NULL OR r.visit_date=$1) ORDER BY r.visit_date DESC, r.starts_at DESC ${date ? "" : "LIMIT 200"}`,
    [date ?? null],
  );
  return result.rows;
}

export async function getOverview(today: string) {
  const r = await db().query(
    `SELECT count(*) FILTER(WHERE visit_date=$1)::int AS reservations,COALESCE(sum(participants) FILTER(WHERE visit_date=$1),0)::int AS people,count(*) FILTER(WHERE payment_status<>'paid')::int AS unpaid FROM reservations WHERE status<>'cancelled'`,
    [today],
  );
  return r.rows[0] as { reservations: number; people: number; unpaid: number };
}
