import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { performOperation, getFinance, getDaily } from "../src/lib/operations";
import { todayInCostaRica } from "../src/lib/format";
import { db } from "../src/lib/db";
import {
  createReservation,
  getAvailability,
  BookingError,
} from "../src/lib/tours";

if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    "TEST_DATABASE_URL debe apuntar a una base separada cuyo nombre termine en _test.",
  );
const url = new URL(process.env.TEST_DATABASE_URL);
if (!url.pathname.endsWith("_test"))
  throw new Error(
    "Las pruebas solo pueden modificar bases con el sufijo _test.",
  );
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const scheduleId = randomUUID();
const input = {
  date: "2099-01-05",
  scheduleId,
  adults: 2,
  children: 0,
  referralCode: "",
  fullName: "Cliente de prueba",
  email: "test@example.com",
  phone: "+506 8888 8888",
  notes: "Solo prueba",
  consent: true,
};
before(async () => {
  const dir = new URL("../database/", import.meta.url);
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db().query(readFileSync(new URL(name, dir), "utf8"));
});
beforeEach(async () => {
  await db().query(
    "TRUNCATE financial_requests, commission_allocations, expenses, reservation_commissions, schedule_openings, referral_partners, payments, reservations, customers, tour_schedules",
  );
  await db().query(
    "UPDATE tour_settings SET price_cents = NULL, currency = 'CRC'",
  );
});
after(async () => {
  await db().query(
    "TRUNCATE financial_requests, commission_allocations, expenses, reservation_commissions, schedule_openings, referral_partners, payments, reservations, customers, tour_schedules",
  );
  await db().query(
    "UPDATE tour_settings SET price_cents = NULL, currency = 'CRC'",
  );
  await db().end();
});
async function configure() {
  // Synthetic fixtures in the isolated test database; never real tour information.
  await db().query(
    "UPDATE tour_settings SET price_cents = 100, currency = 'USD'",
  );
  await db().query(
    "INSERT INTO tour_schedules(id,starts_at,capacity,weekdays) VALUES($1,'10:15',3,ARRAY[0,1,2,3,4,5,6])",
    [scheduleId],
  );
}
test("unconfigured tours cannot create a reservation", async () => {
  assert.deepEqual(await getAvailability(input.date), {
    configured: false,
    slots: [],
  });
  await assert.rejects(createReservation(input), BookingError);
  assert.equal(
    (await db().query("SELECT count(*)::int AS n FROM reservations")).rows[0].n,
    0,
  );
});
test("simultaneous reservations cannot exceed capacity", async () => {
  await configure();
  const results = await Promise.allSettled([
    createReservation(input),
    createReservation({ ...input, email: "second@example.com" }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" && result.reason instanceof BookingError,
    ).length,
    1,
  );
  const availability = await getAvailability(input.date);
  assert.equal(availability.slots[0].remaining, 1);
  assert.equal(
    (await db().query("SELECT count(*)::int AS n FROM customers")).rows[0].n,
    1,
  );
});
test("reservations preserve the server price and start with payment pending", async () => {
  await configure();
  const confirmation = await createReservation(input);
  assert.equal(confirmation.totalCents, 200);
  const row = (
    await db().query("SELECT * FROM reservations WHERE reference = $1", [
      confirmation.reference,
    ])
  ).rows[0];
  assert.equal(row.payment_status, "pending");
  await db().query("UPDATE tour_settings SET price_cents = 150");
  assert.equal(
    (
      await db().query(
        "SELECT total_cents FROM reservations WHERE reference = $1",
        [confirmation.reference],
      )
    ).rows[0].total_cents,
    200,
  );
});
test("disabled departures reject reservations without registering a customer", async () => {
  await configure();
  await db().query("UPDATE tour_schedules SET active = false");
  await assert.rejects(createReservation(input), BookingError);
  assert.equal(
    (await db().query("SELECT count(*)::int AS n FROM customers")).rows[0].n,
    0,
  );
});

test("adult and child departure limits hold under concurrent bookings", async () => {
  await configure();
  await db().query(
    "UPDATE tour_schedules SET capacity=10,max_adults=2,max_children=1",
  );
  const results = await Promise.allSettled([
    createReservation({ ...input, adults: 1, children: 1 }),
    createReservation({
      ...input,
      adults: 1,
      children: 1,
      email: "other@example.com",
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const slot = (await getAvailability(input.date)).slots[0];
  assert.equal(slot.remaining, 8);
  assert.equal(slot.remainingAdults, 1);
  assert.equal(slot.remainingChildren, 0);
  await assert.rejects(
    createReservation({
      ...input,
      adults: 0,
      children: 1,
      email: "third@example.com",
    }),
    BookingError,
  );
});
test("extra departure only accepts bookings when staff opens that date", async () => {
  await configure();
  await db().query("UPDATE tour_schedules SET conditional=true");
  assert.equal((await getAvailability(input.date)).slots.length, 0);
  await assert.rejects(createReservation(input), BookingError);
  await performOperation({
    id: randomUUID(),
    action: "opening",
    scheduleId,
    date: input.date,
    enabled: true,
  });
  assert.equal((await getAvailability(input.date)).slots.length, 1);
  await createReservation(input);
  await performOperation({
    id: randomUUID(),
    action: "opening",
    scheduleId,
    date: input.date,
    enabled: false,
  });
  assert.equal((await getDaily(input.date)).bookings.length, 1);
  assert.equal((await getAvailability(input.date)).slots.length, 0);
});
test("historical unclassified bookings are preserved and constrain both category limits", async () => {
  await configure();
  const booking = await createReservation(input);
  await db().query(
    "UPDATE reservations SET adults=NULL,children=NULL WHERE reference=$1",
    [booking.reference],
  );
  await db().query(
    "UPDATE tour_schedules SET capacity=10,max_adults=2,max_children=2",
  );
  const slot = (await getAvailability(input.date)).slots[0];
  assert.equal(slot.remainingAdults, 0);
  assert.equal(slot.remainingChildren, 0);
  await performOperation({
    id: randomUUID(),
    action: "classify",
    bookingReference: booking.reference,
    adults: 1,
    children: 1,
  });
  const daily = await getDaily(input.date);
  assert.equal(daily.bookings[0].participants, 2);
  assert.equal(daily.bookings[0].total_cents, 200);
  assert.equal(daily.schedules[0].unclassified, 0);
});
async function referredBooking() {
  await configure();
  const partnerId = randomUUID();
  await performOperation({
    id: partnerId,
    action: "partner",
    name: "Synthetic Test Partner",
    kind: "company",
    code: "TEST",
    contact: "",
  });
  const booking = await createReservation({ ...input, referralCode: "TEST" });
  return { partnerId, booking };
}
test("commission is ten percent of booking total; payment retries and overpayment are safe", async () => {
  const { booking } = await referredBooking();
  const paidOn = todayInCostaRica();
  const payment = {
    id: randomUUID(),
    action: "payment" as const,
    bookingReference: booking.reference,
    amountCents: 50,
    method: "cash" as const,
    paidOn,
    reference: "",
  };
  await Promise.all([performOperation(payment), performOperation(payment)]);
  const row = (
    await db().query(
      "SELECT payment_status FROM reservations WHERE reference=$1",
      [booking.reference],
    )
  ).rows[0];
  assert.equal(row.payment_status, "partial");
  const finance = await getFinance(paidOn.slice(0, 7));
  assert.equal(finance.payments.length, 1);
  assert.equal(finance.commissions[0].earned_cents, 20);
  assert.equal(finance.commissions[0].pending_cents, 20);
  await assert.rejects(
    performOperation({ ...payment, id: randomUUID(), amountCents: 151 }),
    BookingError,
  );
  await assert.rejects(
    performOperation({ ...payment, amountCents: 51 }),
    BookingError,
  );
});
test("commission payouts reconcile once as expenses and can be annulled with an audit trail", async () => {
  const { partnerId } = await referredBooking();
  const paidOn = todayInCostaRica();
  const payout = {
    id: randomUUID(),
    action: "payout" as const,
    partnerId,
    amountCents: 15,
    currency: "USD" as const,
    paidOn,
    reference: "Test only",
  };
  await performOperation(payout);
  await performOperation(payout);
  let f = await getFinance(paidOn.slice(0, 7));
  assert.equal(f.commissions[0].pending_cents, 5);
  assert.equal(f.expenses.length, 1);
  assert.equal(
    f.report.totals.find((t) => t.currency === "USD")?.expenses_cents,
    15,
  );
  await assert.rejects(
    performOperation({ ...payout, id: randomUUID(), amountCents: 6 }),
    BookingError,
  );
  await performOperation({
    id: randomUUID(),
    action: "voidExpense",
    recordId: payout.id,
    reason: "Synthetic test correction",
  });
  f = await getFinance(paidOn.slice(0, 7));
  assert.equal(f.commissions[0].pending_cents, 20);
  assert.equal(f.expenses[0].voided, true);
  assert.equal(
    f.report.totals.find((t) => t.currency === "USD")?.expenses_cents,
    0,
  );
});
test("monthly income uses collection date and currencies stay separate; payment annulment restores balance", async () => {
  await configure();
  const booking = await createReservation(input);
  const paidOn = todayInCostaRica();
  const id = randomUUID();
  await performOperation({
    id,
    action: "payment",
    bookingReference: booking.reference,
    amountCents: 200,
    method: "transfer",
    paidOn,
    reference: "Test",
  });
  await performOperation({
    id: randomUUID(),
    action: "expense",
    category: "salary",
    description: "Synthetic fixture",
    payee: "Test employee",
    amountCents: 70,
    currency: "CRC",
    paidOn,
    reference: "",
  });
  await performOperation({
    id: randomUUID(),
    action: "expense",
    category: "supplies",
    description: "Past fixture",
    payee: "Test supplier",
    amountCents: 40,
    currency: "USD",
    paidOn: "2000-01-01",
    reference: "",
  });
  let f = await getFinance(paidOn.slice(0, 7));
  assert.equal(
    f.report.totals.find((t) => t.currency === "USD")?.balance_cents,
    200,
  );
  assert.equal(
    f.report.totals.find((t) => t.currency === "CRC")?.balance_cents,
    -70,
  );
  assert.equal(
    (await getFinance("2000-01")).report.totals.find(
      (t) => t.currency === "USD",
    )?.expenses_cents,
    40,
  );
  await performOperation({
    id: randomUUID(),
    action: "voidPayment",
    recordId: id,
    reason: "Synthetic test correction",
  });
  f = await getFinance(paidOn.slice(0, 7));
  assert.equal(
    f.report.totals.find((t) => t.currency === "USD")?.income_cents,
    0,
  );
  assert.equal(
    (await getDaily(input.date)).bookings[0].payment_status,
    "pending",
  );
  assert.equal(f.payments[0].voided, true);
});
test("daily calendar returns all records rather than the 200-row dashboard limit", async () => {
  await configure();
  await db().query("UPDATE tour_schedules SET capacity=200");
  const b = await createReservation(input);
  await db().query(
    `INSERT INTO reservations(id,reference,customer_id,schedule_id,visit_date,starts_at,participants,unit_price_cents,total_cents,currency,adults,children,status) SELECT gen_random_uuid(),'TEST-'||n,r.customer_id,r.schedule_id,r.visit_date,r.starts_at,1,100,100,'USD',1,0,'cancelled' FROM reservations r CROSS JOIN generate_series(1,205) n WHERE reference=$1`,
    [b.reference],
  );
  assert.equal((await getDaily(input.date)).bookings.length, 206);
});

test("trial reservation removal frees capacity and protects financial history", async () => {
  await configure();
  const b = await createReservation(input);
  await performOperation({
    id: randomUUID(),
    action: "deleteTest",
    bookingReference: b.reference,
  });
  assert.equal((await getDaily(input.date)).bookings.length, 0);
  assert.equal((await getAvailability(input.date)).slots[0].remaining, 3);
  const second = await createReservation(input);
  await performOperation({
    id: randomUUID(),
    action: "payment",
    bookingReference: second.reference,
    amountCents: 100,
    method: "cash",
    paidOn: todayInCostaRica(),
    reference: "",
  });
  await assert.rejects(
    performOperation({
      id: randomUUID(),
      action: "deleteTest",
      bookingReference: second.reference,
    }),
    BookingError,
  );
  assert.equal((await getDaily(input.date)).bookings.length, 1);
});
test("additive migration preserves legacy booking, payment, customer and configured price", async () => {
  const c = await db().connect();
  const schema = "upgrade_" + randomUUID().replaceAll("-", "");
  try {
    await c.query("BEGIN");
    await c.query(`CREATE SCHEMA ${schema}`);
    await c.query(`SET LOCAL search_path TO ${schema}`);
    await c.query(
      readFileSync(
        new URL("../database/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    const customerId = randomUUID(),
      bookingId = randomUUID();
    await c.query("UPDATE tour_settings SET price_cents=100,currency='USD'");
    await c.query(
      "INSERT INTO tour_schedules(id,starts_at,capacity,weekdays) VALUES($1,'10:15',3,ARRAY[1])",
      [scheduleId],
    );
    await c.query(
      "INSERT INTO customers(id,full_name,email,phone) VALUES($1,'Legacy test','legacy@example.com','12345678')",
      [customerId],
    );
    await c.query(
      "INSERT INTO reservations(id,reference,customer_id,schedule_id,visit_date,starts_at,participants,unit_price_cents,total_cents,currency) VALUES($1,'LEGACY',$2,$3,'2099-01-05','10:15',2,100,200,'USD')",
      [bookingId, customerId, scheduleId],
    );
    await c.query(
      "INSERT INTO payments(id,reservation_id,amount_cents,method) VALUES($1,$2,50,'cash')",
      [randomUUID(), bookingId],
    );
    const sql = readFileSync(
      new URL("../database/002_operations.sql", import.meta.url),
      "utf8",
    );
    await c.query(sql);
    await c.query(sql);
    const b = (
      await c.query("SELECT * FROM reservations WHERE id=$1", [bookingId])
    ).rows[0];
    assert.equal(b.adults, null);
    assert.equal(b.children, null);
    assert.equal(b.participants, 2);
    assert.equal(b.total_cents, 200);
    assert.equal(
      (await c.query("SELECT price_cents FROM tour_settings")).rows[0]
        .price_cents,
      100,
    );
    assert.ok((await c.query("SELECT paid_on FROM payments")).rows[0].paid_on);
    assert.equal(
      (await c.query("SELECT count(*)::int AS n FROM customers")).rows[0].n,
      1,
    );
    await c.query("ROLLBACK");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
