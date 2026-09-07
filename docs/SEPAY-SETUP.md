# SEPAY-SETUP — Hướng dẫn tích hợp thanh toán SePay cho dự án

> **Đối tượng đọc:** PM, Dev, người mới tham gia dự án.
> **Mục đích:** Sau khi đọc xong file này, bạn biết SePay là gì, chọn được cách tích hợp phù hợp, biết cần đọc tài liệu ở đâu, và biết cách cấu hình dashboard `my.sepay.vn` từng bước.
> **File liên quan (chi tiết kỹ thuật code):** [`docs/SEPAY-DEV-GUIDE.md`](./SEPAY-DEV-GUIDE.md)
> **Cập nhật lần cuối:** 2026-09-04

---

## Mục lục

1. [SePay là gì?](#1-sepay-là-gì)
2. [2 cách tích hợp SePay — chọn cái nào?](#2-2-cách-tích-hợp-sepay--chọn-cái-nào)
3. [URL tài liệu chính thức cần bookmark](#3-url-tài-liệu-chính-thức-cần-bookmark)
4. [Tools kết hợp thường dùng (Cloudflare Tunnel)](#4-tools-kết-hợp-thường-dùng-cloudflare-tunnel)
5. [Cấu hình dashboard `my.sepay.vn` từng bước](#5-cấu-hình-dashboard-mysepayvn-từng-bước)
6. [Biến môi trường bắt buộc](#6-biến-môi-trường-bắt-buộc)
7. [Checklist trước khi go-live](#7-checklist-trước-khi-go-live)
8. [Lỗi thường gặp & cách xử lý nhanh](#8-lỗi-thường-gặp--cách-xử-lý-nhanh)
9. [Khi nào cần đọc file `SEPAY-DEV-GUIDE.md`](#9-khi-nào-cần-đọc-file-sepay-dev-guidemd)

---

## 1. SePay là gì?

**SePay** là dịch vụ trung gian kết nối **12+ ngân hàng Việt Nam** (Vietcombank, BIDV, MBBank, ACB, Techcombank, VPBank, …) với hệ thống website của bạn, giúp:

- ✅ **Tự động nhận webhook** khi có biến động số dư (tiền vào/ra) trên tài khoản ngân hàng
- ✅ **Tạo QR code VietQR động** theo từng đơn hàng (quét QR → đúng số tiền, đúng nội dung)
- ✅ **Không thu phí % giao dịch** — chỉ trả phí thuê bao tháng (rẻ hơn nhiều so với VNPay/MoMo/Stripe)
- ✅ **Tiền vào thẳng tài khoản** ngân hàng của bạn — không qua trung gian

**Phù hợp với:** bán hàng online, landing page bán sách/khoá học, SaaS, … bất kỳ ai cần thu tiền qua CK ngân hàng Việt Nam và muốn tự động xác nhận thanh toán.

**Không phù hợp với:** thanh toán quốc tế (dùng Stripe), hoặc cần merchant account VISA/Master (SePay có nhưng là sản phẩm riêng).

---

## 2. 2 cách tích hợp SePay — chọn cái nào?

SePay cung cấp 2 sản phẩm chính. **Đây là quyết định quan trọng nhất** khi bắt đầu dự án.

### Cách 1 — Webhook ngân hàng (Bank Webhook) ⭐ Khuyến nghị cho landing page

```
┌──────────┐  quét QR   ┌────────────┐   push    ┌─────────┐   POST    ┌──────────┐
│ Khách    │ ─────────► │ App bank   │ ────────► │  SePay  │ ────────► │ Server   │
│ (QR của  │             │ (VCB,MB,   │   tiền    │ (nhận   │  webhook  │ của bạn  │
│  bạn)    │             │  ACB...)   │   vào TK  │  notify)│           │          │
└──────────┘             └────────────┘           └─────────┘           └──────────┘
```

- **Đặc điểm:**
  - Bạn tự tạo QR, SePay chỉ đẩy webhook khi có tiền vào TK
  - Tiền vào **tài khoản cá nhân/doanh nghiệp của bạn** (không qua SePay)
  - Bạn **tự verify nội dung CK** để match với đơn hàng
- **Phù hợp khi:**
  - ✅ Bán hàng nhỏ (1-N sản phẩm), landing page, sách, khoá học
  - ✅ Khách CK trực tiếp vào TK bạn (không cần merchant account)
  - ✅ Đã có sẵn tài khoản ngân hàng, chỉ muốn tự động hoá
- **Độ phức tạp:** ⭐⭐ Trung bình (cần tự parse content, match order)

### Cách 2 — Cổng thanh toán SePay (Payment Gateway)

```
┌──────────┐  checkout   ┌─────────┐   thanh toán  ┌────────────┐   IPN    ┌──────────┐
│ Khách    │ ──────────► │  SePay  │ ────────────► │  Ngân hàng │ ───────► │ Server   │
│ (form    │  redirect   │ (gateway│   thẻ/QR NAPAS│  (Vietcom, │  notify  │ của bạn  │
│  trên    │             │  page)  │               │   BIDV...) │          │          │
│  bạn)    │             └─────────┘               └────────────┘          └──────────┘
```

- **Đặc điểm:**
  - SePay cung cấp form checkout hoàn chỉnh (SePay's UI)
  - Khách thanh toán xong → SePay redirect về `success_url` của bạn
  - SePay cũng đẩy IPN (similar to webhook) về server bạn
  - **Cần đăng ký gói Cổng thanh toán** (có thể mất phí)
- **Phù hợp khi:**
  - ✅ Platform có nhiều merchant (Shopify-like)
  - ✅ Cần thanh toán quốc tế, thẻ quốc tế
  - ✅ Cần SePay chịu trách nhiệm về PCI-DSS (thẻ)
- **Độ phức tạp:** ⭐⭐⭐ Cao hơn (cần SDK, sandbox, go-live)

### Quyết định nhanh

| Bạn đang làm gì? | Chọn cách |
|-------------------|-----------|
| Landing page bán 1-5 sản phẩm, khách CK trực tiếp cho bạn | **Cách 1** ⭐ |
| Bán hàng đơn giản, không cần SePay UI | **Cách 1** ⭐ |
| Có nhiều merchant, cần SePay làm trung gian | Cách 2 |
| Cần thanh toán thẻ quốc tế | Cách 2 |
| Dự án **đang đọc docs này** (LIFECAR landing page) | **Cách 1** ⭐ |

> 💡 **File docs này tập trung vào Cách 1.** Nếu dự án của bạn dùng Cách 2, vẫn đọc được phần lớn nhưng phần "Cấu hình dashboard" sẽ khác.

---

## 3. URL tài liệu chính thức cần bookmark

| URL | Khi nào cần |
|-----|-------------|
| **[https://developer.sepay.vn/vi](https://developer.sepay.vn/vi)** | Portal chính — tổng quan SePay, code mẫu, sandbox. **Bookmark luôn.** |
| **[https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau](https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau)** | Khi muốn dùng Cách 2 (Payment Gateway), bắt đầu từ đây. |
| [https://docs.sepay.vn/](https://docs.sepay.vn/) | Tài liệu tự động hoá thanh toán — giải thích mô hình hoạt động. |
| **[https://sepay.vn/lap-trinh-cong-thanh-toan.html](https://sepay.vn/lap-trinh-cong-thanh-toan.html)** | ⭐ **Tutorial tự lập trình từ A-Z** (Cách 1), có code mẫu PHP/MySQL. **Đọc trang này nếu dùng Cách 1.** |
| [https://my.sepay.vn/](https://my.sepay.vn/) | Dashboard quản lý webhook, xem giao dịch, cấu hình. |
| [https://my.sepay.vn/register](https://my.sepay.vn/register) | Đăng ký tài khoản. |
| [https://docs.sepay.vn/tich-hop-webhooks.html](https://docs.sepay.vn/tich-hop-webhooks.html) | Chi tiết về webhook schema, headers, sample payloads. |

> ⚠️ SePay còn có docs tiếng Anh (developer.sepay.vn/en/...) nhưng **một số trang chỉ có tiếng Việt**. Khi cần tìm nhanh, search Google `site:developer.sepay.vn <keyword>`.

---

## 4. Tools kết hợp thường dùng (Cloudflare Tunnel)

Khi phát triển local, bạn cần **public HTTPS URL** để SePay gọi webhook về (vì SePay **chỉ chấp nhận HTTPS**, không gọi `localhost` hay IP nội bộ).

### 4.1. Cloudflare Tunnel — Khuyến nghị ⭐

**Cloudflare Tunnel** (`cloudflared`) cho phép expose `localhost:3000` ra HTTPS public **miễn phí**, không cần đăng ký tên miền.

```bash
# Cài đặt (Windows)
winget install Cloudflare.cloudflared

# Hoặc tải từ https://github.com/cloudflare/cloudflared/releases

# Chạy tunnel (1 lệnh, không cần config)
cloudflared tunnel --url http://localhost:3000
# → Output: https://<random>.trycloudflare.com
```

**Ưu điểm:**
- Miễn phí, không cần account Cloudflare
- Tự động HTTPS
- Tunnel tạm (mỗi lần chạy ra URL mới) — phù hợp dev/test
- Bảo mật: không mở port trên firewall

**Nhược điểm:**
- URL đổi mỗi lần restart tunnel → mỗi lần phải cập nhật lại webhook URL trên SePay dashboard
- Băng thông giới hạn (không dùng cho production)

### 4.2. So sánh với alternatives

| Tool | Free HTTPS | Setup | Dùng cho |
|------|-----------|-------|----------|
| **Cloudflare Tunnel** | ✅ | 1 lệnh | Dev/test local ⭐ |
| ngrok | ✅ (có giới hạn) | 1 lệnh, cần account | Dev/test local |
| localtunnel | ✅ | 1 lệnh | Demo nhanh |
| Deploy Vercel/Railway | ✅ | Tốn thời gian setup | Production |

> 💡 **Khi go-live production:** dùng domain thật + Vercel/Railway/hosting của bạn. KHÔNG dùng tunnel.

---

## 5. Cấu hình dashboard `my.sepay.vn` từng bước

> ⚠️ **File này tập trung vào Cách 1 (Webhook ngân hàng).** Nếu dùng Cách 2 (Payment Gateway), phần này khác — tham khảo [https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau](https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau).

### Bước 5.1 — Đăng ký tài khoản

1. Vào **[https://my.sepay.vn/register](https://my.sepay.vn/register)**
2. Điền email + password
3. Xác thực email
4. Đăng nhập vào **[https://my.sepay.vn/](https://my.sepay.vn/)**

> 💡 Có gói miễn phí dùng thử. Khi cần dùng thật, chọn gói phù hợp.

### Bước 5.2 — Liên kết tài khoản ngân hàng

1. Trong dashboard, vào menu **"Tài khoản ngân hàng"** / **"Bank Accounts"**
2. Bấm **"+ Thêm"** / **"Add bank"**
3. Chọn ngân hàng bạn muốn nhận tiền (VD: MBBank, Vietcombank, BIDV, ...)
4. Điền:
   - **Số tài khoản** (STK)
   - **Tên chủ tài khoản** (IN HOA, không dấu — VD: `NGUYEN VAN A`)
   - Xác thực (có thể cần đăng nhập Internet Banking)
5. Bấm **Lưu**

> ⚠️ **Lưu ý quan trọng:** Sau khi liên kết, SePay cần **vài phút đến vài giờ** để bắt đầu nhận biến động số dư từ ngân hàng. Kiên nhẫn chờ.

### Bước 5.3 — Lấy API Key (nếu dùng auth = `api_key`)

> ⚠️ **Nên dùng HMAC-SHA256 thay vì API Key** (an toàn hơn). Xem bước 5.4.

1. Menu **"API Key"** / **"Tích hợp"**
2. Bấm **"+ Tạo API Key"**
3. Đặt tên (VD: `production-webhook`, `laptop-dev`)
4. **Copy key** ngay — SePay thường chỉ hiển thị 1 lần
5. Lưu vào `.env.local`:
   ```env
   SEPAY_API_KEY=<paste vào đây>
   ```

### Bước 5.4 — Tạo Webhook URL (khuyến nghị dùng HMAC-SHA256)

1. Menu **"Tích hợp"** / **"Webhooks"**
2. Bấm **"+ Thêm webhook"** / **"Create new"**
3. Điền form:
   - **URL webhook:** `https://your-domain.com/api/webhooks/sepay`
     - **Local dev:** `https://<random>.trycloudflare.com/api/webhooks/sepay` (lấy từ Cloudflare Tunnel)
   - **Events:** ☑ **Có tiền vào** (incoming transactions) — *chỉ cần event này cho việc xác nhận thanh toán*
   - **Authentication method:** `HMAC-SHA256` ⭐ (khuyến nghị)
4. Sau khi tạo, mở chi tiết webhook:
   - Tìm mục **"Secret Key"** / **"Webhook Secret"** / **"HMAC Secret"**
   - Thường ở tab **Security** hoặc **Settings** (xem chi tiết ở mục 5.5)
   - Dạng: `whsec_<38 hex chars>` hoặc hex 64 chars
   - **Copy ngay** — một số dashboard chỉ hiện 1 lần
5. Lưu vào `.env.local`:
   ```env
   SEPAY_WEBHOOK_SECRET=<paste vào đây>
   ```

> 💡 **Vị trí chính xác của Secret thay đổi theo version dashboard.** Nếu không thấy, kiểm tra cả 3 chỗ:
> - Tab **"Security"** / **"Bảo mật"**
> - Tab **"Settings"** / **"Cấu hình"**
> - Thông báo popup **ngay sau khi tạo webhook** (chỉ hiện 1 lần)

### Bước 5.5 — Vị trí Webhook Secret (3 nơi cần kiểm tra)

Tuỳ version SePay dashboard, Secret có thể ở:

#### Vị trí A — Tab "Security" / "Bảo mật"
- Label: "Secret Key", "Webhook Secret", hoặc "HMAC Secret"
- Click "Hiện" / "Reveal" để xem
- Click "Copy" → paste vào `.env`

#### Vị trí B — Tab "Settings" / "Cấu hình"
- Mục "Xác thực" → "HMAC-SHA256"
- Nút "Generate Secret" (nếu chưa có) hoặc "Regenerate" (để rotate)

#### Vị trí C — Popup ngay khi tạo webhook
- Sau khi save, popup hiện: **"Sao chép secret ngay, bạn sẽ không thấy lại"**
- Nếu lỡ đóng → xoá webhook tạo lại

### Bước 5.6 — Test webhook bằng "Gửi thử"

1. Trong trang chi tiết webhook, tìm nút **"Gửi thử"** / **"Send test webhook"**
2. Bấm → SePay gửi 1 POST request mẫu về URL của bạn
3. Kiểm tra:
   - Server của bạn nhận được (xem log `[SEPAY_PROCESSED]` ở terminal)
   - Response trả về `200 + {"success":true}`
4. Nếu lỗi → xem [mục 8](#8-lỗi-thường-gặp--cách-xử-lý-nhanh)

### Bước 5.7 — Test thật bằng CK 1đ

1. Lấy STK + nội dung CK từ QR do server bạn sinh ra
2. Mở app ngân hàng, CK **1đ** hoặc **đúng số tiền đơn**
3. Đợi 5-30 giây
4. Kiểm tra:
   - Terminal server log `[SEPAY_PROCESSED] { action: 'payment_confirmed', code: 'LC-XXXXXX' }`
   - Database: payment status chuyển `pending` → `paid`
   - UI frontend tự động update (nếu đang ở trang QR)

> 💡 **Mẹo:** CK với nội dung chính xác mã đơn (VD: `LC-A1B2C3`) để test happy path. Sau đó test case sai tiền, CK vào STK khác, duplicate, ...

---

## 6. Biến môi trường bắt buộc

Sau khi cấu hình dashboard xong, copy các giá trị vào file `.env.local` của dự án:

```env
# === BẮT BUỘC ===
SEPAY_ENABLED=true
SEPAY_BANK_CODE=MBBank                       # Mã NH (xem danh sách ở sepay.vn/lap-trinh-cong-thanh-toan.html)
SEPAY_BANK_ACCOUNT=0903252427                # STK của bạn
SEPAY_BANK_ACCOUNT_NAME=NGUYEN VAN A         # Tên chủ TK (IN HOA, không dấu)

# === AUTH METHOD: chọn 1 trong 2 ===

# Cách 1 — HMAC-SHA256 (KHUYẾN NGHỊ, an toàn hơn)
SEPAY_AUTH_METHOD=hmac_sha256
SEPAY_WEBHOOK_SECRET=whsec_l9rSxxxxxxxxxxxxxx
# SEPAY_API_KEY=                               # ← KHÔNG cần nếu dùng HMAC

# Cách 2 — API Key (đơn giản hơn nhưng kém an toàn)
# SEPAY_AUTH_METHOD=api_key
# SEPAY_API_KEY=S1VIUTKCxxxxxxxxxxxxxxxxx
# SEPAY_WEBHOOK_SECRET=                        # ← KHÔNG cần nếu dùng API Key

# === OPTIONAL ===
SEPAY_API_URL=https://userapi.sepay.vn/v2    # default OK, chỉ đổi nếu self-host
```

### Tham chiếu nhanh từng biến

| Biến | Bắt buộc | Lấy từ đâu |
|------|---------|------------|
| `SEPAY_ENABLED` | ✅ | Bạn tự đặt `true` |
| `SEPAY_BANK_CODE` | ✅ | Sepay dashboard → Bank Accounts → dropdown NH (VD: `MBBank`, `Vietcombank`, `BIDV`) |
| `SEPAY_BANK_ACCOUNT` | ✅ | STK thật của bạn |
| `SEPAY_BANK_ACCOUNT_NAME` | ✅ | Tên trên STK, IN HOA, không dấu |
| `SEPAY_AUTH_METHOD` | ✅ | `hmac_sha256` (khuyến nghị) hoặc `api_key` |
| `SEPAY_WEBHOOK_SECRET` | Nếu HMAC | Sepay dashboard → Webhooks → Security tab |
| `SEPAY_API_KEY` | Nếu API Key | Sepay dashboard → API Keys |
| `SEPAY_API_URL` | ❌ | Default `https://userapi.sepay.vn/v2`, đổi nếu self-host |

### Danh sách mã ngân hàng (hay dùng)

| Tên đầy đủ | Code (cho VietQR + Sepay) |
|------------|--------------------------|
| MBBank | `MBBank` |
| Vietcombank | `Vietcombank` |
| BIDV | `BIDV` |
| ACB | `ACB` |
| Techcombank | `Techcombank` |
| VPBank | `VPBank` |
| TPBank | `TPBank` |
| Sacombank | `Sacombank` |
| MSB | `MSB` |
| OCB | `OCB` |

> 📋 Danh sách đầy đủ: [https://sepay.vn/lap-trinh-cong-thanh-toan.html](https://sepay.vn/lap-trinh-cong-thanh-toan.html) (mục 2.2.2.1)

---

## 7. Checklist trước khi go-live

```
□ Tài khoản Sepay đã đăng ký + verify email
□ Đã liên kết ít nhất 1 tài khoản ngân hàng (SePay cần vài phút để sync)
□ Đã tạo webhook với URL HTTPS production (KHÔNG dùng trycloudflare.com)
□ Đã chọn auth method (HMAC-SHA256 khuyến nghị)
□ Đã copy Secret/API Key vào .env
□ Đã verify webhook URL phản hồi 200 + {"success":true}
□ Đã test bằng "Gửi thử" trên dashboard → log server OK
□ Đã test bằng CK thật 1đ → đơn tự động paid
□ Đã test:
    □ Happy path: CK đúng số tiền → paid
    □ Sai tiền: CK thiếu/thừa → pending (no-op)
    □ Duplicate: CK 2 lần cùng mã → chỉ paid 1 lần
    □ Wrong account: CK vào STK khác → no-op
    □ Auth fail: gửi webhook với HMAC sai → 401
□ Đã backup Secret/API Key ở nơi an toàn (1password, vault, ...)
□ Đã setup monitoring (log alert khi webhook 5xx, payment fail, ...)
□ KHÔNG commit .env vào git (.gitignore đã có .env.local)
□ Có plan rotate secret định kỳ (3-6 tháng/lần)
```

---

## 8. Lỗi thường gặp & cách xử lý nhanh

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|-------------|------------------------|-------------|
| Webhook 401 với HMAC "đúng" | Secret trong `.env` không khớp với dashboard | Re-copy secret từ dashboard, restart server |
| Webhook 200 nhưng đơn không paid | `content` không chứa order code đúng format | Xem log `[SEPAY_PROCESSED]` → action = ? |
| Webhook 401, log `signature_mismatch` | Body bị parse JSON trước khi verify HMAC | **Đọc raw body trước**, verify HMAC, parse JSON sau |
| `relation "payments" does not exist` | Chưa chạy migration | `npx drizzle-kit push --force` |
| `[SEPAY_CONFIG_INVALID]` | Thiếu 1 trong các env bắt buộc | Đọc log chi tiết, check `.env.local` |
| `[SEPAY_AUTH_FAILED]` + `invalid_timestamp` | Server clock lệch > 5 phút | Sync NTP: `w32tm /resync` (Windows) |
| Tunnel hết hạn, Sepay không gọi được | Cloudflare Tunnel URL đổi mỗi lần restart | Chạy lại tunnel, update webhook URL trên dashboard |
| Đơn paid rồi nhưng frontend không update | Polling bị block / cache | Check tab Network F12, xem `/api/payments/.../status` |
| SePay không gọi webhook khi CK thật | Ngân hàng chưa link xong / SePay chưa sync | Đợi thêm 5-10 phút, kiểm tra dashboard có thấy giao dịch không |

### Log format để debug

Khi dev local, bật verbose:
```env
DEBUG=sepay:*
```

Mọi log SePay sẽ có format:
- `[SEPAY_DISABLED]` — Server chưa bật (SEPAY_ENABLED != true)
- `[SEPAY_CONFIG_INVALID]` — Env sai/thiếu
- `[SEPAY_AUTH_FAILED]` — Verify auth fail (401)
- `[SEPAY_INVALID_JSON]` — Body không phải JSON
- `[SEPAY_WRONG_ACCOUNT]` — STK trong payload khớp dashboard (no-op)
- `[SEPAY_PROCESSED]` — Xử lý OK, xem `action` để biết kết quả
- `[SEPAY_DB_ERROR]` — DB exception
- `[SEPAY_INTERNAL_ERROR]` — Lỗi không mong đợi, trả 500

---

## 9. Khi nào cần đọc file `SEPAY-DEV-GUIDE.md`

| Bạn muốn... | Đọc file nào |
|-------------|--------------|
| Hiểu SePay là gì, chọn cách tích hợp | **SEPAY-SETUP.md** (file này) |
| Cấu hình dashboard `my.sepay.vn` | **SEPAY-SETUP.md** (file này) |
| Setup Cloudflare Tunnel cho local dev | **SEPAY-SETUP.md** (file này) |
| Setup env vars | **SEPAY-SETUP.md** (file này) |
| **Hiểu code structure** (`lib/sepay/*.ts`) | **SEPAY-DEV-GUIDE.md** |
| **Hiểu flow xử lý webhook** | **SEPAY-DEV-GUIDE.md** |
| **Tự implement** SePay cho dự án mới | **SEPAY-DEV-GUIDE.md** |
| **Debug lỗi** ở mức code (DB, race condition, idempotency) | **SEPAY-DEV-GUIDE.md** |
| **Viết test** cho webhook | **SEPAY-DEV-GUIDE.md** |
| **Customize** schema, flow, thêm tính năng | **SEPAY-DEV-GUIDE.md** |

**Tóm lại:**
- 📖 **PM / Dev mới vào dự án** → đọc file này (`SEPAY-SETUP.md`) trước
- 💻 **Dev cần code** → đọc thêm `SEPAY-DEV-GUIDE.md`

---

## Tóm tắt 1 phút

```
1. SePay = trung gian ngân hàng VN, free %, tiền vào TK bạn
2. Cách 1 (Webhook) phù hợp landing page / bán hàng nhỏ
3. Đăng ký my.sepay.vn → link NH → tạo webhook URL + Secret
4. Local dev: dùng Cloudflare Tunnel (free HTTPS, 1 lệnh)
5. Set env vars: SEPAY_ENABLED, BANK_CODE/ACCOUNT/NAME, AUTH_METHOD, SECRET/API_KEY
6. Test: "Gửi thử" trên dashboard → CK thật 1đ
7. Production: domain thật + hosting (KHÔNG dùng tunnel)
```

**Câu hỏi?** → Đọc [SEPAY-DEV-GUIDE.md](./SEPAY-DEV-GUIDE.md) hoặc hỏi team lead.
