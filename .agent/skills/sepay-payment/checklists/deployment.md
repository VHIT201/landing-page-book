# Deployment Checklist — SePay Production

## Trước khi deploy

### Config

- [ ] `SEPAY_ENABLED=true`
- [ ] `SEPAY_AUTH_METHOD=hmac_sha256` (recommended)
- [ ] `SEPAY_WEBHOOK_SECRET=<prod secret>` (từ my.sepay.vn)
- [ ] `SEPAY_BANK_CODE=<your bank>` (vd: MBBank)
- [ ] `SEPAY_BANK_ACCOUNT=<prod STK>`
- [ ] `SEPAY_BANK_ACCOUNT_NAME=<prod account holder>`

### Sepay dashboard

- [ ] Production credentials (KHÔNG phải sandbox)
- [ ] Webhook URL = production HTTPS (vd: https://thelifecar.vn/api/webhooks/sepay)
- [ ] Auth method = HMAC-SHA256 hoặc API Key
- [ ] Bank account linked trong Sepay dashboard
- [ ] Payment code prefix configured (vd: `LC-`, 6 chars alphanumeric) — tùy chọn, vì backend tự extract

### Database

- [ ] `pnpm db:push` đã chạy với DATABASE_URL production
- [ ] Bảng `payments` tồn tại
- [ ] Bảng `sepay_webhook_logs` tồn tại
- [ ] Index đã tạo (sepay_transaction_id unique, order_id index, v.v.)
- [ ] Verify bằng `\d payments` trong psql

### Code

- [ ] `pnpm build` pass không warning
- [ ] Tests pass: `node --test lib/sepay/__tests__/matcher.test.mjs`
- [ ] Env vars đã set trên Vercel dashboard

### Application

- [ ] HTTPS working (Vercel auto)
- [ ] Endpoint `/api/webhooks/sepay` accessible từ internet
- [ ] Vercel function timeout đủ (≥10s cho DB transaction)

## Smoke test production

### Test 1: End-to-end

1. Mở production URL
2. Đặt đơn hàng (test order)
3. Verify QR code hiển thị đúng:
   - Bank code đúng (vd: "MBBank")
   - STK đúng
   - Amount đúng (total_amount)
   - Content = "LC-XXXXXX"
4. KHÔNG cần CK thật — chỉ cần verify QR hiển thị đúng info

### Test 2: Webhook delivery (Sepay sandbox trước)

Dùng Sepay test mode:
1. Submit test order (1đ để tránh nhầm)
2. Sepay test → simulate transaction
3. Verify webhook received (check Vercel logs hoặc DB `sepay_webhook_logs` table)
4. Verify order status = paid

### Test 3: Error path

1. Sepay dashboard → replay webhook với payload wrong amount
2. Verify logs có `action='amount_mismatch'`
3. Verify order KHÔNG bị paid

### Test 4: Auth fail

1. From Sepay dashboard, try to send without correct headers (nếu có option)
2. Verify 401 response in logs
3. Sepay sẽ retry → eventually succeed (nếu config đúng)

## Monitoring

### Daily checks (tự động nếu có thể)

- [ ] SELECT COUNT(*) FROM sepay_webhook_logs WHERE success='false' AND processed_at > NOW() - INTERVAL '1 day'
  - Nếu > 5 → investigate
- [ ] SELECT COUNT(*) FROM orders WHERE status='pending_payment' AND created_at < NOW() - INTERVAL '1 day'
  - Nếu > 0 có khả năng bị stuck

### Weekly

- [ ] Check Sepay dashboard delivery history
- [ ] Rotate logs
- [ ] Verify bank account info vẫn đúng

### Monthly

- [ ] Rotate Webhook Secret nếu có thể
- [ ] Backup DB
- [ ] Review security checklist

## Rollback plan

Nếu deploy xong có issue:

1. Set `SEPAY_ENABLED=false` → Sepay webhooks sẽ no-op (vẫn trả 200)
2. Đơn vẫn tạo được, payment `pending`, admin manual confirm cũ
3. Investigate, fix, deploy lại

DB schema KHÔNG cần rollback (bảng mới không ảnh hưởng orders cũ).

## Recovery procedure

### Webhook bị miss nhiều giờ

Sepay docs (doi-soat-giao-dich): "Webhooks can be lost if your endpoint is down for more than 5 hours."

Phase 2 sẽ có cron tự động. Phase 1: admin manual.

Manual:
1. Sepay dashboard → Transactions list → filter by date
2. Compare với DB orders chưa paid
3. Cho mỗi transaction KHÔNG có webhook log → check khách đã CK chưa
4. Nếu CK vào tài khoản đúng → manual PATCH order status (admin panel)
5. Manual insert webhook_log entry để audit

### Database corruption

Rất khó xảy ra với UNIQUE constraints. Nếu:

1. Stop receiving webhooks (`SEPAY_ENABLED=false`)
2. Backup DB ngay
3. Investigate bảng nào corrupt
4. Restore từ backup + replay webhooks
