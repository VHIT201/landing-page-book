# Architecture — SePay Payment in THE LIFECAR

Tài liệu tham chiếu chi tiết kiến trúc. Đọc song song với [`docs/sepay-architecture.md`](../../../docs/sepay-architecture.md) — file này là version "AI-agent-oriented", tập trung vào decision points.

## Quyết định kiến trúc cốt lõi

| Decision | Choice | Lý do |
|---|---|---|
| Product | Bank Transfer + VietQR + Webhook (không phải Payment Gateway) | 0% phí, UX tốt hơn, đủ cho use case |
| Auth | HMAC-SHA256 (prod), API Key (dev fallback) | Sepay docs recommend HMAC |
| Idempotency | UNIQUE constraint + ON CONFLICT DO NOTHING | Sepay docs khuyến nghị |
| Amount policy | EXACT MATCH | An toàn nhất (xem payment-rules.md) |
| DB transaction | Begin → insert log → update payment → update order → insert history → Commit | Atomic guarantee |
| Polling vs SSE | Polling 5s | Đơn giản, không cần queue/serverless issue |
| Recon | Manual trigger admin endpoint phase 1, scheduled phase 2 | Phase 2 khi cần |

## Sequence diagrams

Tóm tắt. Đầy đủ ở `docs/sepay-architecture.md` mục 6.

### Happy path

```text
Customer → OrderForm → POST /api/orders (201, includes paymentInfo)
Customer → app ngân hàng → Quét QR → CK nội dung "LC-XXXXXX"
Bank → Sepay nhận → Sepay POST /api/webhooks/sepay
Backend:
  - Read raw body
  - Verify HMAC signature
  - Validate payload (Zod-style inline)
  - Verify transferType='in'
  - Verify accountNumber == SEPAY_BANK_ACCOUNT
  - Extract order code via regex
  - getOrderByCode(code)
  - Verify amount == order.total_amount
  - BEGIN transaction
    - INSERT sepay_webhook_logs (ON CONFLICT DO NOTHING)
    - if conflict → COMMIT, return success (duplicate)
    - UPDATE payments SET status='paid', sepay_*
    - UPDATE orders SET status='paid', paid_at=NOW()
    - INSERT order_status_history (actor='sepay')
  - COMMIT
  - Return 200 {"success": true}
Frontend (poll mỗi 5s):
  - GET /api/payments/LC-XXXXXX/status
  - {paymentStatus: 'paid', orderStatus: 'paid'}
  - setPaid(true) → render success UI
```

## State machine (chi tiết)

### Order status

```text
   createOrder()           Webhook verified        Admin manual
        │                        │                       │
        ▼                        ▼                       ▼
 pending_payment ────> paid ──> preparing ──> shipping ──> delivered
        │                  │                                           
        │ Admin             │ Admin refund                              
        ▼                  ▼                                           
     cancelled         refunded                                        
```

### Payment status

```text
createPayment (status=pending)
        │
        │ webhook verified + DB transaction
        ▼
      paid ◄────── (không rollback)
        │
        │ admin refund (manual PATCH, future)
        ▼
     refunded
        │
        │ failed case (amount mismatch / order_not_found)
        ▼
     failed (separate row, không ảnh hưởng active payment)
```

### Status mapping

```text
order.status       payment.status
─────────────────────────────────────
pending_payment    pending
paid               paid
preparing          paid (KHÔNG đổi)
shipping           paid
delivered          paid
cancelled          (no payment hoặc cancelled)
refunded           refunded
```

## Database schema (2 bảng mới)

```sql
-- payments (1 record per active order)
CREATE TABLE payments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  provider text NOT NULL DEFAULT 'sepay',
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'VND',
  status text NOT NULL DEFAULT 'pending',  -- pending|paid|refunded|failed
  sepay_transaction_id bigint,             -- ID do SePay cấp (UNIQUE)
  sepay_gateway text,
  sepay_account_number text,
  sepay_content text,
  sepay_reference_code text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX payments_sepay_transaction_id_unique ON payments(sepay_transaction_id);
CREATE UNIQUE INDEX payments_order_id_active_unique ON payments(order_id)
  WHERE status <> 'failed';
CREATE INDEX payments_order_id_idx ON payments(order_id);

-- sepay_webhook_logs (MỌI webhook attempt)
CREATE TABLE sepay_webhook_logs (
  id uuid PRIMARY KEY,
  transaction_id bigint NOT NULL UNIQUE,   -- SePay ID, idempotency key
  raw_payload jsonb NOT NULL,
  action text NOT NULL,                    -- payment_confirmed|duplicate|amount_mismatch|...
  order_id uuid REFERENCES orders(id),
  order_code text,                         -- denormalized
  error_message text,
  success text NOT NULL DEFAULT 'false',
  processed_at timestamp with time zone DEFAULT now()
);
CREATE INDEX sepay_webhook_logs_order_id_idx ON sepay_webhook_logs(order_id);
CREATE INDEX sepay_webhook_logs_processed_at_idx ON sepay_webhook_logs(processed_at);
```

## API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/orders` | — | Tạo đơn (mới: trả `paymentInfo` với QR URL) |
| GET | `/api/orders/[code]?phone=XXXX` | phone verification | Tra cứu (mới: trả `payment` object) |
| POST | `/api/webhooks/sepay` | API Key / HMAC | Webhook endpoint (Sepay gọi) |
| GET | `/api/payments/[code]/status` | — | Polling cho frontend |
| GET | `/api/admin/orders` | JWT cookie | Danh sách đơn |
| GET | `/api/admin/orders/[id]` | JWT cookie | Chi tiết (mới: payment panel + webhook logs) |

## Security model layers

1. **Authentication**: API Key hoặc HMAC-SHA256 (chọn qua env)
2. **IP allowlist**: ở firewall (Sepay docs khuyến nghị, nhưng KHÔNG enforce trong code)
3. **HTTPS**: BẮT BUỘC (Sepay docs)
4. **Timestamp anti-replay**: ≤ 300s drift
5. **Payload validation**: Zod-style inline, mọi field check
6. **DB constraints**: UNIQUE(sepay_transaction_id) + UNIQUE(order_id) WHERE active
7. **DB transaction**: Mọi payment confirmation atomic
8. **No secret in logs**: Chỉ log prefix cuối + masked error

## Failure handling matrix

| Lỗi | Status | Logged? | Side effect | Retry? |
|---|---|---|---|---|
| Auth fail (401) | 401 | ✓ | — | Sepay retries |
| Invalid JSON (400) | 400 | ✓ | — | Sepay retries |
| Payload invalid | 200 {"success":true} | ✓ invalid_payload | — | Sepay ko retry |
| Order not found | 200 {"success":true} | ✓ order_not_found | — | Sepay ko retry |
| Amount mismatch | 200 {"success":true} | ✓ amount_mismatch | — | Sepay ko retry |
| Wrong account | 200 {"success":true} | ✓ wrong_account | — | Sepay ko retry |
| transferType=out | 200 {"success":true} | ✓ wrong_transfer_type | — | Sepay ko retry |
| Duplicate | 200 {"success":true} | ✓ duplicate | no-op | Sepay ko retry |
| DB error | 500 | ✓ | — | Sepay retries |

**Pattern**: đã authenticated + valid payload → 200 success dù kết quả xử lý business là gì. Chỉ technical error (auth, JSON, DB) mới trả 4xx/5xx.

## Khi nào KHÔNG retry webhook

Sepay retry 7 lần (theo report cũ; chưa verify chính xác từ docs). Vì thế cần trả 200 cho mọi case không phải technical error.

Nếu trả 500 → Sepay retry → DB sẽ có nhiều attempts. May ra nhờ UNIQUE constraint nên không duplicate, nhưng sẽ có nhiều log entries.
