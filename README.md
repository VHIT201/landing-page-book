# THE LIFECAR — Landing page + hệ thống đơn hàng

Landing page bán sách **"Chiếc Xe Cuộc Đời" – Nguyễn Chí Thành**, kèm backend nhận đơn, trang tra cứu cho khách và trang quản trị.

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM + Postgres · motion.

---

## 1. Yêu cầu

- Node 20+
- pnpm 10+ (`npm i -g pnpm`)
- 1 database Postgres (Neon / Supabase / server riêng)

## 2. Chạy local

```bash
pnpm install
cp .env.example .env.local     # rồi điền giá trị, xem mục 4
pnpm db:push                   # tạo bảng trong DB
pnpm dev                       # http://localhost:3000
```

## 3. Scripts

| Lệnh | Việc |
|---|---|
| `pnpm dev` | chạy dev |
| `pnpm build` / `pnpm start` | build + chạy production |
| `pnpm lint` | eslint |
| `pnpm db:generate` | sinh file migration SQL từ `lib/db/schema.ts` |
| `pnpm db:push` | đẩy schema thẳng vào DB (dev) |
| `pnpm db:studio` | mở Drizzle Studio xem/sửa dữ liệu |

## 4. Biến môi trường (`.env.local`)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | ✅ | Connection string Postgres. Neon/Supabase dùng bản *pooled*. |
| `ADMIN_USER` | ✅ | Tên đăng nhập `/admin` (mặc định `admin`). |
| `ADMIN_PASSWORD` | ✅ | Mật khẩu `/admin`. Chưa đặt = không đăng nhập được. |
| `AUTH_SECRET` | ✅ | Khoá ký session cookie, ngẫu nhiên ≥ 16 ký tự. Sinh: `openssl rand -hex 32`. |
| `PRICE_UNIT` | — | Giá 1 cuốn (VND). Mặc định `198000`. Giá luôn tính ở server. |
| `SHIPPING_FLAT` | — | Phí ship phẳng (VND). Mặc định `0`. |
| `TELEGRAM_BOT_TOKEN` | — | Bot báo đơn mới. Bỏ trống = không gửi. |
| `TELEGRAM_CHAT_ID` | — | Chat/nhóm nhận thông báo. |
| `NEXT_PUBLIC_SITE_URL` | — | Domain thật, dùng cho link tuyệt đối / SEO. |

File mẫu: **`.env.example`** (đã commit). File thật **`.env.local`** KHÔNG commit — gửi cho người khác qua kênh riêng, đừng đẩy lên git.

Trên Vercel: nhập các biến này ở *Project → Settings → Environment Variables*, rồi chạy `pnpm db:push` trỏ vào DB production. Nên tách DB `dev` và `production`.

## 5. Cấu trúc

```
app/
  page.tsx                     landing page (ghép các section)
  layout.tsx                   metadata / SEO / font
  opengraph-image.tsx          ảnh OG động
  sitemap.ts  robots.ts
  icon.png  apple-icon.png     favicon

  api/
    orders/route.ts            POST tạo đơn
    orders/[code]/route.ts     GET khách tra cứu (cần 4 số cuối SĐT)
    admin/login|logout         session cookie
    admin/orders/route.ts      GET danh sách (cookie)
    admin/orders/[id]/route.ts PATCH cập nhật (cookie)

  admin/                       khu quản trị (middleware chặn)
    login/page.tsx
    page.tsx                   dashboard: thẻ số + bảng + lọc + phân trang
    orders/[code]/page.tsx     chi tiết đơn + sửa + timeline
  don-hang/[code]/page.tsx     trang tra cứu cho khách

components/
  Hero, ValueBar, Systems, Quote, Author, Reviews, Faq, OrderForm, Footer, Header …
  AddressPicker.tsx            dropdown Tỉnh/Huyện/Xã
  motion/Reveal.tsx  motion/Counter.tsx

content/site.ts                TOÀN BỘ nội dung marketing (text, giá, review, FAQ)
lib/
  db/schema.ts                 bảng orders, order_status_history
  db/index.ts                  drizzle client (lazy)
  orders.ts                    tạo mã, tính giá, đổi trạng thái, thống kê
  auth.ts                      session JWT (jose)
  validation.ts                schema Zod
  orderStatus.ts               nhãn + màu trạng thái
  notify.ts                    Telegram
middleware.ts                  chặn /admin + /api/admin
drizzle/                       migration SQL
docs/BACKEND.md                chi tiết backend
```

## 6. Sửa nội dung landing

Mọi text/giá/review/FAQ/menu nằm trong **`content/site.ts`** — sửa ở đó, không cần đụng component.
Ảnh: thả vào `public/images/` rồi trỏ path trong `content/site.ts` (`hero.coverImage`, `author.photo`, `valueBar[].image`…).

## 7. Luồng đơn hàng

1. Khách điền form ở `/#dat-hang` (tên, SĐT, Tỉnh/Huyện/Xã + số nhà, số lượng) → tạo đơn trạng thái `pending_payment`, sinh mã `LC-XXXXXX`.
2. Màn hình hiện mã đơn. Khách vào `/don-hang/<mã>`, nhập 4 số cuối SĐT để theo dõi.
3. Bạn vào `/admin` → thấy đơn → (tạm thời) tự đối soát chuyển khoản, đổi trạng thái `paid`.
4. Đóng gói → tự liên hệ hãng vận chuyển → điền `carrier` + `trackingNo` → đổi `shipping` → `delivered`.

Trạng thái: `pending_payment → paid → preparing → shipping → delivered` (+ `cancelled`, `refunded`). Mỗi lần đổi ghi vào `order_status_history` (timeline).

## 8. Bảo mật đã có

- Giá tính ở server từ `PRICE_UNIT`, không tin client.
- `/admin` + `/api/admin/*` sau session cookie ký JWT; so sánh mật khẩu timing-safe.
- Trang tra cứu khách chỉ trả đơn khi khớp 4 số cuối SĐT, không lộ danh sách.
- Zod validate SĐT VN, địa chỉ, số lượng 1–20.
- `.env*` trong `.gitignore` (trừ `.env.example`).

## 9. Deploy (Vercel)

- Push lên GitHub → import vào Vercel (framework tự nhận Next.js).
- `pnpm` được nhận qua `pnpm-lock.yaml`; `package.json > pnpm.onlyBuiltDependencies` đã cho phép `@tailwindcss/oxide` build.
- Nhập env (mục 4). Chạy `pnpm db:push` một lần cho DB production.

## 10. Chưa làm (roadmap)

- **Thanh toán SePay**: `POST /api/webhooks/sepay` match nội dung CK `LC-XXXXXX` → tự set `paid` (idempotent theo mã giao dịch).
- Trang cảm ơn hiện **VietQR**.
- Rate-limit + Cloudflare Turnstile chống spam đơn.
- Nhiều tài khoản admin + phân quyền (hiện 1 tài khoản qua env).
- Email/Zalo xác nhận đơn cho khách.

Chi tiết backend: **`docs/BACKEND.md`**.
