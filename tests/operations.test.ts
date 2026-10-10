import test from "node:test";
import assert from "node:assert/strict";
import {
  operationSchema,
  csvCell,
  calendarDate,
  monthSchema,
} from "../src/lib/operations";
import { randomUUID } from "node:crypto";
test("financial input rejects fictional future paid dates and unsafe amounts", () => {
  const valid = {
    id: randomUUID(),
    action: "expense",
    category: "salary",
    description: "Test",
    payee: "Test",
    amountCents: 100,
    currency: "USD",
    paidOn: "2000-01-01",
    reference: "",
  };
  assert.equal(operationSchema.safeParse(valid).success, true);
  for (const change of [
    { paidOn: "2099-01-01" },
    { paidOn: "2000-02-30" },
    { amountCents: 0 },
    { amountCents: 1.1 },
    { currency: "EUR" },
    { category: "commission" },
  ])
    assert.equal(
      operationSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
  assert.equal(calendarDate.safeParse("2000-02-30").success, false);
  assert.equal(monthSchema.safeParse("2026-13").success, false);
});
test("CSV quotes separators and disarms spreadsheet formulas", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell("\t@SUM(A1)"), '"\'\t@SUM(A1)"');
});
