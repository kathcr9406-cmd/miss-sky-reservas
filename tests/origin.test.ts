import test from "node:test";
import assert from "node:assert/strict";
import { sameOrigin } from "../src/lib/auth";

test("origin checks accept the public Host through an internal Next.js URL", () => {
  assert.equal(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api", {
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    ),
    true,
  );
});
test("origin checks reject missing, malformed, cross-site and different-port origins", () => {
  for (const origin of [
    "https://other.example.com",
    "http://localhost:3001",
    "null",
    "http://localhost:3000/path",
  ]) {
    assert.equal(
      sameOrigin(
        new Request("http://0.0.0.0:3000/api", {
          headers: { host: "localhost:3000", origin },
        }),
      ),
      false,
    );
  }
  assert.equal(sameOrigin(new Request("http://localhost:3000/api")), false);
});
