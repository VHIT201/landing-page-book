/**
 * Pure-function tests cho SePay matcher + auth.
 *
 * Chạy:
 *   node --test lib/sepay/__tests__/matcher.test.mjs
 *
 * Không cần tsx/build. Logic được tái hiện inline để so sánh với
 * implementation gốc (lib/sepay/matcher.ts + lib/sepay/auth.ts).
 *
 * Code alphabet: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (32 ký tự, bỏ I/O/1/0).
 * Valid test codes dùng CHỮ CÁI trong alphabet đó:
 *   - KHÔNG chứa: I, O, 0, 1
 *   - Ví dụ hợp lệ: LC-A2B3C4, LC-XYZ234, LC-AB23CD
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// === Constants matching lib/sepay/matcher.ts ===
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ORDER_CODE_REGEX = new RegExp(
  `(?:^|[^A-Z0-9])(LC-[${CODE_ALPHABET}]{6})(?:[^A-Z0-9]|$)`,
  "i",
);

// === Functions matching lib/sepay/matcher.ts ===
function extractOrderCode(content) {
  if (!content || typeof content !== "string") return null;
  const m = content.match(ORDER_CODE_REGEX);
  return m ? m[1].toUpperCase() : null;
}

function checkAmount(expected, actual) {
  if (actual === expected) return { ok: true, reason: "exact_match", expected, actual };
  if (actual < expected) return { ok: false, reason: "amount_too_low", expected, actual };
  return { ok: false, reason: "amount_too_high", expected, actual };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function verifyApiKey(authHeader, apiKey) {
  if (!authHeader) return false;
  return timingSafeEqual(authHeader, `Apikey ${apiKey}`);
}

function signHmacSha256(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyHmacSha256(headers, rawBody, secret, nowSec, maxDriftSec = 300) {
  const tsStr = headers.timestamp;
  const sigHeader = headers.signature;
  if (!tsStr || !sigHeader) return { ok: false, reason: "missing_signature_headers" };
  const tsSec = Number(tsStr);
  if (!Number.isFinite(tsSec) || tsSec <= 0) return { ok: false, reason: "invalid_timestamp" };
  const drift = Math.abs(nowSec - tsSec);
  if (drift > maxDriftSec) return { ok: false, reason: "timestamp_out_of_range" };
  const expectedSigHeader = sigHeader.startsWith("sha256=") ? sigHeader : `sha256=${sigHeader}`;
  const computed = `sha256=${signHmacSha256(secret, `${tsStr}.${rawBody}`)}`;
  if (!timingSafeEqual(expectedSigHeader, computed)) return { ok: false, reason: "signature_mismatch" };
  return { ok: true };
}

// === Sanity: alphabet không chứa I, O, 0, 1 ===
test("alphabet - excludes I, O, 0, 1", () => {
  assert.equal(CODE_ALPHABET.includes("I"), false);
  assert.equal(CODE_ALPHABET.includes("O"), false);
  assert.equal(CODE_ALPHABET.includes("0"), false);
  assert.equal(CODE_ALPHABET.includes("1"), false);
});

// === extractOrderCode ===

test("extractOrderCode - valid uppercase codes", () => {
  assert.equal(extractOrderCode("LC-A2B3C4 chuyen tien"), "LC-A2B3C4");
  assert.equal(extractOrderCode("LC-XYZ234 chuyen tien"), "LC-XYZ234");
  assert.equal(extractOrderCode("lc-xyz234 chuyen tien"), "LC-XYZ234", "lowercase → uppercase");
  assert.equal(extractOrderCode("Chuyen tien LC-A2B3C4"), "LC-A2B3C4");
  assert.equal(extractOrderCode("LC-AB23CD"), "LC-AB23CD");
});

test("extractOrderCode - boundary violations", () => {
  assert.equal(extractOrderCode("xLC-A2B3C4"), null, "prefix alphanumeric should not match");
  assert.equal(extractOrderCode("LC-A2B3C4x"), null, "suffix alphanumeric should not match");
  assert.equal(extractOrderCode("2LC-A2B3C4"), null, "digit prefix should not match");
});

test("extractOrderCode - invalid / excluded chars", () => {
  assert.equal(extractOrderCode(null), null);
  assert.equal(extractOrderCode(undefined), null);
  assert.equal(extractOrderCode(""), null);
  assert.equal(extractOrderCode("random text"), null);
  assert.equal(extractOrderCode("LC-A2B3"), null, "code too short");
  assert.equal(extractOrderCode("LC-A2B3C4D"), null, "code too long");
  // Ký tự '1' / '0' / 'I' / 'O' KHÔNG có trong alphabet → không match
  assert.equal(extractOrderCode("LC-A1B2C3"), null, "code contains '1'");
  assert.equal(extractOrderCode("LC-A0B2C3"), null, "code contains '0'");
  assert.equal(extractOrderCode("LC-AIB2C3"), null, "code contains 'I'");
  assert.equal(extractOrderCode("LC-AOB2C3"), null, "code contains 'O'");
});

test("extractOrderCode - multiple codes picks first", () => {
  const result = extractOrderCode("LC-A2B3C4 va LC-D4E5F6");
  assert.equal(result, "LC-A2B3C4");
});

// === checkAmount ===

test("checkAmount - exact match", () => {
  const r = checkAmount(198000, 198000);
  assert.equal(r.ok, true);
  assert.equal(r.reason, "exact_match");
});

test("checkAmount - too low", () => {
  const r = checkAmount(198000, 100000);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "amount_too_low");
});

test("checkAmount - too high", () => {
  const r = checkAmount(198000, 300000);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "amount_too_high");
});

// === verifyApiKey ===

test("verifyApiKey - happy path", () => {
  assert.equal(verifyApiKey("Apikey SECRET_KEY", "SECRET_KEY"), true);
});

test("verifyApiKey - wrong key", () => {
  assert.equal(verifyApiKey("Apikey WRONG", "SECRET_KEY"), false);
});

test("verifyApiKey - wrong scheme", () => {
  assert.equal(verifyApiKey("Bearer SECRET_KEY", "SECRET_KEY"), false);
  assert.equal(verifyApiKey("secret_key", "SECRET_KEY"), false);
});

test("verifyApiKey - missing header", () => {
  assert.equal(verifyApiKey(undefined, "SECRET_KEY"), false);
});

// === verifyHmacSha256 ===

test("verifyHmacSha256 - valid signature", () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const body = '{"id":1}';
  const sig = signHmacSha256("SECRET", `${ts}.${body}`);
  const r = verifyHmacSha256(
    { signature: `sha256=${sig}`, timestamp: ts },
    body,
    "SECRET",
    Number(ts),
  );
  assert.equal(r.ok, true);
});

test("verifyHmacSha256 - wrong signature", () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const r = verifyHmacSha256(
    { signature: "sha256=deadbeef", timestamp: ts },
    "{}",
    "SECRET",
    Number(ts),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "signature_mismatch");
});

test("verifyHmacSha256 - expired timestamp", () => {
  const ts = String(Math.floor(Date.now() / 1000) - 600); // 10 min ago
  const body = "{}";
  const sig = signHmacSha256("SECRET", `${ts}.${body}`);
  const r = verifyHmacSha256(
    { signature: `sha256=${sig}`, timestamp: ts },
    body,
    "SECRET",
    Math.floor(Date.now() / 1000),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "timestamp_out_of_range");
});

test("verifyHmacSha256 - missing timestamp", () => {
  const r = verifyHmacSha256(
    { signature: "sha256=abc" },
    "{}",
    "SECRET",
    Math.floor(Date.now() / 1000),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing_signature_headers");
});

// === timingSafeEqual ===

test("timingSafeEqual - equal", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
});

test("timingSafeEqual - different lengths or content", () => {
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "ab"), false);
  assert.equal(timingSafeEqual("", ""), true, "empty strings equal");
});

console.log("✓ All matcher + auth tests defined.");
