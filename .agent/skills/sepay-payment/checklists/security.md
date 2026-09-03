# Security Checklist — SePay

Dành cho security review.

## Authentication

- [ ] Webhook endpoints yêu cầu auth (API Key hoặc HMAC)
- [ ] Production dùng HMAC-SHA256 (không phải API Key)
- [ ] HMAC verify trên RAW body (không JSON.parse rồi stringify lại)
- [ ] Constant-time compare dùng `timingSafeEqual`
- [ ] Timestamp tolerance ≤ 5 phút

## Secrets management

- [ ] `SEPAY_API_KEY` KHÔNG commit vào git
- [ ] `SEPAY_WEBHOOK_SECRET` KHÔNG commit
- [ ] `.env.local` trong `.gitignore`
- [ ] Log chỉ in 4 ký tự cuối của secret (nếu cần)
- [ ] Production secrets khác với dev/staging
- [ ] Rotate secrets mỗi 90 ngày

## Input validation

- [ ] `id` phải là integer dương (từ chối string)
- [ ] `transferType` chỉ nhận "in"
- [ ] `transferAmount` > 0
- [ ] `accountNumber` phải khớp SEPAY_BANK_ACCOUNT
- [ ] `content` không được rỗng
- [ ] Tất cả fields type-checked

## Business logic

- [ ] Amount EXACT MATCH (không tolerance mặc định)
- [ ] Order code extract qua regex với boundary (không `content.includes`)
- [ ] payment.amount === order.total_amount (verify invariant)
- [ ] Status transition forward-only

## Database

- [ ] `payments.sepay_transaction_id` UNIQUE → no duplicate confirm
- [ ] `payments.order_id` UNIQUE WHERE active → 1 order 1 active payment
- [ ] `sepay_webhook_logs.transaction_id` UNIQUE → race-safe
- [ ] Mọi payment confirmation trong `db.transaction()`

## HTTP hardening

- [ ] Response body CHÍNH XÁC `{"success": true}` cho success
- [ ] Response time < 30s (Sepay timeout)
- [ ] Chỉ POST method accepted; GET → 405
- [ ] Content-Type: application/json enforced
- [ ] Body size limit (prevent oversized payload)

## Network

- [ ] HTTPS required (Sepay docs)
- [ ] Backend deploy trên Vercel = HTTPS OK
- [ ] IP whitelist ở firewall optional nhưng khuyến nghị
  - 172.236.138.20, 172.233.83.68, 171.244.35.2
  - 151.158.108.68, 151.158.109.79, 103.255.238.139
  - 2400:8905::2000:8cff:fe98:45cd
  - 2600:3c15::2000:8aff:fedd:874b

## Failure modes

- [ ] Auth fail → 401 (Sepay retries)
- [ ] Invalid JSON → 400 (Sepay retries)
- [ ] Invalid payload → 200 (no retry, logged)
- [ ] Order not found → 200 (no retry)
- [ ] Amount mismatch → 200 (no retry, admin manual)
- [ ] DB error → 500 (Sepay retries)
- [ ] Mọi error có log category rõ ràng

## Anti-patterns cần tránh

- ❌ Không log raw API key/secret
- ❌ Không log raw request body (chỉ log ID, code, summary)
- ❌ Không tin `code` field từ Sepay (luôn extract từ `content`)
- ❌ Không cho phép client-side set order status
- ❌ Không check duplicate chỉ bằng `if (existing)` — phải dùng UNIQUE constraint
- ❌ Không disable auth trong production (kể cả "for testing")
