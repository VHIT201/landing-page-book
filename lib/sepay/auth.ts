/**
 * SePay webhook authentication.
 *
 * Hỗ trợ:
 *   - api_key:        Authorization: Apikey <KEY>
 *   - hmac_sha256:    X-SePay-Signature: sha256=<hex>
 *                     X-SePay-Timestamp: <unix seconds>
 *                     HMAC(secret, "{timestamp}.{raw_body}")
 *   - none:           không auth (CHỈ DEV/TEST)
 *
 * Tất cả các verifier trả boolean. KHÔNG throw để caller dễ control flow.
 *
 * Timing-safe compare ở mọi nơi để tránh timing attack.
 * Nguồn: https://developer.sepay.vn/en/sepay-webhooks/xac-thuc
 */

import type { SepayAuthMethod, SepayWebhookHeaders } from "./types";

/** So sánh 2 string an toàn về timing (constant-time). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/**
 * Tính HMAC-SHA256 theo format SePay dùng.
 * Trả về hex string (không có prefix `sha256=`).
 */
export function signHmacSha256(secret: string, payload: string): string {
  // Dùng crypto từ Node (runtime=nodejs được set ở route handler).
  // KHÔNG dùng Web Crypto ở đây vì chạy được cả khi secret là binary.
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Verify API Key: header phải chính xác `Apikey <KEY>`. */
export function verifyApiKey(
  authHeader: string | undefined,
  apiKey: string,
): boolean {
  if (!authHeader) return false;
  const expected = `Apikey ${apiKey}`;
  return timingSafeEqual(authHeader, expected);
}

/**
 * Verify HMAC-SHA256:
 * - Đọc timestamp từ X-SePay-Timestamp, chỉ chấp nhận sai số ≤ maxDriftSec.
 * - Tính lại signature từ "{timestamp}.{rawBody}".
 * - Constant-time compare với X-SePay-Signature (sau khi strip "sha256=").
 *
 * @param nowSec  thời gian hiện tại (giây). Inject để dễ test.
 */
export function verifyHmacSha256(
  headers: SepayWebhookHeaders,
  rawBody: string,
  secret: string,
  nowSec: number,
  maxDriftSec = 300,
): { ok: boolean; reason?: string } {
  const tsStr = headers.timestamp;
  const sigHeader = headers.signature;

  if (!tsStr || !sigHeader) {
    return { ok: false, reason: "missing_signature_headers" };
  }

  const tsSec = Number(tsStr);
  if (!Number.isFinite(tsSec) || tsSec <= 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const drift = Math.abs(nowSec - tsSec);
  if (drift > maxDriftSec) {
    return { ok: false, reason: "timestamp_out_of_range" };
  }

  // Strip prefix "sha256=" nếu có
  const expectedSigHeader = sigHeader.startsWith("sha256=")
    ? sigHeader
    : `sha256=${sigHeader}`;

  const computed = `sha256=${signHmacSha256(secret, `${tsStr}.${rawBody}`)}`;

  if (!timingSafeEqual(expectedSigHeader, computed)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}

/**
 * Hàm verify cấp cao — chọn method phù hợp theo config.
 */
export function verifySepayRequest(
  method: SepayAuthMethod,
  headers: SepayWebhookHeaders,
  rawBody: string,
  apiKey: string | null,
  webhookSecret: string | null,
): { ok: boolean; reason?: string } {
  if (method === "none") return { ok: true };

  if (method === "api_key") {
    if (!apiKey) return { ok: false, reason: "no_api_key_configured" };
    const ok = verifyApiKey(headers.authorization, apiKey);
    return ok ? { ok: true } : { ok: false, reason: "invalid_api_key" };
  }

  if (method === "hmac_sha256") {
    if (!webhookSecret) {
      return { ok: false, reason: "no_webhook_secret_configured" };
    }
    return verifyHmacSha256(headers, rawBody, webhookSecret, Math.floor(Date.now() / 1000));
  }

  return { ok: false, reason: "unknown_auth_method" };
}
