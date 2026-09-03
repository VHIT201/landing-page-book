# Development Checklist — Trước khi PR

Dành cho developer/agent thay đổi SePay code.

## Trước khi viết code

- [ ] Đọc SKILL.md + references/architecture.md
- [ ] Hiểu business rules trong references/payment-rules.md
- [ ] Xác định: thay đổi này thuộc rule nào?

## Trong khi code

- [ ] Tôn trọng "File ownership" trong SKILL.md
- [ ] KHÔNG touch `lib/auth.ts`, `middleware.ts`, `lib/notify.ts` (trừ cần)
- [ ] Nếu cần sửa schema: check migration impact
- [ ] Nếu thay đổi behavior: update tests trước
- [ ] Log prefix `[SEPAY_*]` để dễ debug

## Trước khi tạo PR

- [ ] `pnpm build` pass
- [ ] `node --test lib/sepay/__tests__/matcher.test.mjs` pass
- [ ] Nếu thay schema: `pnpm db:push` thành công
- [ ] Nếu thay đổi webhook: cập nhật `references/webhook.md`
- [ ] Nếu thay đổi rule: cập nhật `references/payment-rules.md`
- [ ] Manual test:
  - [ ] Order created → QR shown
  - [ ] Webhook fires → order paid
  - [ ] Duplicate webhook → no double payment
  - [ ] Wrong amount → order not paid, log mismatch
  - [ ] Admin panel shows payment info

## Sau khi deploy

- [ ] Monitor Sepay dashboard delivery history
- [ ] Monitor DB: `SELECT COUNT(*) FROM payments WHERE status='paid'`
- [ ] Nếu có issue → xem references/troubleshooting.md
