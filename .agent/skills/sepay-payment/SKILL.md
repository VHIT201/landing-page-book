# SePay Payment — THE LIFECAR

Skill này giúp AI Agent làm việc với tích hợp thanh toán SePay trong project **THE LIFECAR** (landing page bán sách "Chiếc Xe Cuộc Đời").

## Khi nào dùng skill này

Use this skill when ANY of the following:

- Implementing, modifying, or debugging the SePay payment flow
- Reviewing changes to `lib/sepay/*`, `app/api/webhooks/sepay/*`, payment-related schema, or payment-related frontend
- Writing tests for payment logic (matcher, auth, webhook processor)
- Investigating why an order is `pending_payment` instead of `paid`
- Adding new payment-related features (refund, reconciliation, multi-bank)
- Answering questions about how SePay works in THIS project specifically

## Trước khi viết code

BẮT BUỘC đọc (in order):

1. `references/architecture.md` — kiến trúc tổng thể đã chốt
2. `references/payment-rules.md` — business rules (amount, status flow, state machine)
3. `references/webhook.md` — chi tiết về webhook flow
4. `references/testing.md` — cách chạy / viết test
5. `references/troubleshooting.md` — debug phổ biến

Nếu cần thay đổi kiến trúc, KHÔNG tự quyết — đề xuất và update các file ref trước.

## Golden rules

Mọi agent/maintainer PHẢI tuân thủ:

```text
1. NEVER trust webhook payload blindly.
   → Always authenticate (API Key or HMAC).
   → Always validate payload (type, format, length).

2. NEVER mark order as 'paid' from frontend.
   → Chỉ backend-side verified payment (webhook) mới được phép.

3. NEVER trust client-supplied payment status.
   → Frontend có thể fake, không dùng làm canonical truth.

4. ALWAYS verify amount is EXACT MATCH.
   → Không chấp nhận underpay (khách gõ thiếu) hoặc overpay (KHÔNG tự ý confirm).

5. ALWAYS verify accountNumber equals SEPAY_BANK_ACCOUNT.
   → Tránh xử lý nhầm CK của người khác vào tài khoản khác.

6. ALWAYS use DB transaction for payment confirmation.
   → Insert webhook_log + update payment + update order + insert history = 1 transaction.
   → Nếu fail → rollback toàn bộ.

7. NEVER skip idempotency check.
   → UNIQUE(sepay_transaction_id) trong DB + ON CONFLICT DO NOTHING.
   → Sepay docs khuyến nghị rõ ràng (docs.sepay.vn).

8. NEVER expose payment secrets in logs / responses.
   → API Key, Webhook Secret = KHÔNG log.
   → Chỉ log prefix cuối (last 4 chars) nếu cần.

9. NEVER modify setOrderStatus() to break the existing 'sepay' actor.
   → 'sepay' đã được schema support. Phải giữ nguyên.

10. Return {"success": true} for ANY case where webhook is auth'd + payload valid.
    → Trừ DB error (500) hoặc auth fail (401).
    → Duplicate / amount_mismatch / order_not_found → 200 + no-op (không retry).
```

## File ownership

Các file này là "vùng" của SePay. Agent/developer modify phải hiểu impact.

```text
lib/sepay/
  types.ts           — TypeScript types khớp Sepay payload
  config.ts          — env loader + validation
  auth.ts            — API Key + HMAC verifiers
  matcher.ts         — order code extractor + amount check
  vietqr.ts          — VietQR URL generator
  webhook.ts         — main processor (processSepayWebhook)
  index.ts           — public exports

lib/db/schema.ts     — orders, order_status_history, payments, sepay_webhook_logs
lib/orders.ts        — createOrder (atomic), setOrderStatus (actor='sepay')

app/api/webhooks/sepay/route.ts       — POST endpoint Sepay gọi
app/api/payments/[code]/status/route.ts — GET polling endpoint
app/api/orders/route.ts               — POST (UPDATE: trả paymentInfo)
app/api/orders/[code]/route.ts        — GET (UPDATE: trả payment object)
app/don-hang/[code]/page.tsx          — UPDATE: payment banner + polling
components/OrderForm.tsx               — UPDATE: hiển thị QR + polling
app/admin/orders/[code]/page.tsx       — UPDATE: payment panel + webhook logs

content/site.ts                       — Thêm sepay.bank config
.env.example                          — Thêm SEPAY_* envs
```

Các file KHÔNG được modify trừ khi cần:

```text
lib/notify.ts                — Telegram; có thể mở rộng
lib/auth.ts                  — JWT admin session (giữ nguyên)
middleware.ts                — admin path protection
```

## Workflow debug SePay

Nếu khách báo "tôi đã CK nhưng đơn chưa paid":

```text
1. Check DB:
   - Order có paid_at không?
   - Payment có status != 'pending'?
   - Sepay_webhook_logs có record?

   SELECT * FROM sepay_webhook_logs
   WHERE order_code = 'LC-XXXXXX'
   ORDER BY processed_at DESC LIMIT 10;

2. Nếu KHÔNG có webhook log:
   → SePay không gọi webhook được
   → Check webhook URL (HTTPS, accessible)
   → Check Sepay dashboard: webhook đã config chưa
   → Có thể cần reconciliation (phase 2)

3. Nếu có log action='payment_confirmed' success='true':
   → Order đã được update, vấn đề ở frontend cache
   → Frontend polling mỗi 5s (xem OrderForm.tsx)

4. Nếu có log action='amount_mismatch':
   → Khách CK sai số tiền → liên hệ xác nhận

5. Nếu có log action='order_not_found':
   → Order code trong content không match DB
   → Check: regex matcher có bug? code nhập sai?

6. Nếu có log action='duplicate':
   → Webhook đã xử lý rồi → OK, không phải bug

7. Nếu KHÔNG có log gì cả nhưng khách chắc chắn đã CK:
   → Webhook thất bại ở network layer
   → Xem Sepay dashboard (delivery status)
   → Có thể cần manual reconcile
```

Nếu server trả 500 liên tục:

```text
- DB connection issue (Neon pool exhausted?)
- Transaction deadlock → check concurrent webhooks
- Bug trong processSepayWebhook (xem logs)
```

Nếu auth fail liên tục (401):

```text
- Env SEPAY_API_KEY / SEPAY_WEBHOOK_SECRET chưa set đúng
- HMAC timestamp drift >5 phút → NTP issue
- API Key format: phải là exact "Apikey <KEY>" (không phải "Bearer")
```

## Test workflow

Pure tests (matcher + auth):

```text
node --test lib/sepay/__tests__/matcher.test.mjs
```

Integration tests (yêu cầu DB thật):

```text
# Setup .env.local với DATABASE_URL trỏ vào Neon dev
# Tạo test order trước
node scripts/test-webhook.mjs
```

## Kiến trúc tổng thể (1 câu)

> Customer quét VietQR từ QR code → chuyển khoản → SePay forward webhook → backend authenticate → extract order code → verify amount exact → DB transaction update payment + order + history → trả `{success: true}` → frontend polling 5s thấy `paid` → hiển thị "Đã thanh toán".

## Critical env vars (production)

```env
SEPAY_ENABLED=true
SEPAY_AUTH_METHOD=hmac_sha256     # recommended
SEPAY_WEBHOOK_SECRET=<from Sepay dashboard>
SEPAY_BANK_CODE=<your bank>
SEPAY_BANK_ACCOUNT=<your account number>
SEPAY_BANK_ACCOUNT_NAME=<your name>
```

Xem `.env.example` đầy đủ.

## Đọc thêm

- `references/architecture.md` — sequence diagrams, state machines, security model
- `references/webhook.md` — chi tiết webhook lifecycle
- `references/payment-rules.md` — business rules + edge cases
- `references/testing.md` — test matrix + cách chạy
- `references/troubleshooting.md` — playbook cho ops

## Ví dụ payloads

Xem `examples/`:
- `valid-webhook.json` — payload đúng từ Sepay
- `duplicate-webhook.json` — retry cùng transaction_id
- `invalid-webhook.json` — amount mismatch

## Checklists

- `checklists/development.md` — checklist trước khi PR
- `checklists/security.md` — security review
- `checklists/deployment.md` — deploy lên production

---

> ⚠️ **Skill này phải khớp với implementation thật.** Nếu code thay đổi mà skill không update → bug. Owner phải update skill đồng thời.
