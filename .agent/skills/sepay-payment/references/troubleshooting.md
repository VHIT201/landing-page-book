# Troubleshooting — SePay Payment

Playbook cho ops/developer khi có issue với SePay.

## Symptom: Khách CK nhưng đơn vẫn `pending_payment`

### Bước 1: Xác minh Sepay đã gọi webhook chưa

```sql
SELECT id, transaction_id, order_code, action, success, processed_at, error_message
FROM sepay_webhook_logs
WHERE order_code = 'LC-XXXXXX'
ORDER BY processed_at DESC;
```

### Nếu KHÔNG có log → webhook không đến

- Webhook URL sai (nhầm staging/prod)?
  - Vào Sepay dashboard → Integrations → Webhooks → check URL
- HTTPS cert issue?
- Server down tại thời điểm webhook gửi?
- IP firewall chặn?
- Sepay đang tạm downtime?

→ Reconciliation phase 2 sẽ tự xử lý (chưa có).

### Nếu có log `success='false'`

```sql
SELECT * FROM sepay_webhook_logs
WHERE order_code = 'LC-XXXXXX' AND success = 'false'
ORDER BY processed_at DESC LIMIT 5;
```

Check `error_message`:
- `wrong_account`: STK khớp. Tài khoản đã đổi?
- `amount_mismatch`: `expected=... actual=...`. Khách CK sai.
- `order_not_found`: order code không match DB.
- `wrong_transfer_type`: `transferType=out`. Hiếm.
- `invalid_payload`: payload Sepay gửi không đúng format (rất hiếm).

### Nếu có log `success='true'` mà order vẫn pending

- Có thể request bị retry → log mới hơn không có?
- Refresh admin page (cache?).

## Symptom: Webhook trả 401 Unauthorized

### Kiểm tra env

```bash
# Local
cat .env.local | grep SEPAY_

# Production
# Vercel dashboard → Settings → Environment Variables
```

Cần:
- `SEPAY_API_KEY` (nếu method=api_key)
- `SEPAY_WEBHOOK_SECRET` (nếu method=hmac_sha256)

### Kiểm tra format

API Key: header phải chính xác `Apikey <KEY>` (có space).

HMAC: header `X-SePay-Signature: sha256=<hex>`, `X-SePay-Timestamp: <sec>`.

### Timestamp drift

Nếu server clock lệch >5 phút → 401.

```bash
date -u
ntpdate -q ntp.ubuntu.com  # check time drift
```

Fix: enable NTP trên server (Vercel tự có).

## Symptom: Webhook trả 500 Internal Error

### Check logs

Vercel logs: https://vercel.com/dashboard → Project → Logs

Lok for:
```
[SEPAY_DB_ERROR]
[SEPAY_INTERNAL_ERROR]
```

### Nguyên nhân phổ biến

1. **Neon DB pool exhausted**: Vercel serverless + Neon pool có limit. Retry sẽ work.
2. **Schema mismatch**: bảng `payments` / `sepay_webhook_logs` chưa được tạo.
   ```
   Chạy: pnpm db:push
   ```
3. **Bug trong `processSepayWebhook`**: check logs chi tiết.

## Symptom: Order paid nhưng không có payment record

Có thể do:
- Code cũ set paid thủ công (status='paid') mà không có payment.
- Migration script bị miss cho orders cũ.

### Verify

```sql
SELECT o.code, o.status, o.paid_at, p.status as payment_status
FROM orders o
LEFT JOIN payments p ON o.id = p.order_id
WHERE o.code = 'LC-XXXXXX';
```

### Fix

```sql
-- Tạo payment record cho đơn cũ đã paid
INSERT INTO payments (id, order_id, amount, status, paid_at, created_at, updated_at)
SELECT gen_random_uuid(), id, total_amount, 'paid', paid_at, NOW(), NOW()
FROM orders
WHERE code = 'LC-XXXXXX'
ON CONFLICT DO NOTHING;
```

## Symptom: Frontend không hiển thị QR

- `SEPAY_ENABLED` chưa set `true`.
- Env SEPAY_BANK_* chưa config.
- API POST /api/orders trả `paymentInfo=null` → check server logs.

### Verify env

```bash
curl http://localhost:3000/api/orders/LC-XXXXXX?phone=1234
```

Nếu `payment: null` → check `getBankInfo()` returns null → env chưa đặt.

## Symptom: VietQR image không hiển thị / broken

- `vietqr.app` service down? Check: https://vietqr.app/
- `bank` code sai (VD: "MBBank" vs "MB" vs "Mbbank")?
  - Xem danh sách: https://docs.sepay.vn/danh-sach-ngan-hang.html
- Test trực tiếp URL:
  ```
  https://vietqr.app/img?bank=MBBank&acc=0123456789&template=compact&amount=198000&des=LC-A2B3C4
  ```

## Symptom: Duplicate payment (1 đơn có >1 payment row)

Không nên xảy ra (có UNIQUE partial index). Nếu xảy ra → bug trong migration hoặc manual SQL.

### Check

```sql
SELECT order_id, COUNT(*) FROM payments
WHERE status != 'failed'
GROUP BY order_id
HAVING COUNT(*) > 1;
```

### Fix

Manual: xóa row duplicate, giữ lại row active nhất.

## Symptom: Polling frontend không dừng

Frontend `OrderForm.tsx` polling 5s, stop khi `paid=true`. Nếu không dừng:

- Check `paid` state set đúng trong polling logic.
- DevTools Network tab: stop check `/api/payments/...` requests.
- Browser console: có error?

## Sepay dashboard debug

### Check webhook delivery history

Vào https://my.sepay.vn → Integrations → Webhooks → (chọn webhook) → History.

Mỗi delivery:
- Status (success/failed)
- HTTP code từ server
- Response body
- Timestamp
- Retry count

Nếu status=failed nhiều → server đang trả error.

### Check IP whitelist

Nếu webhook fail vì IP không match → check danh sách IP Sepay ở: https://developer.sepay.vn/en/dia-chi-ip.

## Emergency: Disable SePay tạm thời

```bash
# Vercel
# Project → Settings → Environment Variables → SEPAY_ENABLED = false
# Redeploy

# Local
# .env.local → SEPAY_ENABLED=false
# Restart pnpm dev
```

Webhooks sẽ vẫn được gửi nhưng trả 200 success without processing (log "[SEPAY_DISABLED]").

## Khi nào escalate

- [ ] Mất tiền (customer CK nhưng không nhận được hàng) → check logs gấp
- [ ] Database corruption (impossible with UNIQUE constraint, nhưng nếu nghi ngờ)
- [ ] Sepay service down → tạm tắt + reconcile sau
- [ ] Khách khiếu nại nhiều lần cùng 1 vấn đề → involve admin manual
