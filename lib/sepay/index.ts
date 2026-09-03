/**
 * Public exports của SePay module.
 *
 * Convention:
 * - Server-only code ở `lib/sepay/` (KHÔNG import từ "use client" files).
 * - Frontend chỉ dùng types qua re-export nếu cần.
 */

export * from "./types";
export * from "./config";
export { buildVietQrUrl, buildPaymentInstructions } from "./vietqr";
export type { PaymentInstructions } from "./vietqr";
export {
  extractOrderCode,
  extractAllOrderCodes,
  checkAmount,
  matchOrderCodeFromContent,
  isValidOrderCodeFormat,
  ORDER_CODE_REGEX,
} from "./matcher";
export type { AmountCheckResult, MatchResult } from "./matcher";
export {
  verifyApiKey,
  verifyHmacSha256,
  verifySepayRequest,
  signHmacSha256,
} from "./auth";
export { processSepayWebhook } from "./webhook";
export type { ProcessResult, ProcessOptions } from "./webhook";
