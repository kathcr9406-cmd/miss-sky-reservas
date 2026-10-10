import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  participants: 2,
  fullName: "Cliente de prueba",
  email: "test@example.com",
  phone: "+506 8888 8888",
  notes: "Solo prueba",
  consent: true,
};
before(async () => {
  await db().query(
    readFileSync(
      new URL("../database/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db().query(
    "TRUNCATE payments, reservations, customers, tour_schedules",
  );
  await db().query(
    "UPDATE tour_settings SET price_cents = NULL, currency = 'CRC'",
  );
});
after(async () => {
  await db().query(
    "TRUNCATE payments, reservations, customers, tour_schedules",
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
