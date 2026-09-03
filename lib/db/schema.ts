import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Trạng thái đơn:
 * pending_payment  – vừa tạo, chờ thanh toán (sau này gắn SePay)
 * paid             – đã thanh toán / xác nhận thủ công
 * preparing        – đang đóng gói
 * shipping         – đã bàn giao vận chuyển
 * delivered        – khách đã nhận
 * cancelled        – huỷ
 * refunded         – hoàn tiền
 */
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "preparing",
  "shipping",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Trạng thái payment (tách khỏi order status):
 * pending  – đơn tạo, chờ thanh toán
 * paid     – webhook xác nhận thanh toán thành công
 * refunded – admin hoàn tiền
 * failed   – webhook xử lý nhưng lỗi logic (amount mismatch, ...)
 *
 * Một order chỉ có 1 payment record active tại một thời điểm.
 * Khi admin refund, payment chuyển sang refunded nhưng order status
 * có thể vẫn giữ 'paid' hoặc admin chuyển sang 'refunded'.
 */
export const PAYMENT_STATUSES = ["pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Provider xử lý payment. Hiện chỉ có "sepay". */
export const PAYMENT_PROVIDERS = ["sepay"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const orders = pgTable("orders", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(), // LC-A1B2C3
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),

  // địa chỉ giao — hành chính VN + chi tiết
  provinceCode: text("province_code"),
  provinceName: text("province_name"),
  districtCode: text("district_code"),
  districtName: text("district_name"),
  wardCode: text("ward_code"),
  wardName: text("ward_name"),
  addressDetail: text("address_detail"), // số nhà, tên đường
  addressLine: text("address_line").notNull(), // chuỗi đầy đủ đã ghép, để hiển thị nhanh

  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(), // chốt ở server
  shippingFee: integer("shipping_fee").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),

  status: text("status").notNull().$type<OrderStatus>().default("pending_payment"),
  paidAt: timestamp("paid_at", { withTimezone: true }),

  // vận chuyển — bạn tự liên hệ hãng rồi điền
  carrier: text("carrier"),
  trackingNo: text("tracking_no"),

  adminNote: text("admin_note"),
  source: text("source"), // utm / ref
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status").$type<OrderStatus>(),
  toStatus: text("to_status").notNull().$type<OrderStatus>(),
  actor: text("actor").notNull(), // 'system' | 'admin' | 'sepay'
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Payment record — 1 record per order, lifecycle tách khỏi order.
 *
 * Lưu ý thiết kế:
 * - Không tạo bảng riêng `sepay_transactions` — gộp vào `payments`.
 *   Lý do: bảng `payments` đã đủ các cột cần từ Sepay
 *   (gateway, transaction_id, reference_code, content). Tránh duplicate state.
 * - `provider`: hiện chỉ 'sepay' nhưng để enum để dễ mở rộng.
 * - UNIQUE(sepay_transaction_id): đảm bảo 1 transaction_id chỉ confirm 1 lần.
 * - UNIQUE(order_id) WHERE status != 'failed':
 *   Một order có thể có nhiều payment 'failed' (retry test) nhưng chỉ 1 active.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    provider: text("provider").notNull().$type<PaymentProvider>().default("sepay"),
    amount: integer("amount").notNull(), // expected amount = order.total_amount
    currency: text("currency").notNull().default("VND"),

    status: text("status").notNull().$type<PaymentStatus>().default("pending"),

    // ==== SePay specific (NULL nếu chưa có webhook) ====
    sepayTransactionId: bigint("sepay_transaction_id", { mode: "number" }),
    sepayGateway: text("sepay_gateway"),
    sepayAccountNumber: text("sepay_account_number"),
    sepayContent: text("sepay_content"), // raw content từ webhook (chứa LC-XXXXXX)
    sepayReferenceCode: text("sepay_reference_code"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    txIdUnique: uniqueIndex("payments_sepay_transaction_id_unique").on(
      t.sepayTransactionId,
    ),
    // Partial UNIQUE: chỉ enforce uniqueness cho payment đang active.
    // 'failed' cho phép có nhiều record (test retry scenarios).
    orderIdActiveUnique: uniqueIndex("payments_order_id_active_unique")
      .on(t.orderId)
      .where(sql`status <> 'failed'`),
    orderIdIdx: index("payments_order_id_idx").on(t.orderId),
  }),
);

/**
 * SePay webhook logs — ghi lại MỌI lần SePay gọi webhook.
 *
 * Mục đích:
 * 1. Idempotency: UNIQUE(transaction_id) → INSERT ON CONFLICT DO NOTHING
 *    → biết ngay đã xử lý chưa.
 * 2. Audit: tra xem tại sao đơn A lại paid, đơn B lại không.
 * 3. Debug: xem raw payload khi có issue.
 * 4. Forensics: phân tích lỗi, race, replay, ...
 */
export const sepayWebhookLogs = pgTable(
  "sepay_webhook_logs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    transactionId: bigint("transaction_id", { mode: "number" }).notNull(),

    rawPayload: jsonb("raw_payload").notNull(),

    // Hành động: payment_confirmed | duplicate | amount_mismatch |
    // order_not_found | wrong_transfer_type | wrong_account | ...
    action: text("action").notNull(),

    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),

    // Denormalized cho dễ debug (không cần join).
    orderCode: text("order_code"),

    errorMessage: text("error_message"),

    success: text("success").notNull().default("false"),

    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    txIdUnique: uniqueIndex("sepay_webhook_logs_transaction_id_unique").on(
      t.transactionId,
    ),
    orderIdIdx: index("sepay_webhook_logs_order_id_idx").on(t.orderId),
    processedAtIdx: index("sepay_webhook_logs_processed_at_idx").on(t.processedAt),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type NewOrderStatusHistory = typeof orderStatusHistory.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type SepayWebhookLog = typeof sepayWebhookLogs.$inferSelect;
export type NewSepayWebhookLog = typeof sepayWebhookLogs.$inferInsert;
