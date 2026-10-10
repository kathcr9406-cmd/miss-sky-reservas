import { z } from "zod";
import { db } from "./db";
import { BookingError, getBookings, getSchedules } from "./tours";
import { todayInCostaRica } from "./format";
import type { PoolClient } from "pg";

export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Fecha inválida.");
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const paidDate = calendarDate.refine(
  (v) => v <= todayInCostaRica(),
  "No registres pagos futuros como recibidos o pagados.",
);
const amount = z.number().int().min(1).max(100000000);
const currency = z.enum(["USD", "CRC"]);
const reference = z.string().trim().max(120).default("");
const base = { id: z.uuid() };
export const operationSchema = z.discriminatedUnion("action", [
  z.object({
    ...base,
    action: z.literal("partner"),
    name: z.string().trim().min(2).max(120),
    kind: z.enum(["company", "person"]),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,40}$/),
    contact: z.string().trim().max(200).default(""),
  }),
  z.object({
    ...base,
    action: z.literal("assign"),
    bookingReference: z.string().trim().max(40),
    partnerId: z.uuid(),
  }),
  z.object({
    ...base,
    action: z.literal("payment"),
    bookingReference: z.string().trim().max(40),
    amountCents: amount,
    method: z.enum(["cash", "card", "transfer"]),
    paidOn: paidDate,
    reference,
  }),
  z.object({
    ...base,
    action: z.literal("expense"),
    category: z.enum([
      "salary",
      "supplies",
      "supplier",
      "maintenance",
      "services",
      "other",
    ]),
    description: z.string().trim().min(2).max(200),
    payee: z.string().trim().min(2).max(120),
    amountCents: amount,
    currency,
    paidOn: paidDate,
    reference,
  }),
  z.object({
    ...base,
    action: z.literal("payout"),
    partnerId: z.uuid(),
    amountCents: amount,
    currency,
    paidOn: paidDate,
    reference,
  }),
  z.object({
    ...base,
    action: z.literal("opening"),
    scheduleId: z.uuid(),
    date: calendarDate,
    enabled: z.boolean(),
  }),
  z.object({
    ...base,
    action: z.literal("classify"),
    bookingReference: z.string().trim().max(40),
    adults: z.number().int().min(0).max(50),
    children: z.number().int().min(0).max(50),
  }),
  z.object({
    ...base,
    action: z.literal("deleteTest"),
    bookingReference: z.string().trim().min(3).max(40),
  }),
  z.object({
    ...base,
    action: z.literal("voidPayment"),
    recordId: z.uuid(),
    reason: z.string().trim().min(5).max(300),
  }),
  z.object({
    ...base,
    action: z.literal("voidExpense"),
    recordId: z.uuid(),
    reason: z.string().trim().min(5).max(300),
  }),
]);
export type Operation = z.infer<typeof operationSchema>;
async function updatePaymentStatus(c: PoolClient, bookingId: string) {
  await c.query(
    `UPDATE reservations SET payment_status=CASE WHEN (SELECT COALESCE(sum(amount_cents),0) FROM payments WHERE reservation_id=$1 AND voided_at IS NULL)=0 THEN 'pending' WHEN (SELECT COALESCE(sum(amount_cents),0) FROM payments WHERE reservation_id=$1 AND voided_at IS NULL)>=total_cents THEN 'paid' ELSE 'partial' END WHERE id=$1`,
    [bookingId],
  );
}
export async function performOperation(v: Operation) {
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [v.id]);
    const existing = (
      await c.query(
        "SELECT payload=$2::jsonb AS same FROM financial_requests WHERE id=$1",
        [v.id, JSON.stringify(v)],
      )
    ).rows[0];
    if (existing) {
      if (!existing.same)
        throw new BookingError("Esta solicitud ya se usó para otro registro.");
      await c.query("COMMIT");
      return;
    }
    if (v.action === "partner") {
      const used = await c.query(
        "SELECT id FROM referral_partners WHERE code=$1",
        [v.code],
      );
      if (used.rowCount)
        throw new BookingError("Este código de referencia ya existe.");
      await c.query(
        "INSERT INTO referral_partners(id,name,kind,code,contact) VALUES($1,$2,$3,$4,$5)",
        [v.id, v.name, v.kind, v.code, v.contact],
      );
    } else if (v.action === "opening") {
      const slot = (
        await c.query(
          "SELECT id FROM tour_schedules WHERE id=$1 AND active FOR UPDATE",
          [v.scheduleId],
        )
      ).rows[0];
      if (!slot) throw new BookingError("El horario no está activo.");
      await c.query(
        "INSERT INTO schedule_openings(schedule_id,visit_date,enabled) VALUES($1,$2,$3) ON CONFLICT(schedule_id,visit_date) DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=now()",
        [v.scheduleId, v.date, v.enabled],
      );
    } else if (v.action === "deleteTest") {
      const b = (
        await c.query(
          "SELECT id FROM reservations WHERE reference=$1 FOR UPDATE",
          [v.bookingReference],
        )
      ).rows[0];
      if (!b) throw new BookingError("No se encontró la reserva de prueba.");
      const ledger = (
        await c.query(
          "SELECT EXISTS(SELECT 1 FROM payments WHERE reservation_id=$1) OR EXISTS(SELECT 1 FROM reservation_commissions WHERE reservation_id=$1) AS present",
          [b.id],
        )
      ).rows[0];
      if (ledger.present)
        throw new BookingError(
          "Esta reserva tiene pagos o comisiones. No se puede eliminar como prueba.",
        );
      await c.query("DELETE FROM reservations WHERE id=$1", [b.id]);
    } else if (v.action === "classify") {
      const candidate = (
        await c.query(
          "SELECT schedule_id FROM reservations WHERE reference=$1",
          [v.bookingReference],
        )
      ).rows[0];
      if (!candidate) throw new BookingError("No se encontró la reserva.");
      const slot = (
        await c.query("SELECT * FROM tour_schedules WHERE id=$1 FOR UPDATE", [
          candidate.schedule_id,
        ])
      ).rows[0];
      const booking = (
        await c.query(
          "SELECT * FROM reservations WHERE reference=$1 FOR UPDATE",
          [v.bookingReference],
        )
      ).rows[0];
      if (v.adults + v.children !== booking.participants)
        throw new BookingError(
          "El desglose debe conservar el total de participantes de la reserva.",
        );
      const other = (
        await c.query(
          "SELECT COALESCE(sum(COALESCE(adults,participants)),0)::int AS adults,COALESCE(sum(COALESCE(children,participants)),0)::int AS children FROM reservations WHERE schedule_id=$1 AND visit_date=$2 AND id<>$3 AND status<>'cancelled'",
          [booking.schedule_id, booking.visit_date, booking.id],
        )
      ).rows[0];
      if (
        booking.status !== "cancelled" &&
        (other.adults + v.adults > (slot.max_adults ?? slot.capacity) ||
          other.children + v.children > (slot.max_children ?? slot.capacity))
      )
        throw new BookingError(
          "El desglose supera los máximos de esta salida. Revisa su configuración.",
        );
      await c.query(
        "UPDATE reservations SET adults=$2,children=$3 WHERE id=$1",
        [booking.id, v.adults, v.children],
      );
    } else if (v.action === "payment" || v.action === "assign") {
      if (v.action === "assign") {
        if (
          !(
            await c.query(
              "SELECT id FROM referral_partners WHERE id=$1 AND active FOR UPDATE",
              [v.partnerId],
            )
          ).rowCount
        )
          throw new BookingError("No se encontró la empresa o persona.");
      }
      const booking = (
        await c.query(
          "SELECT * FROM reservations WHERE reference=$1 FOR UPDATE",
          [v.bookingReference],
        )
      ).rows[0];
      if (!booking || booking.status === "cancelled")
        throw new BookingError(
          "No se encontró una reserva vigente con esta referencia.",
        );
      if (v.action === "assign") {
        if (booking.partner_id)
          throw new BookingError("La reserva ya tiene una comisión asignada.");
        await c.query("UPDATE reservations SET partner_id=$2 WHERE id=$1", [
          booking.id,
          v.partnerId,
        ]);
        await c.query(
          "INSERT INTO reservation_commissions(reservation_id,partner_id,earned_cents,currency) VALUES($1,$2,$3,$4)",
          [
            booking.id,
            v.partnerId,
            Math.round(booking.total_cents / 10),
            booking.currency,
          ],
        );
      } else {
        const paid = Number(
          (
            await c.query(
              "SELECT COALESCE(sum(amount_cents),0) AS n FROM payments WHERE reservation_id=$1 AND voided_at IS NULL",
              [booking.id],
            )
          ).rows[0].n,
        );
        if (paid + v.amountCents > booking.total_cents)
          throw new BookingError(
            "El pago supera el saldo pendiente de la reserva.",
          );
        await c.query(
          "INSERT INTO payments(id,reservation_id,amount_cents,method,paid_on,reference) VALUES($1,$2,$3,$4,$5,$6)",
          [v.id, booking.id, v.amountCents, v.method, v.paidOn, v.reference],
        );
        await updatePaymentStatus(c, booking.id);
      }
    } else if (v.action === "expense") {
      await c.query(
        "INSERT INTO expenses(id,category,description,payee,amount_cents,currency,paid_on,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          v.id,
          v.category,
          v.description,
          v.payee,
          v.amountCents,
          v.currency,
          v.paidOn,
          v.reference,
        ],
      );
    } else if (v.action === "payout") {
      const partner = (
        await c.query(
          "SELECT * FROM referral_partners WHERE id=$1 FOR UPDATE",
          [v.partnerId],
        )
      ).rows[0];
      if (!partner)
        throw new BookingError("No se encontró la empresa o persona.");
      const commissions = (
        await c.query(
          "SELECT * FROM reservation_commissions WHERE partner_id=$1 AND currency=$2 AND earned_cents>paid_cents ORDER BY earned_on,reservation_id FOR UPDATE",
          [v.partnerId, v.currency],
        )
      ).rows;
      if (
        commissions.reduce((sum, r) => sum + r.earned_cents - r.paid_cents, 0) <
        v.amountCents
      )
        throw new BookingError(
          "El pago supera las comisiones pendientes en esta moneda.",
        );
      await c.query(
        "INSERT INTO expenses(id,category,description,payee,amount_cents,currency,paid_on,reference,partner_id) VALUES($1,'commission','Pago de comisiones',$2,$3,$4,$5,$6,$7)",
        [
          v.id,
          partner.name,
          v.amountCents,
          v.currency,
          v.paidOn,
          v.reference,
          v.partnerId,
        ],
      );
      let remaining = v.amountCents;
      for (const row of commissions) {
        const part = Math.min(remaining, row.earned_cents - row.paid_cents);
        if (!part) break;
        await c.query(
          "UPDATE reservation_commissions SET paid_cents=paid_cents+$2 WHERE reservation_id=$1",
          [row.reservation_id, part],
        );
        await c.query(
          "INSERT INTO commission_allocations(expense_id,reservation_id,amount_cents) VALUES($1,$2,$3)",
          [v.id, row.reservation_id, part],
        );
        remaining -= part;
      }
    } else if (v.action === "voidPayment") {
      const row = (
        await c.query("SELECT reservation_id FROM payments WHERE id=$1", [
          v.recordId,
        ])
      ).rows[0];
      if (!row) throw new BookingError("No se encontró el pago.");
      await c.query("SELECT id FROM reservations WHERE id=$1 FOR UPDATE", [
        row.reservation_id,
      ]);
      const changed = await c.query(
        "UPDATE payments SET voided_at=now(),void_reason=$2 WHERE id=$1 AND voided_at IS NULL",
        [v.recordId, v.reason],
      );
      if (!changed.rowCount) throw new BookingError("El pago ya está anulado.");
      await updatePaymentStatus(c, row.reservation_id);
    } else if (v.action === "voidExpense") {
      const candidate = (
        await c.query("SELECT partner_id FROM expenses WHERE id=$1", [
          v.recordId,
        ])
      ).rows[0];
      if (!candidate) throw new BookingError("No se encontró el gasto.");
      if (candidate.partner_id)
        await c.query(
          "SELECT id FROM referral_partners WHERE id=$1 FOR UPDATE",
          [candidate.partner_id],
        );
      const expense = (
        await c.query("SELECT * FROM expenses WHERE id=$1 FOR UPDATE", [
          v.recordId,
        ])
      ).rows[0];
      if (expense.voided_at)
        throw new BookingError("El gasto ya está anulado.");
      const allocations = (
        await c.query(
          "SELECT * FROM commission_allocations WHERE expense_id=$1",
          [v.recordId],
        )
      ).rows;
      for (const a of allocations)
        await c.query(
          "UPDATE reservation_commissions SET paid_cents=paid_cents-$2 WHERE reservation_id=$1",
          [a.reservation_id, a.amount_cents],
        );
      await c.query(
        "UPDATE expenses SET voided_at=now(),void_reason=$2 WHERE id=$1",
        [v.recordId, v.reason],
      );
    }
    await c.query("INSERT INTO financial_requests(id,payload) VALUES($1,$2)", [
      v.id,
      JSON.stringify(v),
    ]);
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}

export async function getDaily(date: string) {
  const [bookings, schedules, openings] = await Promise.all([
    getBookings(date),
    getSchedules(),
    db().query(
      "SELECT schedule_id,enabled FROM schedule_openings WHERE visit_date=$1",
      [date],
    ),
  ]);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return {
    bookings,
    schedules: schedules
      .filter((s) => s.active && s.weekdays.includes(weekday))
      .map((s) => {
        const list = bookings.filter(
          (b) => b.schedule_id === s.id && b.status !== "cancelled",
        );
        const booked = list.reduce((n, b) => n + b.participants, 0);
        return {
          ...s,
          enabled:
            openings.rows.find((o) => o.schedule_id === s.id)?.enabled ??
            !s.conditional,
          booked,
          remaining: Math.max(0, s.capacity - booked),
          adultsBooked: list.reduce((n, b) => n + (b.adults ?? 0), 0),
          childrenBooked: list.reduce((n, b) => n + (b.children ?? 0), 0),
          unclassified: list.reduce(
            (n, b) => n + (b.adults === null ? b.participants : 0),
            0,
          ),
        };
      }),
  };
}
export async function getFinance(month: string) {
  const start = `${month}-01`;
  const client = await db().connect();
  try {
    // A consistent snapshot keeps the report totals and ledger in agreement.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const partners = (
      await client.query("SELECT * FROM referral_partners ORDER BY name")
    ).rows;
    const commissions = (
      await client.query(
        `SELECT p.id AS partner_id,p.name,p.code,c.currency,sum(c.earned_cents)::bigint AS earned_cents,sum(c.paid_cents)::bigint AS paid_cents,sum(c.earned_cents-c.paid_cents)::bigint AS pending_cents,count(*)::int AS reservations FROM reservation_commissions c JOIN referral_partners p ON p.id=c.partner_id GROUP BY p.id,c.currency ORDER BY p.name,c.currency`,
      )
    ).rows.map((r) => ({
      ...r,
      earned_cents: Number(r.earned_cents),
      paid_cents: Number(r.paid_cents),
      pending_cents: Number(r.pending_cents),
    }));
    const payments = (
      await client.query(
        `SELECT p.id,r.reference AS booking_reference,c.full_name,p.amount_cents,r.currency,p.method,to_char(p.paid_on,'YYYY-MM-DD') AS paid_on,COALESCE(p.reference,'') AS reference,(p.voided_at IS NOT NULL) AS voided,p.void_reason FROM payments p JOIN reservations r ON r.id=p.reservation_id JOIN customers c ON c.id=r.customer_id WHERE p.paid_on >= $1::date AND p.paid_on < $1::date+interval '1 month' ORDER BY p.paid_on DESC,p.recorded_at DESC`,
        [start],
      )
    ).rows;
    const expenses = (
      await client.query(
        `SELECT id,category,description,payee,amount_cents,currency,to_char(paid_on,'YYYY-MM-DD') AS paid_on,reference,(voided_at IS NOT NULL) AS voided,void_reason FROM expenses WHERE paid_on >= $1::date AND paid_on < $1::date+interval '1 month' ORDER BY paid_on DESC,recorded_at DESC`,
        [start],
      )
    ).rows;
    const earned = (
      await client.query(
        "SELECT currency,sum(earned_cents)::bigint AS n FROM reservation_commissions WHERE earned_on >= $1::date AND earned_on < $1::date+interval '1 month' GROUP BY currency",
        [start],
      )
    ).rows;
    const totals = (["USD", "CRC"] as const).map((currency) => {
      const income = payments
        .filter((p) => p.currency === currency && !p.voided)
        .reduce((n, p) => n + p.amount_cents, 0);
      const out = expenses
        .filter((e) => e.currency === currency && !e.voided)
        .reduce((n, e) => n + e.amount_cents, 0);
      return {
        currency,
        income_cents: income,
        expenses_cents: out,
        balance_cents: income - out,
        commissions_earned_cents: Number(
          earned.find((e) => e.currency === currency)?.n ?? 0,
        ),
        commissions_paid_cents: expenses
          .filter(
            (e) =>
              e.currency === currency &&
              !e.voided &&
              e.category === "commission",
          )
          .reduce((n, e) => n + e.amount_cents, 0),
        commissions_pending_cents: commissions
          .filter((c) => c.currency === currency)
          .reduce((n, c) => n + c.pending_cents, 0),
      };
    });
    const categories: {
      currency: string;
      category: string;
      amount_cents: number;
    }[] = [];
    for (const e of expenses.filter((e) => !e.voided)) {
      let r = categories.find(
        (r) => r.currency === e.currency && r.category === e.category,
      );
      if (!r) {
        r = { currency: e.currency, category: e.category, amount_cents: 0 };
        categories.push(r);
      }
      r.amount_cents += e.amount_cents;
    }
    await client.query("COMMIT");
    return {
      partners,
      commissions,
      payments,
      expenses,
      report: { month, totals, categories },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
