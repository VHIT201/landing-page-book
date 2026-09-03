# Testing — SePay Payment

## Test pyramid

```text
                  E2E (manual)
                 /            \
              Integration       Manual Sanity
             /      |    \      |
        Unit (pure logic)   Component
        - matcher             - OrderForm polling
        - auth                - admin payment panel
        - config validation   - don-hang polling
```

## Unit tests (chạy được ngay)

### Pure matcher + auth

```text
node --test lib/sepay/__tests__/matcher.test.mjs
```

Đã có sẵn 18 test cases:
- extractOrderCode: valid, boundary, invalid, multi-code
- checkAmount: exact, too low, too high
- verifyApiKey: happy path, wrong key, wrong scheme, missing
- verifyHmacSha256: valid, wrong sig, expired ts, missing
- timingSafeEqual

### Thêm test cases khi sửa logic

Khi modify `lib/sepay/matcher.ts` hoặc `lib/sepay/auth.ts`:
1. Update test file với case mới
2. Chạy `node --test` để confirm
3. Nếu pass → update implementation tương ứng

## Integration tests (cần DB)

Hiện chưa có test runner cho DB. Khi cần:

### Setup

1. Dev Neon test database (khác prod)
2. Set `.env.local`:
   ```
   DATABASE_URL=postgresql://...neon.../testdb?sslmode=require
   SEPAY_ENABLED=true
   SEPAY_AUTH_METHOD=hmac_sha256
   SEPAY_WEBHOOK_SECRET=test_secret
   SEPAY_BANK_CODE=MBBank
   SEPAY_BANK_ACCOUNT=0123456789
   SEPAY_BANK_ACCOUNT_NAME=Test Account
   ```
3. `pnpm db:push` để apply schema mới (payments, sepay_webhook_logs)

### Script mẫu (chưa viết)

`scripts/test-webhook.mjs` chưa tồn tại. Khi viết:

```js
// Pseudo-code
import { processSepayWebhook } from '../lib/sepay';
import { db } from '../lib/db';

async function main() {
  // 1. Insert order + payment qua createOrder
  const order = await createOrder({...});
  
  // 2. Build valid payload
  const payload = {
    id: Math.floor(Math.random() * 1000000),
    gateway: 'Vietcombank',
    ...
    content: `${order.code} chuyen tien`,
    transferAmount: order.totalAmount,
    transferType: 'in',
    accountNumber: '0123456789',
  };
  
  // 3. Call processSepayWebhook
  const result = await processSepayWebhook(payload);
  assert(result.action === 'payment_confirmed');
  
  // 4. Verify DB state
  const updated = await getOrderByCode(order.code);
  assert(updated.status === 'paid');
  assert(updated.paidAt !== null);
  
  // 5. Test duplicate
  const dup = await processSepayWebhook(payload);
  assert(dup.action === 'duplicate');
  
  // 6. Test amount mismatch
  const wrong = await processSepayWebhook({...payload, transferAmount: 100});
  assert(wrong.action === 'amount_mismatch');
}
```

## Test scenarios matrix

### Happy path
- [x] Order created
- [x] Webhook sent (matching code, exact amount)
- [x] Order paid, paidAt set
- [x] Payment status='paid', all sepay_* fields set
- [x] History created with actor='sepay'

### Duplicate
- [x] Same webhook sent twice → no double payment
- [x] Action='duplicate' second time
- [x] Order still paid

### Amount
- [x] exact: action='payment_confirmed'
- [x] less: action='amount_mismatch', order not changed
- [x] more: action='amount_mismatch', order not changed

### Account
- [x] correct: pass
- [x] wrong: action='wrong_account', no change

### transferType
- [x] "in": pass
- [x] "out": action='wrong_transfer_type'

### Order code
- [x] no code in content: action='invalid_content'
- [x] wrong format: action='order_not_found'
- [x] not in DB: action='order_not_found'

### Auth (xem matcher.test.mjs)
- [x] valid HMAC: pass
- [x] wrong HMAC: 401
- [x] expired timestamp: 401
- [x] valid API Key: pass
- [x] wrong API Key: 401
- [x] none: pass (dev only)

### DB errors
- [ ] connection fail → 500 (manual test)
- [ ] deadlock → 500 (manual test, retry will succeed)

### Concurrent webhooks (CRITICAL)
- [ ] 2 webhooks same txn_id sent simultaneously → exactly 1 payment transition
  - Implementation: ON CONFLICT DO NOTHING ensures this.

## Manual E2E test

### Setup

1. Sepay test account (https://my.sepay.vn → Sandbox)
2. Tunnel local:
   ```
   ngrok http 3000
   ```
3. Configure webhook in Sepay dashboard:
   - URL: `https://abc123.ngrok.io/api/webhooks/sepay`
   - Auth: HMAC-SHA256 (or API Key)
   - Copy secret/key

### Test cases

#### Test 1: Happy path
```
1. Submit order form locally → get code LC-XXXXXX
2. Sepay dashboard → "Tạo giao dịch mô phỏng"
   - Account: your bank account
   - Amount: totalAmount
   - Content: LC-XXXXXX
3. Webhook fires → check logs
4. GET /api/payments/LC-XXXXXX/status → orderStatus='paid'
5. Frontend refresh → "Đã thanh toán"
```

#### Test 2: Duplicate webhook
```
1. Same as test 1
2. In Sepay dashboard: click "Replay" on the delivery
3. Same webhook delivered again
4. Check logs: 1st='payment_confirmed', 2nd='duplicate'
5. Order still paid (no duplicate)
```

#### Test 3: Wrong amount
```
1. Create order (198.000đ)
2. Sepay simulate: amount=100.000đ
3. Webhook fires → action='amount_mismatch'
4. Order still pending_payment
5. Admin panel shows webhook log with error
```

#### Test 4: Wrong account
```
1. Create order
2. Modify SEPAY_BANK_ACCOUNT in env (simulating account change)
3. Restart server
4. Webhook fires with old accountNumber → action='wrong_account'
```

#### Test 5: Auth fail
```
1. Submit forged POST without proper header
   → 401
2. Submit with wrong HMAC
   → 401
3. Submit with timestamp > 5 min old
   → 401
```

## Test utilities

### Generate test webhook payload

```js
function buildPayload(opts) {
  return {
    id: opts.id || Math.floor(Math.random() * 1e9),
    gateway: opts.gateway || 'MBBank',
    transactionDate: opts.transactionDate || new Date().toISOString(),
    accountNumber: opts.accountNumber,
    subAccount: '',
    code: opts.code || null,
    content: opts.content,
    transferType: opts.transferType || 'in',
    description: '',
    transferAmount: opts.transferAmount,
    accumulated: 0,
    referenceCode: opts.referenceCode || 'TEST' + Date.now(),
  };
}
```

### Simulate webhook cURL

```bash
# Test auth fail (no header)
curl -X POST https://your-domain/api/webhooks/sepay \
  -H "Content-Type: application/json" \
  -d '{"id":1}'

# Test happy path (với API Key)
curl -X POST https://your-domain/api/webhooks/sepay \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey YOUR_KEY" \
  -d '{
    "id": 99999,
    "gateway": "MBBank",
    "transactionDate": "2026-09-04 10:00:00",
    "accountNumber": "0123456789",
    "subAccount": "",
    "code": null,
    "content": "LC-AB23CD chuyen tien",
    "transferType": "in",
    "description": "",
    "transferAmount": 198000,
    "accumulated": 0,
    "referenceCode": "TEST123"
  }'
```

## Test checklist trước PR

- [ ] Pure tests pass: `node --test lib/sepay/__tests__/matcher.test.mjs`
- [ ] Build pass: `pnpm build`
- [ ] Manual E2E với Sepay sandbox OK
- [ ] Nếu thay đổi schema: migration test (push + queries)
- [ ] Nếu thay đổi webhook logic: update tests
- [ ] Nếu thay đổi business rule: update `references/payment-rules.md`
