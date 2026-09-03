# Hệ thống đơn hàng — THE LIFECAR

Next.js Route Handlers + Postgres (Drizzle) + session cookie. Thanh toán / SePay để phase sau.

## Trạng thái đơn
`pending_payment → paid → preparing → shipping → delivered` (+ `cancelled`, `refunded`).
Ship: bạn tự liên hệ hãng rồi điền `carrier` + `trackingNo` trong `/admin`.

## Setup (1 lần)

1. **Postgres** — Neon / Supabase, hoặc server sẵn có. Lấy connection string.
2. `cp .env.example .env.local` rồi điền:
   - `DATABASE_URL`
   - `ADMIN_USER`, `ADMIN_PASSWORD` (đăng nhập /admin)
   - `AUTH_SECRET` — chuỗi ngẫu nhiên ≥16 ký tự (`openssl rand -hex 32`)
3. `pnpm db:push` — tạo bảng.
4. `pnpm dev`.

## Trang

| URL | Ai | Việc |
|---|---|---|
| `/#dat-hang` | khách | form đặt: tên, SĐT, **Tỉnh/Huyện/Xã (dropdown) + số nhà**, số lượng |
| `/don-hang/<code>` | khách | nhập 4 số cuối SĐT → xem trạng thái + tiến trình + lịch sử |
| `/admin/login` | bạn | đăng nhập |
| `/admin` | bạn | dashboard: thẻ số tổng / doanh thu / hôm nay, lọc theo trạng thái, tìm, phân trang, đổi nhanh trạng thái |
| `/admin/orders/<code>` | bạn | chi tiết đơn + sửa (trạng thái, hãng ship, mã vận đơn, ghi chú) + timeline |

## API

| Method | Path | Bảo vệ | |
|---|---|---|---|
| POST | `/api/orders` | — | tạo đơn, ghép `addressLine`, giá tính server-side, Telegram nếu có |
| GET | `/api/orders/<code>?phone=1234` | 4 số cuối SĐT | trạng thái + lịch sử cho khách |
| POST | `/api/admin/login` / `logout` | — | set / xoá cookie phiên |
| GET | `/api/admin/orders?status=&q=&page=` | cookie | danh sách |
| PATCH | `/api/admin/orders/<id>` | cookie | đổi trạng thái / carrier / trackingNo / adminNote |

`middleware.ts` chặn `/admin/*` và `/api/admin/*` (trừ login/logout) bằng session JWT ký `AUTH_SECRET`. Chưa đăng nhập: trang → redirect `/admin/login`, API → 401.

## Địa chỉ
Dropdown tầng gọi `provinces.open-api.vn` (client). Lưu cả **code + name** của tỉnh/huyện/xã + `addressDetail`. `addressLine` = chuỗi ghép đầy đủ để hiển thị. API lỗi → tự chuyển sang 1 ô nhập tay.

## Giá
`PRICE_UNIT` (env, mặc định 198000) × số lượng + `SHIPPING_FLAT`. Client không gửi giá.

## Deploy (Vercel)
Env: `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `AUTH_SECRET` (+ `PRICE_UNIT`, `SHIPPING_FLAT`, `TELEGRAM_*`). Chạy `pnpm db:push` trỏ DB production. Nên tách DB `_dev` và production.

## Phase sau
- SePay: `POST /api/webhooks/sepay`, match nội dung CK `LC-XXXXXX` → `paid` tự động (idempotent theo mã giao dịch).
- Trang cảm ơn hiện VietQR.
- Rate-limit + Turnstile chống spam.
- Nhiều admin + phân quyền (hiện 1 tài khoản env).
