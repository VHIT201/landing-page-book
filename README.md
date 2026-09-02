# THE LIFECAR — Landing Page

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4.

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Fill data

Tất cả nội dung nằm trong **`content/site.ts`** — sửa text, link, giá, review, FAQ ở đó. Không cần đụng component.

- Ảnh: thả vào `public/images/` (xem `public/images/README.md`).
- Domain SEO: `site.meta.siteUrl`.
- Nhận đơn hàng: đặt URL vào `site.orderForm.action` và nối fetch trong `components/OrderForm.tsx` (`handleSubmit`).

## SEO có sẵn

- `<title>`, meta description, keywords, canonical — `app/layout.tsx`
- OpenGraph + Twitter card
- JSON-LD schema `Book` + `Offer` + `AggregateRating`
- `app/sitemap.ts`, `app/robots.ts`
- `lang="vi"`, heading phân cấp, `alt` ảnh
