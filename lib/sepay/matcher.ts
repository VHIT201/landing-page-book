/**
 * Order-code matcher + amount validator cho SePay webhook.
 *
 * Không bao giờ chỉ dựa vào `payload.content.includes(code)`. Phải:
 * 1. Tìm token khớp pattern `LC-XXXXXX` (6 ký tự, alphabet LC codebase).
 * 2. Đảm bảo ranh giới từ (boundary) — không match "xLC-AAAAAAx".
 * 3. Normalize whitespace + uppercase.
 *
 * Cùng alphabet với `lib/orders.ts` (CODE_ALPHABET). Nếu khác → matcher
 * thất bại trên code mới.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Extract `LC-XXXXXX` từ content, không phân biệt hoa/thường. */
export const ORDER_CODE_REGEX = new RegExp(
  String.raw`(?:^|[^A-Z0-9])(LC-[${CODE_ALPHABET}]{6})(?:[^A-Z0-9]|$)`,
  "i",
);

/**
 * Extract order code đầu tiên từ content.
 * - Trả về code UPPERCASE.
 * - Boundary an toàn: ký tự trước/sau không phải [A-Z0-9].
 */
export function extractOrderCode(content: string | null | undefined): string | null {
  if (!content || typeof content !== "string") return null;
  const m = content.match(ORDER_CODE_REGEX);
  return m ? m[1].toUpperCase() : null;
}

/** Trả về tất cả order codes có trong content. Dùng để debug edge case. */
export function extractAllOrderCodes(content: string): string[] {
  const seen = new Set<string>();
  const matches = content.matchAll(
    new RegExp(ORDER_CODE_REGEX.source, ORDER_CODE_REGEX.flags + "g"),
  );
  for (const m of matches) {
    seen.add(m[1].toUpperCase());
  }
  return Array.from(seen);
}

export interface AmountCheckResult {
  ok: boolean;
  reason: "exact_match" | "amount_too_low" | "amount_too_high";
  expected: number;
  actual: number;
}

/**
 * So sánh amount khách CK với amount đơn yêu cầu.
 * Policy hiện tại: EXACT MATCH (xem docs/payment-rules.md).
 */
export function checkAmount(
  expected: number,
  actual: number,
): AmountCheckResult {
  if (actual === expected) {
    return { ok: true, reason: "exact_match", expected, actual };
  }
  if (actual < expected) {
    return { ok: false, reason: "amount_too_low", expected, actual };
  }
  return { ok: false, reason: "amount_too_high", expected, actual };
}

export interface MatchResult {
  ok: boolean;
  orderCode?: string;
  reason?: string;
}

/**
 * Match order từ content (chỉ trả code, caller tự query DB).
 * Tách khỏi DB lookup để dễ unit-test.
 */
export function matchOrderCodeFromContent(
  content: string | null | undefined,
): MatchResult {
  const code = extractOrderCode(content);
  if (!code) return { ok: false, reason: "no_order_code_in_content" };
  return { ok: true, orderCode: code };
}

/** Validate format LC-XXXXXX đúng alphabet. */
export function isValidOrderCodeFormat(code: string | null | undefined): boolean {
  if (!code) return false;
  return new RegExp(`^LC-[${CODE_ALPHABET}]{6}$`).test(code);
}
