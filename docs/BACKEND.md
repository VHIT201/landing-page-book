# Backend — đơn hàng (chưa gắn thanh toán)

Next.js Route Handlers + Postgres (Drizzle). Thanh toán / SePay để phase sau.

## Trạng thái đơn
`pending_payment → paid → preparing → shipping → delivered` (+ `cancelled`, `refunded`)

Ship: bạn tự liên hệ hãng vận chuyển rồi điền `carrier` + `trackingNo` trong `/admin`.

## Setup (1 lần)

1. **Tạo Postgres free** — [neon.tech](https://neon.tech) (không cần thẻ). Copy connection string (chọn *Pooled connection*).
2. Tạo `.env.local` từ mẫu:
   ```bash
   cp .env.example .env.local
   ```
   Điền `DATABASE_URL` và `ADMIN_PASSWORD`.
3. Tạo bảng:
   ```bash
   pnpm db:push
   ```
4. Chạy:
   ```bash
   pnpm dev
   ```

## Endpoints

| Method | Path | Ai gọi | Việc |
|---|---|---|---|
| POST | `/api/orders` | form khách | tạo đơn, trả `{ code, totalAmount, ... }`, bắn Telegram nếu có cấu hình |
| GET | `/api/orders/[code]?phone=1234` | khách tra cứu | trả status + tổng, cần 4 số cuối SĐT |
| GET | `/api/admin/orders?status=&q=&page=` | admin | danh sách + lọc |
| PATCH | `/api/admin/orders/[id]` | admin | đổi status / carrier / trackingNo / adminNote |

`/admin` và `/api/admin/*` được `middleware.ts` chặn bằng Basic Auth (`ADMIN_USER` / `ADMIN_PASSWORD`).

## Giá
Tính **ở server** từ `PRICE_UNIT` (env, mặc định 198000) × số lượng + `SHIPPING_FLAT`. Client không gửi giá.

## Deploy (Vercel)
Thêm env vào Project → Settings → Environment Variables: `DATABASE_URL`, `ADMIN_PASSWORD` (+ tuỳ chọn `PRICE_UNIT`, `SHIPPING_FLAT`, `TELEGRAM_*`).
Chạy `pnpm db:push` một lần trỏ vào DB production.

## Phase sau
- SePay: thêm `POST /api/webhooks/sepay`, match nội dung CK `LC-XXXXXX` → set `paid` tự động (idempotent theo mã giao dịch).
- Trang cảm ơn hiện VietQR.
- Rate-limit + Turnstile chống spam đơn.
- Supabase Auth thay Basic Auth.
