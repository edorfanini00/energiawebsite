// Unit tests that need no database: the field contract, ALTCHA, config,
// CSV export, password hashing and the no automatic deletion guarantee.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { choices, fields, messages, readSourcePath, readUtm, validate } from "../../server/fields.js";
import { CHALLENGE_SECONDS, issueChallenge, verifyProof } from "../../server/challenge.js";
import { allowedOrigins, databaseUrl, intakeConfig } from "../../server/config.js";
import { csvCell, toCsv } from "../../server/csv.js";
import { hashPassword, passwordMatches } from "../../server/admin.js";
import { cleanupDatabaseUrl } from "../../server/cleanup.js";
import { requestOrigin } from "../../server/http.js";
import { expiringTables } from "../../server/store.js";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const SECRET = "a".repeat(64);
const ORIGIN = "https://energiawebsite-test.vercel.app";

export const valid = () => ({
  name: "Test Person",
  email: "test.person@example.com",
  company: "Synthetic Buildings Test Co",
  buildingType: "Office",
  floorArea: "50,000 to 200,000 sq ft",
});

export async function solvedToken(challenge) {
  const solution = await solveChallenge({ challenge, deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

describe("field validation", () => {
  test("accepts the five required answers and trims them", () => {
    const { data, errors } = validate({ ...valid(), name: "  Test Person  " });
    assert.deepEqual(errors, {});
    assert.equal(data.name, "Test Person");
    assert.equal(data.role, "");
  });

  test("every required field has its own message", () => {
    const { errors } = validate({});
    assert.deepEqual(errors, messages.required);
  });

  test("choices must match exactly, including case and spacing", () => {
    for (const [field, options] of Object.entries(choices)) {
      for (const option of options) assert.equal(validate({ ...valid(), [field]: option }).errors[field], undefined, option);
      assert.equal(validate({ ...valid(), [field]: options[0].toLowerCase() + " " }).errors[field], options[0].toLowerCase() === options[0] ? undefined : messages.choice);
      assert.equal(validate({ ...valid(), [field]: "Something else" }).errors[field], messages.choice);
    }
  });

  test("length caps match the contract", () => {
    for (const [field, [, max]] of Object.entries(fields)) {
      if (choices[field] || field === "email" || field === "phone") continue;
      assert.equal(validate({ ...valid(), [field]: "x".repeat(max) }).errors[field], undefined, field);
      assert.equal(validate({ ...valid(), [field]: "x".repeat(max + 1) }).errors[field], messages.tooLong(max), field);
    }
    assert.equal(messages.tooLong(1000), "Use 1,000 characters or fewer.");
  });

  test("email, phone, control characters and line breaks", () => {
    assert.equal(validate({ ...valid(), email: "not an email" }).errors.email, messages.email);
    assert.equal(validate({ ...valid(), email: "a@b" }).errors.email, messages.email);
    assert.equal(validate({ ...valid(), phone: "+1 (617) 555 0100" }).errors.phone, undefined);
    assert.equal(validate({ ...valid(), phone: "617.555.0100 ext 12" }).errors.phone, undefined);
    assert.equal(validate({ ...valid(), phone: "call me" }).errors.phone, messages.phone);
    assert.equal(validate({ ...valid(), name: "Test‮Person" }).errors.name, messages.characters);
    assert.equal(validate({ ...valid(), company: "Line\nbreak" }).errors.company, messages.characters);
    assert.equal(validate({ ...valid(), improve: "Line one\r\nLine two" }).data.improve, "Line one\nLine two");
    assert.equal(validate({ ...valid(), name: 42 }).errors.name, messages.text);
  });

  test("Which one? is kept only with a building management system", () => {
    assert.equal(validate({ ...valid(), bms: "Yes", bmsName: "Metasys" }).data.bmsName, "Metasys");
    assert.equal(validate({ ...valid(), bms: "No", bmsName: "Metasys" }).data.bmsName, "");
  });

  test("UTM parameters are cleaned and everything else, like a share token, is dropped", () => {
    assert.deepEqual(readUtm("?utm_source=linkedin&utm_campaign=q4%0Atest&_vercel_share=secret&x=1"), { utm_source: "linkedin", utm_campaign: "q4 test" });
    assert.equal(readUtm("?utm_term=" + "y".repeat(300)).utm_term.length, 100);
    assert.equal(readSourcePath("/"), "/");
    assert.equal(readSourcePath("/?_vercel_share=x"), "/");
    assert.equal(readSourcePath("https://evil.example/"), "/");
    assert.equal(readSourcePath("/../admin"), "/");
  });

  test("the page offers exactly the server's choices, with visible labels and described errors", async () => {
    const html = await read("index.html");
    const form = html.slice(html.indexOf("<form"), html.indexOf("</form>"));
    const selects = [...form.matchAll(/<select[^>]*name="(\w+)"[^>]*>([\s\S]*?)<\/select>/g)];
    assert.equal(selects.length, Object.keys(choices).length);
    for (const [, name, body] of selects) {
      const options = [...body.matchAll(/<option(?: value="")?>([^<]*)<\/option>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
      assert.equal(options[0], "Select", name);
      assert.deepEqual(options.slice(1), choices[name], name);
    }
    for (const name of Object.keys(fields)) {
      const control = new RegExp(`<(?:input|select|textarea)[^>]*id="([\\w-]+)"[^>]*name="${name}"[^>]*>`).exec(form);
      assert.ok(control, name);
      assert.match(form, new RegExp(`<label[^>]*for="${control[1]}"[^>]*>[^<]+</label>`), `visible label for ${name}`);
      assert.match(control[0], new RegExp(`aria-describedby="[^"]*${control[1]}-error`), `error described for ${name}`);
      assert.doesNotMatch(control[0], /placeholder=/, name);
    }
    for (const [name, token] of Object.entries({ name: "name", email: "email", company: "organization", phone: "tel" }))
      assert.match(form, new RegExp(`name="${name}"[^>]*autocomplete="${token}"|autocomplete="${token}"[^>]*name="${name}"`), name);
  });

  test("main.js shows the same messages the server sends", async () => {
    const js = await read("main.js");
    for (const message of [...Object.values(messages.required), messages.email, messages.phone]) assert.ok(js.includes(JSON.stringify(message)), message);
  });
});

describe("ALTCHA proof of work", () => {
  test("a solved challenge verifies once for its origin only", async () => {
    const challenge = await issueChallenge(SECRET, ORIGIN);
    const token = await solvedToken(challenge);
    assert.equal(await verifyProof(token, SECRET, ORIGIN), challenge.signature);
    assert.equal(await verifyProof(token, SECRET, "https://other.vercel.app"), null);
    assert.equal(await verifyProof(token, "b".repeat(64), ORIGIN), null);
  });

  test("expired, tampered, wrong answers and malformed tokens fail", async () => {
    const challenge = await issueChallenge(SECRET, ORIGIN);
    const token = await solvedToken(challenge);
    assert.equal(await verifyProof(token, SECRET, ORIGIN, Date.now() + (CHALLENGE_SECONDS + 5) * 1000), null);
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const tampered = structuredClone(decoded);
    tampered.challenge.parameters.cost = 1;
    assert.equal(await verifyProof(Buffer.from(JSON.stringify(tampered)).toString("base64"), SECRET, ORIGIN), null);
    const wrong = structuredClone(decoded);
    wrong.solution.counter += 1;
    assert.equal(await verifyProof(Buffer.from(JSON.stringify(wrong)).toString("base64"), SECRET, ORIGIN), null);
    for (const bad of [undefined, "", "not base64!", "a".repeat(3000), Buffer.from("{}").toString("base64"), 12]) assert.equal(await verifyProof(bad, SECRET, ORIGIN), null);
  });

  test("the browser solver in main.js derives keys the way altcha-lib does", async () => {
    // Same PBKDF2 input (nonce + big endian uint32 counter) through Web Crypto.
    const challenge = await issueChallenge(SECRET, ORIGIN);
    const p = challenge.parameters;
    const { counter } = await solveChallenge({ challenge, deriveKey });
    const nonce = Buffer.from(p.nonce, "hex");
    const password = new Uint8Array(nonce.length + 4);
    password.set(nonce);
    new DataView(password.buffer).setUint32(nonce.length, counter, false);
    const key = await crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]);
    const bits = Buffer.from(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Buffer.from(p.salt, "hex"), iterations: p.cost }, key, 256)).toString("hex");
    assert.ok(bits.startsWith(p.keyPrefix));
    assert.equal(await verifyProof(Buffer.from(JSON.stringify({ challenge, solution: { counter, derivedKey: bits } })).toString("base64"), SECRET, ORIGIN), challenge.signature);
  });
});

describe("configuration", () => {
  test("only Prisma hosts on Vercel, pooled at runtime and direct for migrations", () => {
    const raw = "postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require";
    assert.equal(databaseUrl(raw, true), "postgres://user:pass@pooled.db.prisma.io:5432/postgres?sslmode=verify-full");
    assert.equal(databaseUrl(raw, true, "direct"), "postgres://user:pass@db.prisma.io:5432/postgres?sslmode=verify-full");
    assert.equal(databaseUrl("postgres://user:pass@db.prisma.io:5432/postgres", true), null);
    assert.equal(databaseUrl("postgres://user:pass@evil.example:5432/postgres?sslmode=require", true), null);
    assert.equal(databaseUrl("postgresql://u@127.0.0.1:5432/x", true), null);
    assert.equal(databaseUrl("postgresql://u@127.0.0.1:5432/x", false), "postgresql://u@127.0.0.1:5432/x");
    assert.equal(databaseUrl("prisma+postgres://accelerate.prisma-data.net/?api_key=x", true), null);
  });

  test("the cleanup cron uses the direct host, like migrations; app traffic stays pooled", () => {
    for (const host of ["db.prisma.io", "pooled.db.prisma.io"]) {
      const raw = `postgres://user:pass@${host}:5432/postgres?sslmode=require`;
      const url = new URL(cleanupDatabaseUrl({ VERCEL: "1", DATABASE_URL: raw }));
      assert.equal(url.hostname, "db.prisma.io", host);
      assert.equal(new URL(intakeConfig({ VERCEL: "1", VERCEL_URL: "energiawebsite-abc-team.vercel.app", DATABASE_URL: raw, INQUIRY_HASH_SECRET: SECRET }).databaseUrl).hostname, "pooled.db.prisma.io");
    }
    assert.equal(cleanupDatabaseUrl({ VERCEL: "1", DATABASE_URL: "postgres://user:pass@evil.example:5432/postgres?sslmode=require" }), null);
  });

  test("allowed origins are this deployment's exact hosts", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_URL: "energiawebsite-abc-team.vercel.app", VERCEL_BRANCH_URL: "energiawebsite-git-x-team.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "energia.example" };
    assert.deepEqual(allowedOrigins(env), ["https://energiawebsite-abc-team.vercel.app", "https://energiawebsite-git-x-team.vercel.app"]);
    assert.deepEqual(allowedOrigins({ ...env, VERCEL_ENV: "production" }).at(-1), "https://energia.example");
    assert.deepEqual(allowedOrigins({ VERCEL: "1", INQUIRY_ORIGINS: "http://127.0.0.1:4000,https://ok.example,https://bad.example/path" }), ["https://ok.example"]);
    assert.deepEqual(allowedOrigins({ INQUIRY_ORIGINS: "http://127.0.0.1:4000" }), ["http://127.0.0.1:4000"]);
  });

  test("INQUIRY_ORIGINS adds every other served host on production; bad entries are dropped", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_URL: "energiawebsite-abc-team.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "energia.example" };
    assert.deepEqual(allowedOrigins({ ...env, INQUIRY_ORIGINS: " https://www.energia.example , HTTPS://Energiawebsite.vercel.app/,https://energia.example" }), [
      "https://energiawebsite-abc-team.vercel.app",
      "https://energia.example",
      "https://www.energia.example",
      "https://energiawebsite.vercel.app",
    ]);
    for (const bad of ["energia.example", "https://energia.example/path", "https://energia.example?x=1", "https://energia.example#x", "https://user@energia.example", "http://energia.example", "ftp://energia.example", "https://*.energia.example"])
      assert.deepEqual(allowedOrigins({ ...env, INQUIRY_ORIGINS: bad }), ["https://energiawebsite-abc-team.vercel.app", "https://energia.example"], bad);
    assert.deepEqual(allowedOrigins({ ...env, INQUIRY_ORIGINS: undefined }), ["https://energiawebsite-abc-team.vercel.app", "https://energia.example"]);
  });

  test("intake origin: the exact Origin header is required, with or without Fetch Metadata", () => {
    const origins = ["https://energia.example"];
    const req = (headers) => ({ headers });
    assert.equal(requestOrigin(req({ origin: "https://energia.example", "sec-fetch-site": "same-origin" }), origins), "https://energia.example");
    // Safari before 16.4 sends Origin on a POST but no Sec-Fetch-Site.
    assert.equal(requestOrigin(req({ origin: "https://energia.example" }), origins), "https://energia.example");
    assert.equal(requestOrigin(req({ "sec-fetch-site": "same-origin", host: "energia.example" }), origins), null, "Host alone is never enough");
    assert.equal(requestOrigin(req({ origin: "https://energia.example", "sec-fetch-site": "same-site" }), origins), null);
    assert.equal(requestOrigin(req({ origin: "https://www.energia.example" }), origins), null);
    assert.equal(requestOrigin(req({ origin: "null" }), origins), null);
    assert.equal(requestOrigin(req({}), origins), null);
  });

  test("intake is off unless database, origin and secret are all valid", () => {
    const env = { DATABASE_URL: "postgresql://u@127.0.0.1:5432/x", INQUIRY_ORIGINS: "http://127.0.0.1:4000", INQUIRY_HASH_SECRET: SECRET };
    assert.ok(intakeConfig(env));
    assert.equal(intakeConfig({ ...env, INQUIRY_HASH_SECRET: "short" }), null);
    assert.equal(intakeConfig({ ...env, INQUIRY_ORIGINS: "" }), null);
    assert.equal(intakeConfig({ ...env, DATABASE_URL: "" }), null);
  });
});

describe("American English", () => {
  test("no British spellings or words in any visitor or owner facing file", async () => {
    // Words this project has already corrected once, plus the usual suspects.
    const british = /\b(?:brackets?|pavements?|(?:col|fav|behavi|neighb|hon|lab|harb)ours?|\w*(?:organ|real|optim|minim|maxim|prior|summar|util|author|recogn|emphas|special|standard|categor|custom)is(?:e[ds]?|ing|ation)|analys(?:e[ds]?|ing)|centres?|licence|programmes?|catalogue|cheques?|(?:kilo|centi)?metres?|whilst|amongst|postcode|enquir(?:y|ies)|labelled|cancelled|travelled|modelled|fulfil|enrol|grey|tonnes?|storeys?|car park|full stop|mobile number)\b/gi;
    const files = ["index.html", "privacy.html", "admin.html", "admin.js", "main.js", "server/fields.js", "server/admin.js", "server/inquiry.js"];
    const hits = [];
    for (const f of files) {
      const text = await read(f);
      for (const m of text.matchAll(british)) hits.push(`${f}: ${text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, " ")}`);
    }
    assert.deepEqual(hits, []);
  });
});

describe("CSV export", () => {
  test("quotes every cell and defuses formulas", () => {
    assert.equal(csvCell('He said "hi"'), '"He said ""hi"""');
    assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
    assert.equal(csvCell("+1 617"), `"'+1 617"`);
    assert.equal(csvCell(null), '""');
    const csv = toCsv([{ reference: "EA-ABCDEFGH", name: "A, B", improve: "line\nbreak" }]);
    assert.ok(csv.startsWith("﻿\"Reference\""));
    assert.ok(csv.includes('"EA-ABCDEFGH"'));
    assert.ok(csv.includes('"line\nbreak"'));
  });
});

describe("admin password", () => {
  test("scrypt hash compare; the password itself is never stored", async () => {
    const stored = await hashPassword("correct horse battery staple");
    assert.match(stored, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    assert.ok(!stored.includes("correct"));
    assert.equal(await passwordMatches("correct horse battery staple", stored), true);
    assert.equal(await passwordMatches("wrong", stored), false);
    assert.equal(await passwordMatches(undefined, stored), false);
    assert.equal(await passwordMatches("x", "not a hash"), false);
  });
});

describe("inquiries are never deleted automatically", () => {
  test("the only statement that deletes an inquiry is the owner's erase", async () => {
    const sources = [];
    for (const dir of ["server", "api", "scripts"]) {
      for (const f of await readdir(new URL(`${dir}/`, root))) if (/\.(m?js)$/.test(f)) sources.push([`${dir}/${f}`, await read(`${dir}/${f}`)]);
    }
    const deletes = sources.flatMap(([f, s]) => [...s.matchAll(/DELETE FROM inquiries\b|TRUNCATE[^;"`]*inquiries|UPDATE inquiries SET[^`]*\b(?:name|email|company|phone|improve)\s*=\s*NULL/gi)].map((m) => `${f}: ${m[0]}`));
    assert.deepEqual(deletes, ["server/store.js: DELETE FROM inquiries"]);
    const store = await read("server/store.js");
    const eraseFn = store.slice(store.indexOf("export function erase"), store.indexOf("// Expired security rows"));
    assert.ok(eraseFn.includes("DELETE FROM inquiries"), "the delete lives in erase()");
    assert.ok(eraseFn.includes("withSession"), "erase requires a live owner session");
    assert.deepEqual(Object.keys(expiringTables).sort(), ["admin_sessions", "rate_limits", "used_proofs"]);
  });

  test("the only cron is the security row cleanup, and no migration expires inquiries", async () => {
    const vercel = JSON.parse(await read("vercel.json"));
    assert.deepEqual(vercel.crons, [{ path: "/api/cleanup", schedule: "0 8 * * *" }]);
    const sql = await read("migrations/001_inquiries.up.sql");
    assert.doesNotMatch(sql, /expires_at[^\n]*\n?[^\n]*inquiries|CREATE TABLE inquiries[^;]*expires_at/);
    assert.doesNotMatch(sql, /TRIGGER|RULE|pg_cron/i);
  });
});
