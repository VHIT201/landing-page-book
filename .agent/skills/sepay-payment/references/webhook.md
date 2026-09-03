# Webhook Lifecycle — Chi tiết

## Flow tổng quan

```text
Customer CK → Bank push txn → SePay nhận → Webhook POST → Backend → Response
                                                  │
                                                  ↓
                                            Auth (HMAC/API Key)
                                                  │
                                                  ▼
                                            Read raw body
                                                  │
                                                  ▼
                                            Validate payload
                                                  │
                                                  ▼
                                            Business rules
                                                  │
                                                  ▼
                                            DB transaction
                                                  │
                                                  ▼
                                            200 {"success": true}
```

## Auth (chi tiết)

### API Key
```http
POST /api/webhooks/sepay
Authorization: Apikey YOUR_KEY
Content-Type: application/json

{"id": 92704, "gateway": "Vietcombank", ...}
```

Backend: `verifyApiKey(headers.authorization, env.SEPAY_API_KEY)`.

### HMAC-SHA256 (khuyến nghị production)
```http
POST /api/webhooks/sepay
X-SePay-Signature: sha256=<hex_hash>
X-SePay-Timestamp: <unix_seconds>
Content-Type: application/json

{"id": 92704, ...}
```

Tính: `HMAC-SHA256(SECRET, "{timestamp}.{rawBody}")`. Format hex lowercase.
Ví dụ:
```ts
const sig = createHmac('sha256', SECRET)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');
// Header: `X-SePay-Signature: sha256=${sig}`
```

**Quan trọng**: phải dùng RAW body bytes, KHÔNG `JSON.parse()` rồi stringify lại.

Sepay docs lưu ý:
> Middleware parses then re-serializes the body → signature mismatch.
> "If middleware (express.json(), Fastify default, ...) parsed the body and you JSON.stringify(req.body) it back, the signature won't match because:
> - PHP escapes Unicode to \uXXXX, JavaScript doesn't
> - JSON key order can change
> - Whitespace can differ"

→ Đọc raw body bằng `req.text()` TRƯỚC khi parse JSON.

### Timestamp tolerance

```ts
const drift = Math.abs(nowSec - tsSec);
if (drift > 300) return reject;  // 5 phút
```

Nếu NTP drift → chỉnh server time hoặc tăng maxDriftSec (không khuyến nghị).

## Payload structure (12 fields)

```json
{
  "id": 92704,                       // INTEGER, dedup key
  "gateway": "Vietcombank",          // STRING, bank name
  "transactionDate": "2024-07-02 11:08:33",  // STRING, format YYYY-MM-DD HH:mm:ss VN time
  "accountNumber": "1017588888",     // STRING, STK nhận
  "subAccount": "",                  // STRING|null, VA match
  "code": "SEVN63DC8E5C",            // STRING|null, extracted code (NULL nếu không match template)
  "content": "SEVN63DC8E5C chuyen tien",  // STRING, raw memo
  "transferType": "in",              // "in" | "out"
  "description": "NGUYEN VAN A chuyen tien",  // STRING|null
  "transferAmount": 5000000,         // INTEGER VND, LUÔN DƯƠNG
  "accumulated": 105000000,          // INTEGER|null, balance sau GD
  "referenceCode": "FT24012345678"   // STRING|null
}
```

**Validation quan trọng** (xem `lib/sepay/webhook.ts:validatePayload`):
- `id` phải là số nguyên dương
- `transferType` ∈ {"in", "out"}
- `transferAmount` phải > 0
- `content` không được rỗng
- `accountNumber` không được rỗng

## Response contract (CỨNG)

Sepay docs (developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook):

> "SePay only counts as success when your response has all 3:
> 1. HTTP status 200 or 201.
> 2. Body is JSON with success: true, exactly {"success": true}.
> 3. Returned within 30 seconds.
>
> Anything else counts as failure even if your server received the request:
> | Response | SePay reads as |
> | 200 or 201 + {"success": true} | Success |
> | 200 + a different body | Failure (wrong body) |
> | Status other than 200/201 | Failure |
> | No response in 30s | Timeout |"

→ Implementation PHẢI trả CHÍNH XÁC body `{"success": true}` cho case success.

## Idempotency

Cùng transaction_id có thể đến nhiều lần vì:
- Auto retry khi endpoint trả error
- Manual replay từ Sepay dashboard
- Multiple webhooks trỏ vào same endpoint

Cách xử lý: UNIQUE constraint + ON CONFLICT DO NOTHING.

```ts
const insertedLog = await tx.insert(sepayWebhookLogs).values({
  transactionId: ctx.payload.id,
  ...
}).onConflictDoNothing({ target: sepayWebhookLogs.transactionId })
  .returning();

if (insertedLog.length === 0) {
  // Duplicate — không làm gì thêm, return success
  return { action: 'duplicate', processed: false };
}
```

`payments.sepay_transaction_id` cũng UNIQUE → defense in depth.

## Database transaction (atomic)

```ts
await db.transaction(async (tx) => {
  // 1. INSERT log (dedup guard)
  const log = await tx.insert(sepayWebhookLogs).values({
    transactionId: payload.id,
    rawPayload: payload,
    action: 'payment_confirmed',
    orderId, orderCode,
    success: 'true',
  }).onConflictDoNothing(...);
  
  if (!log) return;  // duplicate
  
  // 2. UPDATE payment
  await tx.update(payments).set({
    status: 'paid',
    sepayTransactionId: payload.id,
    sepayGateway: payload.gateway,
    ...
    paidAt: now,
  }).where(eq(payments.orderId, orderId));
  
  // 3. UPDATE order
  await tx.update(orders).set({
    status: 'paid',
    paidAt: now,
    updatedAt: now,
  }).where(eq(orders.id, orderId));
  
  // 4. INSERT history
  await tx.insert(orderStatusHistory).values({
    orderId,
    fromStatus: 'pending_payment',
    toStatus: 'paid',
    actor: 'sepay',
    meta: { transactionId, gateway, referenceCode },
  });
});
```

Toàn bộ trong 1 transaction → atomic. Nếu fail → rollback toàn bộ.

## Retry schedule

Sepay retry tối đa 7 lần, fibonacci backoff (chưa verify từ docs chính thức, dựa trên report cũ). Nếu vẫn fail → Sepay dừng.

Reconciliation phase 2 sẽ bù những giao dịch miss.

## Sepay IP whitelist (defense in depth)

Cấu hình ở firewall/CDN (không trong app):

```text
172.236.138.20
172.233.83.68
171.244.35.2
151.158.108.68
151.158.109.79
103.255.238.139
2400:8905::2000:8cff:fe98:45cd (IPv6)
2600:3c15::2000:8aff:fedd:874b (IPv6)
```

Danh sách có thể cập nhật — kiểm tra https://developer.sepay.vn/en/dia-chi-ip định kỳ.
