import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // LC-A1B2C3
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  addressLine: text("address_line").notNull(),

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
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status").$type<OrderStatus>(),
  toStatus: text("to_status").notNull().$type<OrderStatus>(),
  actor: text("actor").notNull(), // 'system' | 'admin' | 'sepay'
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
