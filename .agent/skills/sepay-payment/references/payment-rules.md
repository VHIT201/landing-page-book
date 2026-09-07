# Payment Rules — Business Rules cho THE LIFECAR

Tài liệu này quy định business rules phải tuân thủ. Bất kỳ thay đổi nào phải update docs + tests + (nếu cần) DB schema.

## Quy tắc 1: Amount policy — EXACT MATCH

```text
actualAmount (từ Sepay) MUST === expectedAmount (order.total_amount)
```

**Từ chối**:
- `actual < expected` (underpay): khách có thể gõ thiếu, không confirm (tránh ambiguous).
- `actual > expected` (overpay): khách có thể CK gộp 2 đơn, confirm 1 đơn sẽ nhầm. Bắt buộc admin xử lý.

Implementation: `lib/sepay/matcher.ts:checkAmount()`.

**Khi khách CK sai**:
- Log `action='amount_mismatch'` vào `sepay_webhook_logs`.
- KHÔNG update order status.
- Trả 200 success (để Sepay ko retry).
- Admin check logs trong admin panel → liên hệ khách.

## Quy tắc 2: Account number MUST match

```text
payload.accountNumber MUST === SEPAY_BANK_ACCOUNT (env)
```

**Từ chối** nếu khác:
- Log `action='wrong_account'`.
- Không update gì cả.
- 200 success (Sepay ko retry).

Lý do: tài khoản có thể thay đổi theo thời gian. Webhook cũ vẫn đến nhưng từ STK cũ → bỏ qua.

## Quy tắc 3: transferType MUST = "in"

```text
payload.transferType MUST === "in"
```

Chỉ nhận tiền vào. "out" = tiền ra khỏi tài khoản shop = KHÔNG confirm đơn.

Log `action='wrong_transfer_type'`.

## Quy tắc 4: Idempotency — UNIQUE transaction_id

```text
Một Sepay transaction (id) chỉ confirm payment 1 lần.
```

Database constraints:
- `payments.sepay_transaction_id` UNIQUE
- `sepay_webhook_logs.transaction_id` UNIQUE

Sử dụng `INSERT ... ON CONFLICT DO NOTHING` cho cả hai để race-safe.

## Quy tắc 5: Order → Payment amount invariant

```text
payment.amount MUST === order.total_amount (tại thời điểm tạo payment)
```

Khi `createOrder()` chạy, payment.amount = order.total_amount (cùng transaction). Nếu sau đó admin sửa totalAmount (chưa support) → KHÔNG tự update payment. Admin phải refund + tạo payment mới.

## Quy tắc 6: paidAt immutability

```text
order.paidAt chỉ set 1 lần (lần đầu paid) — KHÔNG update ngược.
```

Implementation: `setOrderStatus` check `if (toStatus === "paid" && !current.paidAt)`.

Cùng logic cho webhook: `paidAt: order.paidAt || new Date()`.

## Quy tắc 7: Order status forward-only

```text
order.status chỉ được transition forward trong STATUS_FLOW.
```

`setOrderStatus` không có mapping ngược lại. Ví dụ:
- paid → pending_payment: KHÔNG (là lỗi logic nếu xảy ra → bug).
- delivered → paid: KHÔNG.
- refunded → paid: KHÔNG.

(Hoàn tác chỉ qua admin manual PATCH, không qua webhook.)

## Quy tắc 8: Atomic confirmation

```text
Mọi payment confirmation phải trong DB transaction:
  BEGIN
    INSERT webhook_log
    UPDATE payment
    UPDATE order
    INSERT order_status_history
  COMMIT
```

Nếu bất kỳ step fail → ROLLBACK toàn bộ. Trạng thái sau fail = trạng thái trước webhook.

## Quy tắc 9: Expiration (optional, future)

Hiện tại KHÔNG có expiration. Đơn `pending_payment` có thể pending mãi mãi nếu khách không CK.

Phase 2 (optional): tự động cancel đơn quá 7 ngày chưa paid.

## Edge cases

### Khách CK nhiều lần cùng 1 đơn

- Webhook 1: confirm payment, update order.
- Webhook 2 (cùng txn_id hoặc khác nhưng nội dung giống):
  - Cùng txn_id: action='duplicate', no-op.
  - Khác txn_id nhưng cùng order code:
    - amount < total: action='amount_mismatch', log only.
    - amount = total: → ambiguity (cùng order match 2 giao dịch)
      - Hiện tại: chấp nhận (do webhook đã auth).
      - Future: gộp thành 1 payment (logic phức tạp — chưa support).
    - amount > total: rejected (per rule 1).

### Khách CK nhầm đơn

- CK gộp 2 đơn (1 triệu + 5 triệu = 6 triệu CK cho đơn 5 triệu):
  - Order 5 triệu: amount_too_high → reject, admin can manually decide.
  - Order 1 triệu: missing webhook for that amount → admin contact khách.

### Khách CK trước khi đơn được tạo (race condition)

- Rất hiếm. Nếu xảy ra: order_not_found, log only.
- Không nên tự confirm vì không có order.

### Khách gõ nội dung sai

- VD: CK với content "LC-A2B3C4 thanh toan" (có khoảng trắng thừa).
- Regex `extractOrderCode` chấp nhận ký tự boundary (space), OK.
- VD: "Thanh toan L C - A2B3C4" (có space trong code):
  - Regex match: `LC-A2B3C4` nếu theo sau là space non-alphanumeric, OK.
  - Nhưng nếu "LC-A 2B3C4" (space trong code): match fail.
  - SePay tự trích `code` riêng (xem docs.sepay.vn/payment-code-structure), nếu user config prefix `LC-` 6 ký tự thì sẽ ra `LC-A2B3C4`. Trong webhook payload, `code` field được fill nếu match template.
  - Nhưng để chắc, backend vẫn extract từ `content` thay vì tin `code` field.

### Stale bank account

- Nếu admin đổi SEPAY_BANK_ACCOUNT trong env, webhook cũ với STK cũ = `wrong_account`, no-op.
- Đơn pending_payment vẫn pending cho đến khi khách CK lại với STK mới.

## Implementation pointers

| Rule | File | Function |
|---|---|---|
| 1 | `lib/sepay/matcher.ts` | `checkAmount` |
| 2 | `app/api/webhooks/sepay/route.ts` | `accountNumber !== config.bank.account` |
| 3 | `lib/sepay/webhook.ts` | `payload.transferType !== "in"` |
| 4 | `lib/sepay/webhook.ts` | `onConflictDoNothing` |
| 5 | `lib/orders.ts` | `createOrder` (cùng transaction) |
| 6 | `lib/orders.ts` | `setOrderStatus` (paidAt null check) |
| 7 | `lib/orders.ts` | `setOrderStatus` (no rollback mapping) |
| 8 | `lib/sepay/webhook.ts` | `db.transaction(async (tx) => ...)` |
| 9 | future | cron/manual |

## Khi nào cần thay đổi rule

KHÔNG tự ý. Mọi thay đổi phải:
1. Document đầy đủ use case + impact
2. Update tests
3. Migration nếu liên quan DB (ví dụ: thêm tolerance amount range)
4. Update SKILL.md nếu AI agent cần biết
