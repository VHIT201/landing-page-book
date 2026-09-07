# SEPAY-DEV-GUIDE — Hướng dẫn kỹ thuật tích hợp SePay (cho Developer)

> **Đối tượng đọc:** Developer cần hiểu code, tự implement, hoặc customize SePay module.
> **Điều kiện tiên quyết:** đã đọc [`docs/SEPAY-SETUP.md`](./SEPAY-SETUP.md) (file giới thiệu + dashboard setup).
> **Tech stack mẫu:** Next.js 14 (App Router), Drizzle ORM, PostgreSQL (Neon). Logic áp dụng được cho mọi framework khác.
> **Cập nhật lần cuối:** 2026-09-04

---

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Cấu trúc source code](#2-cấu-trúc-source-code)
3. [Database schema](#3-database-schema)
4. [Flow xử lý webhook (7 bước)](#4-flow-xử-lý-webhook-7-bước)
5. [API endpoints](#5-api-endpoints)
6. [Authentication: API Key vs HMAC-SHA256](#6-authentication-api-key-vs-hmac-sha256)
7. [Order code matching](#7-order-code-matching)
8. [Idempotency & atomicity](#8-idempotency--atomicity)
9. [Checklist khi tự implement](#9-checklist-khi-tự-implement)
10. [Vấn đề thường gặp + cách debug](#10-vấn-đề-thường-gặp--cách-debug)
11. [Test tự động + test thủ công](#11-test-tự-động--test-thủ-công)
12. [Hướng phát triển / mở rộng](#12-hướng-phát-triển--mở-rộng)

---

## 1. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                │
│   ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│   │ OrderForm       │    │ Polling (5s)     │    │ /don-hang/    │ │
│   │ (POST /api/     │    │ GET /api/        │    │ [code] page   │ │
│   │  orders)        │    │ payments/[code]/ │    │               │ │
│   │                 │    │ status           │    │               │ │
│   └────────┬────────┘    └────────┬─────────┘    └───────────────┘ │
└────────────┼─────────────────────┼──────────────────────────────────┘
             │                     │
             ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            NEXT.JS API                               │
│   ┌─────────────────────┐          ┌──────────────────────────────┐ │
│   │ POST /api/orders    │          │ POST /api/webhooks/sepay     │ │
│   │                     │          │ (entry duy nhất Sepay gọi)    │ │
│   │ 1. Validate         │          │                              │ │
│   │ 2. createOrder()    │          │ 1. Read raw body             │ │
│   │    (atomic tx)      │          │ 2. verifySepayRequest()      │ │
│   │ 3. buildVietQrUrl() │          │ 3. parse JSON                │ │
│   │ 4. Return 201       │          │ 4. processSepayWebhook()     │ │
│   └─────────┬───────────┘          └──────────┬───────────────────┘ │
│             │                                  │                     │
└─────────────┼──────────────────────────────────┼─────────────────────┘
              │                                  │
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          LIB/SEPAY MODULE                            │
│                                                                      │
│   config.ts ──┐                                                      │
│   auth.ts ────┤                                                      │
│   matcher.ts ─┤──► webhook.ts (orchestrator) ──► orders.ts (DB)      │
│   vietqr.ts ──┘                                                      │
│   types.ts ───                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL (Neon)                            │
│   orders · payments · order_status_history · sepay_webhook_logs     │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ webhook
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                         SEPAY + NGÂN HÀNG                            │
│   Khi có tiền vào TK → SePay POST → /api/webhooks/sepay             │
└─────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc thiết kế:**
- **Single entry point:** Sepay chỉ gọi 1 endpoint duy nhất: `POST /api/webhooks/sepay`
- **Server-only module:** `lib/sepay/*` KHÔNG import được từ `"use client"` components
- **Atomic transactions:** Mọi DB mutation (insert log + update payment + update order) trong CÙNG transaction
- **Idempotent:** Duplicate webhook = no-op, không double-paid

---

## 2. Cấu trúc source code

```
lib/
├── sepay/
│   ├── index.ts          # Public exports (barrel)
│   ├── types.ts          # TypeScript types cho payload + headers + actions
│   ├── config.ts         # Env loader + validator (loadSepayConfig)
│   ├── auth.ts           # verifyApiKey, verifyHmacSha256, signHmacSha256
│   ├── matcher.ts        # extractOrderCode, checkAmount, regex
│   ├── vietqr.ts         # buildVietQrUrl, buildPaymentInstructions
│   ├── webhook.ts        # processSepayWebhook (orchestrator)
│   └── __tests__/
│       └── matcher.test.mjs
│
├── orders.ts             # createOrder, getOrderByCode, getPaymentStatusForOrder, ...
└── db/
    ├── index.ts          # Drizzle client
    └── schema.ts         # orders, payments, order_status_history, sepay_webhook_logs

app/
├── api/
│   ├── orders/
│   │   ├── route.ts                # POST /api/orders (frontend tạo đơn)
│   │   └── [code]/
│   │       └── route.ts            # GET /api/orders/[code]
│   ├── payments/
│   │   └── [code]/
│   │       └── status/
│   │           └── route.ts        # GET /api/payments/[code]/status (polling)
│   └── webhooks/
│       └── sepay/
│           └── route.ts            # POST /api/webhooks/sepay (entry duy nhất Sepay gọi)
│
├── admin/
│   └── orders/
│       └── [code]/
│           └── page.tsx            # Admin xem chi tiết đơn + logs
│
└── don-hang/
    └── [code]/
        └── page.tsx                # User-facing order detail
```

### Vai trò từng file

| File | Vai trò | Public API |
|------|---------|-----------|
| `lib/sepay/config.ts` | Đọc + validate env | `loadSepayConfig()`, `requireSepayConfig()`, `getBankInfo()` |
| `lib/sepay/auth.ts` | Verify API Key / HMAC | `verifyApiKey()`, `verifyHmacSha256()`, `signHmacSha256()`, `verifySepayRequest()` |
| `lib/sepay/matcher.ts` | Extract order code + check amount | `extractOrderCode()`, `extractAllOrderCodes()`, `checkAmount()`, `matchOrderCodeFromContent()`, `isValidOrderCodeFormat()` |
| `lib/sepay/vietqr.ts` | Build QR URL | `buildVietQrUrl()`, `buildPaymentInstructions()` |
| `lib/sepay/webhook.ts` | Orchestrator (validate → match → atomic update) | `processSepayWebhook()` |
| `lib/sepay/types.ts` | Types | `SepayWebhookPayload`, `SepayWebhookHeaders`, `SepayAction`, ... |
| `lib/sepay/index.ts` | Barrel export | `export * from ...` |
| `app/api/webhooks/sepay/route.ts` | HTTP handler | `POST()` |
| `lib/orders.ts` | DB queries | `createOrder()`, `getOrderByCode()`, `getPaymentStatusForOrder()`, ... |

---

## 3. Database schema

### 3.1. Bảng `orders`

```typescript
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),              // LC-A1B2C3
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),

  // Địa chỉ hành chính VN
  provinceCode: text("province_code"),
  provinceName: text("province_name"),
  districtCode: text("district_code"),
  districtName: text("district_name"),
  wardCode: text("ward_code"),
  wardName: text("ward_name"),
  addressDetail: text("address_detail"),
  addressLine: text("address_line").notNull(),         // Ghép sẵn để hiển thị

  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),          // Chốt ở server
  shippingFee: integer("shipping_fee").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),

  status: text("status").notNull().$type<OrderStatus>().default("pending_payment"),
  // enum: pending_payment | paid | preparing | shipping | delivered | cancelled | refunded
  paidAt: timestamp("paid_at", { withTimezone: true }),

  // Vận chuyển (admin tự điền)
  carrier: text("carrier"),
  trackingNo: text("tracking_no"),

  adminNote: text("admin_note"),
  source: text("source"),                              // utm / ref
});
```

### 3.2. Bảng `payments`

```typescript
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),

  provider: text("provider").notNull().$type<PaymentProvider>().default("sepay"),
  // enum: sepay (mở rộng sau nếu có provider khác)
  amount: integer("amount").notNull(),                // expected amount = order.total_amount
  currency: text("currency").notNull().default("VND"),

  status: text("status").notNull().$type<PaymentStatus>().default("pending"),
  // enum: pending | paid | refunded | failed

  // ==== SePay specific (NULL nếu chưa có webhook) ====
  sepayTransactionId: bigint("sepay_transaction_id", { mode: "number" }),
  sepayGateway: text("sepay_gateway"),                // "MBBank", "Vietcombank", ...
  sepayAccountNumber: text("sepay_account_number"),
  sepayContent: text("sepay_content"),                // raw content từ webhook
  sepayReferenceCode: text("sepay_reference_code"),

  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  txIdUnique: uniqueIndex("payments_sepay_transaction_id_unique").on(t.sepayTransactionId),
  // ↑ Idempotency: 1 transaction_id chỉ confirm 1 lần
  orderIdActiveUnique: uniqueIndex("payments_order_id_active_unique")
    .on(t.orderId).where(sql`status <> 'failed'`),
  // ↑ Partial unique: 1 order chỉ có 1 active payment (failed được phép có nhiều)
  orderIdIdx: index("payments_order_id_idx").on(t.orderId),
}));
```

**Tại sao design như vậy:**
- **`UNIQUE(sepay_transaction_id)`:** đảm bảo 1 transaction Sepay chỉ confirm 1 order. Nếu webhook retry với cùng `id`, INSERT sẽ fail.
- **Partial UNIQUE `WHERE status <> 'failed'`:** cho phép test edge case "payment failed → retry" mà không bị conflict.
- **Không tách bảng `sepay_transactions`:** các cột SePay đã đủ trong `payments`. Tránh duplicate state.

### 3.3. Bảng `sepay_webhook_logs`

```typescript
export const sepayWebhookLogs = pgTable("sepay_webhook_logs", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  transactionId: bigint("transaction_id", { mode: "number" }).notNull(),

  rawPayload: jsonb("raw_payload").notNull(),          // Full payload từ SePay

  action: text("action").notNull(),
  // payment_confirmed | duplicate | amount_mismatch | order_not_found |
  // wrong_transfer_type | wrong_account | invalid_content | invalid_payload

  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  orderCode: text("order_code"),                       // Denormalized

  errorMessage: text("error_message"),
  success: text("success").notNull().default("false"),

  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  txIdUnique: uniqueIndex("sepay_webhook_logs_transaction_id_unique").on(t.transactionId),
  // ↑ Đây là IDEMPOTENCY KEY chính: insert ON CONFLICT DO NOTHING → biết ngay duplicate
  orderIdIdx: index("sepay_webhook_logs_order_id_idx").on(t.orderId),
  processedAtIdx: index("sepay_webhook_logs_processed_at_idx").on(t.processedAt),
}));
```

**Mục đích:**
1. **Idempotency:** `UNIQUE(transaction_id)` + `INSERT ... ON CONFLICT DO NOTHING`
2. **Audit:** Tra cứu "tại sao đơn A lại paid, đơn B lại không"
3. **Debug:** Xem raw payload khi có issue
4. **Forensics:** Phân tích lỗi, race, replay, ...

### 3.4. Bảng `order_status_history`

```typescript
export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status").$type<OrderStatus>(),
  toStatus: text("to_status").notNull().$type<OrderStatus>(),
  actor: text("actor").notNull(),                      // "system" | "admin" | "sepay"
  meta: jsonb("meta"),                                 // tx_id, gateway, reference, ...
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Lưu lại mọi lần chuyển trạng thái đơn — dùng để audit timeline.

---

## 4. Flow xử lý webhook (7 bước)

Đây là flow quan trọng nhất. Đọc kỹ.

```
1. Đọc raw body (text)            ← BẮT BUỘC trước khi parse JSON (vì HMAC)
         ↓
2. Load config + verify auth      ← Nếu fail → 401
         ↓
3. Parse JSON                     ← Nếu fail → 400
         ↓
4. Validate payload shape         ← Nếu fail → log + 200 (no retry)
         ↓
5. Extract order code từ content  ← Match `LC-XXXXXX`
         ↓
6. Find order trong DB
         ↓
7. Business rules + atomic update:
   a. transferType = "in"?
   b. accountNumber = config.bank.account?
   c. transferAmount = order.totalAmount?
   d. INSERT webhook log (UNIQUE constraint = idempotency)
   e. UPDATE payment → paid
   f. UPDATE order → paid
   g. INSERT history
   → Tất cả trong 1 transaction
```

### 4.1. Code chi tiết

**Entry point:** `app/api/webhooks/sepay/route.ts`

```typescript
export async function POST(req: Request) {
  // BƯỚC 1: Read raw body (BẮT BUỘC cho HMAC)
  const rawBody = await req.text();

  // BƯỚC 2: Authenticate
  const configResult = loadSepayConfig();
  if (!configResult.ok) { /* return 200 + disabled */ }

  const auth = verifySepayRequest(config.authMethod, headers, rawBody, apiKey, secret);
  if (!auth.ok) { return 401; }

  // BƯỚC 3: Parse JSON
  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return 400; }

  // BƯỚC 4: Defense-in-depth check
  if (payload.accountNumber !== config.bank.account) {
    return 200;  // Sai STK → no-op, trả 200 để SePay không retry
  }

  // BƯỚC 5-7: Orchestrator
  try {
    const result = await processSepayWebhook(payload);
    return 200;  // Mọi case (paid, duplicate, mismatch) → 200
  } catch (err) {
    return 500;  // DB error → SePay retry
  }
}
```

**Orchestrator:** `lib/sepay/webhook.ts`

```typescript
export async function processSepayWebhook(payload, options) {
  // BƯỚC 5: Extract order code
  const matched = matchOrderCodeFromContent(payload.content);
  if (!matched.ok) return finalize(ctx, "invalid_content", "...");

  // BƯỚC 6: Find order
  const order = await getOrderByCode(matched.orderCode);
  if (!order) return finalize(ctx, "order_not_found", "...");

  // BƯỚC 7: Business rules
  if (payload.transferType !== "in") {
    return finalize(ctx, "wrong_transfer_type", "...");
  }
  const amountCheck = checkAmount(order.totalAmount, payload.transferAmount);
  if (!amountCheck.ok) {
    return finalize(ctx, "amount_mismatch", "...");
  }

  // BƯỚC 8: Atomic DB update (transaction)
  const txResult = await db.transaction(async (tx) => {
    // 8a. INSERT webhook log (idempotency)
    const [insertedLog] = await tx.insert(sepayWebhookLogs).values({...})
      .onConflictDoNothing({ target: sepayWebhookLogs.transactionId })
      .returning();

    if (!insertedLog) {
      return null;  // Duplicate webhook → no-op
    }

    // 8b. UPDATE payment
    await tx.update(payments).set({ status: "paid", ... })
      .where(eq(payments.orderId, order.id));

    // 8c. UPDATE order
    await tx.update(orders).set({ status: "paid", paidAt: ... })
      .where(eq(orders.id, order.id));

    // 8d. INSERT history
    await tx.insert(orderStatusHistory).values({...});

    return { payment, order };
  });

  if (!txResult) return finalize(ctx, "duplicate", "already_processed");
  return { action: "payment_confirmed", ... };
}
```

### 4.2. Sepay Action values

| Action | Khi nào | HTTP response | Log level |
|--------|---------|---------------|-----------|
| `payment_confirmed` | Match order + đủ điều kiện → paid | 200 | info |
| `duplicate` | Webhook gọi lại cùng `transaction_id` | 200 | info |
| `amount_mismatch` | Khách CK sai số tiền | 200 | warn |
| `order_not_found` | Content có mã `LC-XXX` nhưng không có order | 200 | warn |
| `wrong_transfer_type` | `transferType` khác `"in"` | 200 | warn |
| `wrong_account` | `accountNumber` không khớp STK | 200 | warn |
| `invalid_content` | Content không chứa order code | 200 | warn |
| `invalid_payload` | JSON thiếu field | 200 | warn |
| (DB exception) | Bất kỳ lỗi DB | **500** | error |

**Tại sao action fail vẫn trả 200?** Vì Sepay hiểu "request đã được xử lý, không cần retry". Chỉ trả 500 khi lỗi **server** (DB exception, ...).

---

## 5. API endpoints

| Method | URL | Vai trò | Auth |
|--------|-----|---------|------|
| `POST` | `/api/orders` | Frontend tạo order → trả QR info | Public |
| `GET` | `/api/orders/[code]` | Chi tiết order (full) | Public (chỉ data của order đó) |
| `GET` | `/api/payments/[code]/status` | Frontend polling 5s | Public (chỉ status) |
| `POST` | `/api/webhooks/sepay` | **Entry duy nhất SePay gọi** | HMAC / API Key |

### 5.1. `POST /api/orders`

Request:
```json
{
  "name": "Nguyen Van A",
  "phone": "0987654321",
  "quantity": 1,
  "province": { "code": "01", "name": "Ha Noi" },
  "district": { "code": "001", "name": "Ba Dinh" },
  "ward":     { "code": "00001", "name": "Phuc Xa" },
  "addressDetail": "123 Test"
}
```

Response 201:
```json
{
  "code": "LC-AB23CD",
  "quantity": 1,
  "unitPrice": 198000,
  "shippingFee": 0,
  "totalAmount": 198000,
  "status": "pending_payment",
  "paymentInfo": {
    "bankCode": "MBBank",
    "bankAccount": "0903252427",
    "bankAccountName": "NGUYEN VAN A",
    "content": "LC-AB23CD",
    "amount": 198000,
    "qrUrl": "https://vietqr.app/img?bank=MBBank&acc=0903252427&amount=198000&des=LC-AB23CD&template=compact"
  }
}
```

**Quan trọng:** `paymentInfo` chỉ trả về khi `SEPAY_ENABLED=true` + đủ env.

### 5.2. `GET /api/payments/[code]/status`

Response 200:
```json
{
  "code": "LC-AB23CD",
  "orderStatus": "paid",         // pending_payment | paid | preparing | ...
  "paymentStatus": "paid",        // pending | paid | refunded | failed
  "amount": 198000,
  "provider": "sepay",
  "paidAt": "2026-09-04T10:30:00Z"
}
```

Response 404: `{ "error": "order_not_found" }`

**Design:** Public (không cần auth) vì chỉ trả status, không chứa data nhạy cảm. Frontend polling 5s là đủ nhẹ.

### 5.3. `POST /api/webhooks/sepay`

**Đây là endpoint duy nhất SePay gọi.** Cấu hình URL này trên dashboard SePay.

Response format (Sepay yêu cầu):
- `200 + {"success": true}` = success (kể cả mismatch, duplicate, ...)
- `4xx/5xx` = fail, SePay sẽ retry

→ Xem chi tiết flow ở [mục 4](#4-flow-xử-lý-webhook-7-bước).

---

## 6. Authentication: API Key vs HMAC-SHA256

### 6.1. So sánh

| | API Key | HMAC-SHA256 |
|--|---------|-------------|
| **Header** | `Authorization: Apikey <KEY>` | `X-SePay-Signature: sha256=<hex>`, `X-SePay-Timestamp: <unix>` |
| **Compute** | Không — chỉ compare | `HMAC-SHA256(secret, "{timestamp}.{rawBody}")` |
| **Replay protection** | ❌ Không | ✅ Timestamp drift check (5 phút) |
| **An toàn hơn** | Ít | ✅ Nhiều hơn (chống replay) |
| **Độ phức tạp** | ⭐ | ⭐⭐⭐ |
| **Khuyến nghị** | ❌ | ✅ **Luôn dùng HMAC-SHA256** |

### 6.2. HMAC-SHA256 — chi tiết

**SePay ký:**
```
msg = "{timestamp}.{raw_body}"
sig = HMAC-SHA256(secret, msg)
header: X-SePay-Signature: sha256=<sig>
header: X-SePay-Timestamp: <unix_seconds>
```

**Server verify:**
1. Đọc `timestamp` → check drift ≤ 300s (5 phút) — chống replay attack
2. Đọc raw body (CHƯA parse JSON)
3. Tính `expected = HMAC-SHA256(secret, "{timestamp}.{rawBody}")`
4. **Timing-safe compare** (`===` KHÔNG an toàn vì timing attack)
5. Nếu khớp → OK

### 6.3. ⚠️ Bug phổ biến #1: Parse JSON trước khi verify HMAC

```typescript
// ❌ SAI — JSON.stringify(payload) có thể khác raw body về whitespace
const payload = await req.json();
const computed = HMAC(secret, `${ts}.${JSON.stringify(payload)}`);

// ✅ ĐÚNG — Dùng raw text
const rawBody = await req.text();
const computed = HMAC(secret, `${ts}.${rawBody}`);
const payload = JSON.parse(rawBody);
```

Trong Next.js, mặc định `req.json()` parse trước → mất raw body. **Luôn `await req.text()` trước.**

### 6.4. ⚠️ Bug phổ biến #2: So sánh HMAC bằng `===`

```typescript
// ❌ SAI — timing attack có thể dò từng ký tự
if (computed === sigHeader) { ... }

// ✅ ĐÚNG — constant-time compare
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
```

Xem code đầy đủ trong `lib/sepay/auth.ts`.

---

## 7. Order code matching

### 7.1. Pattern

Order code có dạng `LC-XXXXXX` với alphabet **không chứa ký tự dễ nhầm**:

```
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
// Bỏ: I, O, 0, 1
```

**Tại sao:** `O`/`0`, `I`/`1` dễ nhầm khi khách CK nhập tay → alphabet giảm còn 32 ký tự (≈ 1 tỷ codes).

### 7.2. Regex

```typescript
export const ORDER_CODE_REGEX = new RegExp(
  String.raw`(?:^|[^A-Z0-9])(LC-[${CODE_ALPHABET}]{6})(?:[^A-Z0-9]|$)`,
  "i",
);
```

**Match đúng:**
- `LC-AB23CD` ✅
- `LC-AB23CD thanh toan` ✅
- `Thanh toan LC-AB23CD` ✅
- `nopLC-AB23CDx` ❌ (boundary fail)

**Bắt buộc có boundary** (`^` hoặc non-alphanumeric trước/sau) — nếu không thì `LC-AAAAAA` match trong `xLC-AAAAAA` không mong muốn.

### 7.3. ⚠️ Bug phổ biện #3: `content.includes(code)`

```typescript
// ❌ SAI — match sai nếu code xuất hiện như substring
const match = payload.content.includes(order.code);

// ✅ ĐÚNG — dùng regex có boundary
const match = ORDER_CODE_REGEX.test(payload.content);
```

**Ví dụ vấn đề:**
- Order code = `LC-AB12CD`
- Content = `XLCC-AB12CDXYZ` (khách gõ nhầm)
- `includes()` → match → nhầm đơn
- Regex với boundary → không match

### 7.4. Unit test

```javascript
// lib/sepay/__tests__/matcher.test.mjs
import { extractOrderCode } from "../matcher.ts";

assert(extractOrderCode("LC-AB23CD") === "LC-AB23CD");
assert(extractOrderCode("Thanh toan LC-AB23CD cho toi") === "LC-AB23CD");
assert(extractOrderCode("XLCC-AB23CD") === null);  // boundary fail
assert(extractOrderCode("LC-I0O1I0") === null);    // alphabet fail
assert(extractOrderCode(null) === null);
```

---

## 8. Idempotency & atomicity

### 8.1. Vấn đề

SePay **retry** webhook nếu không nhận `200 + {"success":true}` trong **30 giây**. Có 3 case cần handle:

1. **Network glitch:** Server nhận được, xử lý OK, response timeout → SePay retry
2. **Server crash:** Xử lý xong nhưng crash trước khi response → SePay retry
3. **Test thủ công:** Developer bấm "Gửi thử" 2 lần liên tiếp

→ **Không có idempotency = double-paid.**

### 8.2. Cách implement

**Idempotency key:** `transaction_id` (số nguyên do SePay cấp, unique toàn hệ thống).

**Bước thực hiện:**

```sql
-- Schema đã có UNIQUE
CREATE UNIQUE INDEX sepay_webhook_logs_transaction_id_unique
  ON sepay_webhook_logs (transaction_id);
```

```typescript
// Trong transaction:
const [insertedLog] = await tx.insert(sepayWebhookLogs).values({
  transactionId: payload.id,
  // ...
})
.onConflictDoNothing({ target: sepayWebhookLogs.transactionId })
.returning();

if (!insertedLog) {
  // Conflict → đã xử lý rồi (webhook trước đó thành công)
  return null;  // no-op
}

// Tiếp tục update payment + order + history...
```

### 8.3. Tại sao atomic transaction quan trọng

Nếu KHÔNG dùng transaction, có thể xảy ra:

```
T1: INSERT webhook log (success)
T2: UPDATE payment → paid (success)
T3: UPDATE order → paid  ← CRASH ở đây (DB timeout)
→ Lần retry: webhook log đã có → skip → KHÔNG update order → INCONSISTENT
```

Với transaction:

```
T1: BEGIN
T2: INSERT webhook log
T3: UPDATE payment
T4: UPDATE order
T5: INSERT history
T6: COMMIT ← nếu bất kỳ step nào fail → ROLLBACK
→ Lần retry: webhook log chưa có → xử lý lại từ đầu → CONSISTENT
```

### 8.4. Test idempotency

```bash
# Gửi cùng webhook 2 lần (cùng transaction_id)
curl -X POST .../api/webhooks/sepay -d '{... id: 555, ...}'  # Lần 1
curl -X POST .../api/webhooks/sepay -d '{... id: 555, ...}'  # Lần 2 (dup)

# Verify:
# - Log table có 1 row (inserted lần 1, conflict lần 2)
# - Payment: paid 1 lần (không bị paid 2 lần)
# - Order: paid 1 lần
```

Đã verify bằng 5 concurrent requests trong test thực tế: chỉ **1** request thực sự update DB, 4 còn lại return `duplicate`.

---

## 9. Checklist khi tự implement

Khi copy module `lib/sepay/` sang dự án mới:

```
□ 1. Copy lib/sepay/ (index, types, config, auth, matcher, vietqr, webhook)
□ 2. Copy schema payments + sepay_webhook_logs (xem mục 3)
□ 3. Copy routes:
     □ app/api/webhooks/sepay/route.ts
     □ app/api/payments/[code]/status/route.ts
□ 4. Copy env vars vào .env.example:
     □ SEPAY_ENABLED, SEPAY_BANK_CODE, SEPAY_BANK_ACCOUNT, SEPAY_BANK_ACCOUNT_NAME
     □ SEPAY_AUTH_METHOD, SEPAY_WEBHOOK_SECRET (hoặc SEPAY_API_KEY)
□ 5. Sửa CODE_ALPHABET trong matcher.ts cho khớp với code generator của bạn
     (mặc định alphabet 32 ký tự, suffix 6)
□ 6. Sửa UNIT_PRICE / SHIPPING_FLAT trong orders.ts
□ 7. Sửa logic tạo order code trong lib/orders.ts (genCode())
     - PHẢI cùng alphabet với matcher.ts!
□ 8. Sửa amountCheck policy trong matcher.ts:
     - checkAmount() hiện tại = EXACT MATCH
     - Nếu muốn ALLOW_OVERPAY (cho tip, ...): sửa lại
□ 9. Setup tunnel (local dev): Cloudflare Tunnel (xem SEPAY-SETUP.md mục 4)
□ 10. Tạo webhook trên dashboard SePay → paste URL tunnel + chọn HMAC-SHA256
□ 11. Test:
     □ "Gửi thử" trên dashboard → log [SEPAY_PROCESSED]
     □ CK thật 1đ với nội dung LC-XXX → paid
     □ Idempotency: gửi cùng webhook 2 lần → chỉ paid 1 lần
     □ Edge cases: sai tiền, wrong account, invalid content
```

---

## 10. Vấn đề thường gặp + cách debug

### 10.1. Lỗi `relation "payments" does not exist`

**Nguyên nhân:** Chưa chạy migration.

```bash
# Drizzle Kit
npx drizzle-kit generate
npx drizzle-kit push --force
```

### 10.2. Webhook 401 với HMAC "đúng"

**Debug:**
1. In `rawBody` (console.log) → so sánh với body SePay gửi
2. In `timestamp` từ header → đảm bảo cùng giá trị dùng trong HMAC
3. In `secret` từ env → đảm bảo không có whitespace/newline
4. Test HMAC bằng Node:
   ```javascript
   const c = require("node:crypto");
   const sig = c.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
   console.log(sig);
   ```

### 10.3. `[SEPAY_AUTH_FAILED] timestamp_out_of_range`

**Nguyên nhân:** Server clock lệch Sepay clock > 5 phút.

```bash
# Windows
w32tm /resync

# Linux
sudo ntpdate -s time.nist.gov
```

### 10.4. Đơn KHÔNG paid dù webhook 200

**Debug:**
1. Xem log `[SEPAY_PROCESSED]` → `action` là gì?
   - `amount_mismatch` → khách CK sai tiền
   - `order_not_found` → order code không match
   - `wrong_account` → STK không khớp
   - `duplicate` → đã xử lý trước đó (OK)
   - `invalid_content` → content không có `LC-XXX`
2. Check admin page: `/admin/orders/[code]` → tab Webhook logs
3. Nếu `payment_confirmed` nhưng DB không update → check DB connection / transaction log

### 10.5. Frontend polling không cập nhật

**Debug:**
1. Mở DevTools → Network tab → filter `/api/payments/`
2. Xem response status + body
3. Nếu 404 → order code sai
4. Nếu 200 nhưng status vẫn `pending` → check DB
5. Hard refresh (Ctrl+Shift+R)

### 10.6. Race condition khi test 5+ concurrent webhooks

**Kết quả mong đợi:** Chỉ **1** webhook thực sự update DB, các webhook còn lại return `duplicate` (do UNIQUE constraint).

**Nếu thấy nhiều payment update → bug:**
- Không dùng transaction
- Không dùng `onConflictDoNothing`
- Check `payments_sepay_transaction_id_unique` đã có

---

## 11. Test tự động + test thủ công

### 11.1. Test tự động (Node)

Trong dự án này có 2 file:

- `test-sepay-e2e.mjs` — E2E happy path + edge cases (18 test cases)
- `test-race-condition.mjs` — Stress test 5+ concurrent webhooks (verify idempotency)

```bash
node test-sepay-e2e.mjs
node test-race-condition.mjs
```

### 11.2. Test matcher (unit test)

```bash
node lib/sepay/__tests__/matcher.test.mjs
```

### 11.3. Test thủ công (PowerShell)

Dự án có sẵn `sepay-helper.mjs` (Node) + `test.ps1` (wrapper):

```powershell
cd C:\path\to\project
.\test.ps1 create         # Tạo order
.\test.ps1 webhook-ok     # Webhook đúng → paid
.\test.ps1 wrong-amount   # Sai tiền → no-op
.\test.ps1 duplicate      # Trùng tx_id → idempotent
.\test.ps1 auth-fail      # HMAC sai → 401
```

**⚠️ Lưu ý:** KHÔNG tính HMAC trong PowerShell (quote-escape làm hỏng secret). Luôn dùng Node helper.

Chi tiết: xem `docs/huong-dan-test-thu-cong.md` (file cũ đã tham chiếu).

### 11.4. Test bằng app ngân hàng thật

```
1. Mở URL production (KHÔNG dùng localhost)
2. Đặt đơn → có mã QR
3. App ngân hàng → CK đúng số tiền + nội dung
4. Đợi 5-10s → đơn tự động paid
```

---

## 12. Hướng phát triển / mở rộng

### 12.1. Support thêm payment provider (MoMo, ZaloPay, ...)

Hiện tại `provider` enum chỉ có `"sepay"`. Để thêm:

1. Tạo `lib/momo/` (mirror `lib/sepay/` structure)
2. Update schema `payments.provider` enum
3. Update `lib/orders.ts` để chọn provider
4. Tạo webhook handler riêng: `app/api/webhooks/momo/route.ts`

### 12.2. Allow overpay (tip, donation)

Hiện `checkAmount()` = EXACT MATCH. Sửa:

```typescript
export function checkAmount(expected, actual) {
  if (actual === expected) return { ok: true, reason: "exact_match", ... };
  if (actual > expected) {
    // Cho phép trả thừa (tip)
    return { ok: true, reason: "overpaid", expected, actual };
  }
  return { ok: false, reason: "amount_too_low", expected, actual };
}
```

Cần update logic xử lý trong `processSepayWebhook()` tương ứng.

### 12.3. Refund flow

Hiện `PAYMENT_STATUSES` có `"refunded"` nhưng chưa có logic. Cần:

1. Endpoint admin: `POST /api/admin/orders/[code]/refund`
2. Logic SePay refund (nếu có API) hoặc manual
3. Update payment → refunded, order → refunded
4. Insert history

### 12.4. Webhook từ NHIỀU ngân hàng

Hiện `SEPAY_BANK_ACCOUNT` = 1 STK. Nếu muốn nhận từ nhiều STK:

1. Sửa schema: `banks` table riêng, FK từ `payments`
2. Sửa webhook handler để match theo `accountNumber` từ payload
3. Update env: `SEPAY_BANK_ACCOUNTS=STK1,STK2,STK3`

### 12.5. Real-time notification (Pusher, Socket.io)

Thay vì frontend polling 5s, push từ server:

1. Khi webhook success → emit event qua Pusher/Socket.io
2. Frontend subscribe → update UI ngay lập tức
3. Vẫn giữ polling 5s làm fallback

---

## Tóm tắt 1 phút (cho Dev)

```
1. SePay = Webhook ngân hàng VN, free %, tiền vào TK bạn
2. Module lib/sepay/ : config + auth + matcher + vietqr + webhook (orchestrator)
3. Schema: orders + payments (UNIQUE sepay_transaction_id) + sepay_webhook_logs (idempotency key)
4. Flow webhook: rawBody → auth → parse → match order → business rules → atomic transaction
5. Idempotency: UNIQUE(transaction_id) + onConflictDoNothing + atomic transaction
6. Order code: alphabet 32 ký tự, regex có boundary (KHÔNG dùng includes)
7. Auth: HMAC-SHA256 (đọc rawBody trước khi parse JSON, dùng timing-safe compare)
8. Response format: 200 + {success:true} cho MỌI case trừ DB exception (500)
9. Test: 18 E2E cases + 5 concurrent race condition test (đã verify idempotency)
10. Local dev: Cloudflare Tunnel → webhook URL trên dashboard → test CK thật
```

**Câu hỏi về code / implementation?** → Mở issue trong repo hoặc hỏi team lead.
**Câu hỏi về dashboard / business?** → Đọc [`docs/SEPAY-SETUP.md`](./SEPAY-SETUP.md).
