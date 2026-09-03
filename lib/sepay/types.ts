/**
 * TypeScript types khớp 1:1 với SePay webhook payload.
 *
 * Nguồn: https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook
 *         + https://docs.sepay.vn/tich-hop-webhooks.html
 *
 * Lưu ý quan trọng từ docs:
 * - `id`: integer, là SePay transaction ID. GIỐNG NHAU giữa các retry → dùng làm dedup key.
 * - `transferAmount`: integer VND, LUÔN DƯƠNG.
 * - `code`: có thể null (nếu content không match template đã config).
 * - `accumulated`: có thể = 0 (một số ngân hàng không hỗ trợ).
 * - `description`: có thể empty (một số ngân hàng không hỗ trợ).
 * - `subAccount`: có thể empty (VA matching).
 *
 * Phân biệt `null` vs empty string:
 * - `code = null`  → không có payment code (nghĩa khác với "")
 * - Trong JS cả null và "" đều falsy, dùng `=== null` để phân biệt.
 */

export type TransferType = "in" | "out";

/** Raw webhook payload như SePay gửi. */
export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string; // format "YYYY-MM-DD HH:mm:ss", giờ VN (UTC+7)
  accountNumber: string;
  subAccount: string | null;
  code: string | null;
  content: string;
  transferType: TransferType;
  description: string | null;
  transferAmount: number;
  accumulated: number | null;
  referenceCode: string | null;
}

/** Headers SePay gửi kèm webhook. */
export interface SepayWebhookHeaders {
  /** API Key: `Authorization: Apikey <KEY>` */
  authorization?: string;
  /** HMAC-SHA256: `X-SePay-Signature: sha256=<hex>` */
  signature?: string;
  /** HMAC-SHA256: `X-SePay-Timestamp: <unix seconds>` */
  timestamp?: string;
  contentType?: string;
}

/** Phương thức authentication cho webhook. */
export type SepayAuthMethod = "api_key" | "hmac_sha256" | "none";

/** Kết quả xử lý webhook — dùng nội bộ. */
export type SepayAction =
  | "payment_confirmed"
  | "duplicate"
  | "amount_mismatch"
  | "order_not_found"
  | "wrong_transfer_type"
  | "wrong_account"
  | "invalid_content"
  | "missing_payment"
  | "invalid_payload";

export interface SepayProcessResult {
  action: SepayAction;
  orderId?: string;
  orderCode?: string;
  paymentId?: string;
  reason?: string;
}
