/**
 * SePay config loader — đọc env và validate.
 *
 * Nguyên tắc:
 * - Mọi env liên quan SePay đọc qua đây, KHÔNG đọc trực tiếp `process.env` ở nơi khác.
 * - Nếu thiếu env bắt buộc → throw early (catch ở endpoint → 500).
 * - Nếu SEPAY_ENABLED=false → trả "disabled" config để webhook no-op.
 *
 * Env vars hợp lệ (xem .env.example):
 *   SEPAY_ENABLED                true|false   (default: false)
 *   SEPAY_AUTH_METHOD            api_key|hmac_sha256|none  (default: api_key)
 *   SEPAY_API_KEY                (required nếu auth=api_key|hmac_sha256)
 *   SEPAY_WEBHOOK_SECRET         (required nếu auth=hmac_sha256)
 *   SEPAY_BANK_CODE              (required nếu enabled)    VD: MBBank
 *   SEPAY_BANK_ACCOUNT           (required nếu enabled)    VD: 0903252427
 *   SEPAY_BANK_ACCOUNT_NAME      (required nếu enabled)    VD: NGUYEN VAN A
 *   SEPAY_API_URL                (optional, default https://userapi.sepay.vn/v2)
 *
 * KHÔNG có env nào cho "payment gateway" vì ta không dùng.
 */

import type { SepayAuthMethod } from "./types";

export interface SepayConfig {
  enabled: boolean;
  authMethod: SepayAuthMethod;
  apiKey: string | null;
  webhookSecret: string | null;
  bank: {
    code: string;
    account: string;
    accountName: string;
  };
  apiUrl: string;
}

export type SepayConfigResult =
  | { ok: true; config: SepayConfig }
  | { ok: false; disabled: true }
  | { ok: false; error: string };

function readEnv(key: string): string | null {
  const v = process.env[key];
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function loadSepayConfig(): SepayConfigResult {
  const enabledRaw = readEnv("SEPAY_ENABLED");
  const enabled = enabledRaw === "true";

  if (!enabled) {
    return { ok: false, disabled: true };
  }

  const authMethodRaw = readEnv("SEPAY_AUTH_METHOD") ?? "api_key";
  const validAuth: SepayAuthMethod[] = ["api_key", "hmac_sha256", "none"];
  if (!validAuth.includes(authMethodRaw as SepayAuthMethod)) {
    return {
      ok: false,
      error: `SEPAY_AUTH_METHOD không hợp lệ: ${authMethodRaw}. Hợp lệ: ${validAuth.join(", ")}`,
    };
  }

  const authMethod = authMethodRaw as SepayAuthMethod;

  const apiKey = readEnv("SEPAY_API_KEY");
  const webhookSecret = readEnv("SEPAY_WEBHOOK_SECRET");

  if (authMethod === "api_key" && !apiKey) {
    return {
      ok: false,
      error: "SEPAY_AUTH_METHOD=api_key nhưng SEPAY_API_KEY chưa đặt",
    };
  }

  if (authMethod === "hmac_sha256" && !webhookSecret) {
    return {
      ok: false,
      error: "SEPAY_AUTH_METHOD=hmac_sha256 nhưng SEPAY_WEBHOOK_SECRET chưa đặt",
    };
  }

  const bankCode = readEnv("SEPAY_BANK_CODE");
  const bankAccount = readEnv("SEPAY_BANK_ACCOUNT");
  const bankAccountName = readEnv("SEPAY_BANK_ACCOUNT_NAME");

  if (!bankCode || !bankAccount || !bankAccountName) {
    return {
      ok: false,
      error:
        "Thiếu SEPAY_BANK_CODE, SEPAY_BANK_ACCOUNT hoặc SEPAY_BANK_ACCOUNT_NAME",
    };
  }

  return {
    ok: true,
    config: {
      enabled: true,
      authMethod,
      apiKey,
      webhookSecret,
      bank: {
        code: bankCode,
        account: bankAccount,
        accountName: bankAccountName,
      },
      apiUrl: readEnv("SEPAY_API_URL") ?? "https://userapi.sepay.vn/v2",
    },
  };
}

/**
 * Helper: trả về config hoặc throw với message rõ ràng.
 * Dùng cho code paths BẮT BUỘC có config (ví dụ: tạo QR, build webhook handler).
 */
export function requireSepayConfig(): SepayConfig {
  const result = loadSepayConfig();
  if (result.ok) return result.config;
  if ("disabled" in result && result.disabled) {
    throw new Error("SePay chưa được bật (SEPAY_ENABLED != true)");
  }
  throw new Error(`SePay config invalid: ${(result as { error: string }).error}`);
}

/** Lấy thông tin ngân hàng dùng cho VietQR (không cần auth/secret). */
export function getBankInfo(): { code: string; account: string; accountName: string } | null {
  const code = readEnv("SEPAY_BANK_CODE");
  const account = readEnv("SEPAY_BANK_ACCOUNT");
  const accountName = readEnv("SEPAY_BANK_ACCOUNT_NAME");
  if (!code || !account || !accountName) return null;
  return { code, account, accountName };
}
