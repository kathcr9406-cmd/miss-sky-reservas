import test from "node:test";
import assert from "node:assert/strict";
import {
  dateSchema,
  reservationSchema,
  settingsSchema,
} from "../src/lib/validation";
import { todayInCostaRica } from "../src/lib/format";

const valid = {
  date: "2099-01-05",
  scheduleId: "9a72c95f-5c97-4403-a282-a990e6a5ec1c",
  participants: 2,
  fullName: "Cliente de prueba",
  email: "test@example.com",
  phone: "+506 8888 8888",
  notes: "",
  consent: true,
};
test("rejects impossible and past dates", () => {
  for (const date of ["2099-02-30", "2099-13-01", "2000-01-01", "not-a-date"])
    assert.equal(dateSchema.safeParse(date).success, false);
  assert.equal(dateSchema.safeParse(valid.date).success, true);
});
test("uses Costa Rica's date around UTC midnight", () => {
  assert.equal(
    todayInCostaRica(new Date("2026-10-10T03:00:00Z")),
    "2026-10-09",
  );
});
test("requires consent and a bounded group size", () => {
  assert.equal(reservationSchema.safeParse(valid).success, true);
  for (const participants of [0, -1, 1.5, 51])
    assert.equal(
      reservationSchema.safeParse({ ...valid, participants }).success,
      false,
    );
  assert.equal(
    reservationSchema.safeParse({ ...valid, consent: false }).success,
    false,
  );
});
test("rejects malformed contact details and limits notes", () => {
  assert.equal(
    reservationSchema.safeParse({ ...valid, email: "bad" }).success,
    false,
  );
  assert.equal(
    reservationSchema.safeParse({ ...valid, phone: "abcdefgh" }).success,
    false,
  );
  assert.equal(
    reservationSchema.safeParse({ ...valid, notes: "x".repeat(1001) }).success,
    false,
  );
});
test("accepts unconfigured pricing and rejects duplicate or invalid departures", () => {
  assert.equal(
    settingsSchema.safeParse({
      priceCents: null,
      currency: "CRC",
      schedules: [],
    }).success,
    true,
  );
  const slot = {
    id: valid.scheduleId,
    startsAt: "10:15",
    weekdays: [1],
    capacity: 2,
    active: true,
  };
  assert.equal(
    settingsSchema.safeParse({
      priceCents: 100,
      currency: "USD",
      schedules: [slot, slot],
    }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({
      priceCents: 100,
      currency: "USD",
      schedules: [{ ...slot, startsAt: "25:00" }],
    }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({
      priceCents: 100,
      currency: "USD",
      schedules: [{ ...slot, weekdays: [] }],
    }).success,
    false,
  );
});
