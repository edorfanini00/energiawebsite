import { test } from "node:test";
import assert from "node:assert/strict";
import { startStack } from "../support/stack.mjs";

// Real handlers and an isolated database. No production traffic or valid inquiry.
test("canonical custom origin works through challenge/intake and preserves foreign denial", async () => {
  const stack = await startStack();
  try {
    const canonical = "https://predictivehvaccontrol.com";
    stack.env.INQUIRY_ORIGINS += "," + canonical;
    for (const metadata of [{ "Sec-Fetch-Site": "same-origin" }, {}]) {
      const challenge = await stack.call("POST", "/api/challenge", { headers: { Origin: canonical, ...metadata }, body: {} });
      assert.equal(challenge.status, 200);
      assert.ok(challenge.json.signature);
      const inquiry = await stack.call("POST", "/api/inquiry", { headers: { Origin: canonical, ...metadata }, body: {} });
      assert.equal(inquiry.status, 422, "canonical origin reaches validation, not an origin denial");
      assert.match(inquiry.headers["x-robots-tag"], /noindex/);
    }
    for (const headers of [
      { Origin: canonical, "Sec-Fetch-Site": "cross-site" },
      { Origin: canonical, "Sec-Fetch-Site": "same-site" },
      { Origin: "https://predictivehvaccontrol.com.attacker.invalid" },
      { Origin: "https://commercialhvacoptimization.com" },
      { Origin: "https://www.predictivehvaccontrol.com" },
      { Origin: "http://predictivehvaccontrol.com" },
      { Origin: "null" },
      {},
    ]) {
      for (const path of ["/api/challenge", "/api/inquiry"]) {
        assert.equal((await stack.call("POST", path, { headers, body: {} })).status, 403);
      }
    }
    assert.equal(Number((await stack.q("SELECT count(*) FROM inquiries")).rows[0].count), 0);
  } finally { await stack.close(); }
});
