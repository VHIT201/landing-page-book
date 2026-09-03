/**
 * POST /api/webhooks/sepay
 *
 * Endpoint duy nhất SePay gọi khi có giao dịch.
 *
 * Response format (Sepay yêu cầu):
 *   - HTTP 200/201 + body exactly `{"success": true}` = success
 *   - Mọi status khác (incl 4xx/5xx/redirect/timeout) = fail, sẽ retry
 *
 * Đọc raw body để verify HMAC (vì Next.js mặc định parse JSON →
 *   đọc text trước rồi parse tay).
 */

import { NextResponse } from "next/server";
import {
  loadSepayConfig,
  processSepayWebhook,
  verifySepayRequest,
  type SepayWebhookHeaders,
} from "@/lib/sepay";

export const runtime = "nodejs"; // cần Node crypto cho HMAC
export const dynamic = "force-dynamic"; // không cache
export const preferredRegion = "auto";

export async function POST(req: Request) {
  const startedAt = Date.now();

  // === Read raw body (BẮT BUỘC cho HMAC) ===
  const rawBody = await req.text();

  // === Read headers ===
  const headers: SepayWebhookHeaders = {
    authorization: req.headers.get("authorization") ?? undefined,
    signature: req.headers.get("x-sepay-signature") ?? undefined,
    timestamp: req.headers.get("x-sepay-timestamp") ?? undefined,
    contentType: req.headers.get("content-type") ?? undefined,
  };

  // === Load SePay config ===
  const configResult = loadSepayConfig();
  if (!configResult.ok) {
    if ("disabled" in configResult && configResult.disabled) {
      console.warn("[SEPAY_DISABLED]", { ip: req.headers.get("x-forwarded-for") });
      // Vẫn trả 200 để SePay không retry nếu chủ shop tạm tắt.
      return NextResponse.json({ success: true, disabled: true });
    }
    const errorMsg =
      "error" in configResult ? configResult.error : "invalid_config";
    console.error("[SEPAY_CONFIG_INVALID]", errorMsg);
    return NextResponse.json({ success: false, error: "config" }, { status: 500 });
  }
  const config = configResult.config;

  // === Authenticate ===
  const auth = verifySepayRequest(
    config.authMethod,
    headers,
    rawBody,
    config.apiKey,
    config.webhookSecret,
  );
  if (!auth.ok) {
    console.warn("[SEPAY_AUTH_FAILED]", {
      method: config.authMethod,
      reason: auth.reason,
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // === Parse JSON ===
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("[SEPAY_INVALID_JSON]", {
      snippet: rawBody.slice(0, 200),
    });
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  // === Validate accountNumber (defense in depth) ===
  if (
    typeof payload === "object" &&
    payload !== null &&
    "accountNumber" in payload &&
    (payload as { accountNumber?: string }).accountNumber !== config.bank.account
  ) {
    console.warn("[SEPAY_WRONG_ACCOUNT]", {
      got: (payload as { accountNumber?: string }).accountNumber,
      expected: config.bank.account,
    });
    // Vẫn trả 200 để SePay không retry — sai account là vấn đề ngân hàng, không phải lỗi của mình.
    return NextResponse.json({ success: true });
  }

  // === Process ===
  try {
    const result = await processSepayWebhook(payload);
    console.log("[SEPAY_PROCESSED]", {
      action: result.action,
      code: result.orderCode,
      txId:
        typeof payload === "object" && payload !== null && "id" in payload
          ? (payload as { id?: number }).id
          : undefined,
      tookMs: Date.now() - startedAt,
    });
    // Quan trọng: trả 200 + {"success":true} cho MỌI case (duplicate, mismatch, ...)
    // vì request đã được auth thành công.
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SEPAY_INTERNAL_ERROR]", {
      err: err instanceof Error ? err.message : String(err),
      payload: typeof payload === "object" && payload !== null ? "object" : typeof payload,
    });
    // Trả 500 để SePay retry (theo schedule).
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 },
    );
  }
}

// Vercel convention: từ chối các method khác.
export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
