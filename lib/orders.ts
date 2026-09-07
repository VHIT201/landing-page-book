import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "./db";
import {
  type Order,
  type OrderStatus,
  type Payment,
  type SepayWebhookLog,
  type NewPayment,
  type PaymentStatus,
  type PaymentProvider,
  orders,
  payments,
  sepayWebhookLogs,
  orderStatusHistory,
} from "./db/schema";
import type { CreateOrderInput } from "./validation";

const UNIT_PRICE = Number(process.env.PRICE_UNIT ?? 198000);
const SHIPPING_FLAT = Number(process.env.SHIPPING_FLAT ?? 0);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ ký tự dễ nhầm

function genCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `LC-${s}`;
}

export function priceQuote(quantity: number) {
  const unitPrice = UNIT_PRICE;
  const shippingFee = SHIPPING_FLAT;
  const totalAmount = unitPrice * quantity + shippingFee;
  return { unitPrice, shippingFee, totalAmount };
}

function composeAddress(i: CreateOrderInput): string {
  return [i.addressDetail, i.ward.name, i.district.name, i.province.name]
    .filter(Boolean)
    .join(", ");
}

/**
 * Tạo order + payment record trong CÙNG transaction.
 *
 * Trước đây `createOrder` không dùng transaction → race condition có thể
 * tạo order mà không có history. Phase SePay đã vá lỗi này:
 * - Insert order + payment + history atomic.
 * - Nếu bất kỳ step nào fail → rollback toàn bộ.
 *
 * Lưu ý: Drizzle 0.45 với postgres-js dùng callback-style transaction.
 * Đảm bảo db index hoạt động đúng với Neon's pool.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { unitPrice, shippingFee, totalAmount } = priceQuote(input.quantity);
  const addressLine = composeAddress(input);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    try {
      const result = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(orders)
          .values({
            code,
            customerName: input.name,
            customerPhone: input.phone,
            provinceCode: input.province.code,
            provinceName: input.province.name,
            districtCode: input.district.code,
            districtName: input.district.name,
            wardCode: input.ward.code,
            wardName: input.ward.name,
            addressDetail: input.addressDetail,
            addressLine,
            quantity: input.quantity,
            unitPrice,
            shippingFee,
            totalAmount,
            status: "pending_payment",
            source: input.source ?? null,
          })
          .returning();

        await tx.insert(orderStatusHistory).values({
          orderId: row.id,
          fromStatus: null,
          toStatus: "pending_payment",
          actor: "system",
        });

        await tx.insert(payments).values({
          orderId: row.id,
          provider: "sepay" as PaymentProvider,
          amount: totalAmount,
          currency: "VND",
          status: "pending" as PaymentStatus,
        });

        return row;
      });
      return result;
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? "");
      // Retry chỉ khi collision code (rất hiếm với 32^6 = ~1 tỷ codes)
      if (msg.includes("orders_code_unique") || msg.includes("duplicate key")) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Không sinh được mã đơn duy nhất");
}

export async function setOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  actor: "admin" | "system" | "sepay",
): Promise<Order | null> {
  const [current] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!current) return null;
  if (current.status === toStatus) return current;

  const patch: Partial<Order> = { status: toStatus, updatedAt: new Date() };
  if (toStatus === "paid" && !current.paidAt) patch.paidAt = new Date();

  const [row] = await db
    .update(orders)
    .set(patch)
    .where(eq(orders.id, orderId))
    .returning();

  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: current.status,
    toStatus,
    actor,
  });

  return row;
}

export async function updateOrderFields(
  orderId: string,
  fields: Partial<Pick<Order, "carrier" | "trackingNo" | "adminNote">>,
): Promise<Order | null> {
  const [row] = await db
    .update(orders)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return row ?? null;
}

export async function listOrders(opts: {
  status?: OrderStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 30);

  const filters = [];
  if (opts.status) filters.push(eq(orders.status, opts.status));
  if (opts.q) {
    const like = `%${opts.q}%`;
    filters.push(
      or(
        ilike(orders.code, like),
        ilike(orders.customerPhone, like),
        ilike(orders.customerName, like),
      ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(where);

  return { rows, total: count, page, pageSize };
}

export async function getOrderByCode(code: string): Promise<Order | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(eq(orders.code, code.toUpperCase()));
  return row ?? null;
}

export async function getOrderHistory(orderId: string) {
  return db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(orderStatusHistory.createdAt);
}

/**
 * Lấy payment theo orderId (active payment, status != failed).
 */
export async function getActivePaymentByOrder(orderId: string): Promise<Payment | null> {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), sql`${payments.status} <> 'failed'`));
  return row ?? null;
}

/**
 * Lấy payment + order status cho endpoint polling.
 * Trả về shape gọn.
 */
export async function getPaymentStatusForOrder(
  orderCode: string,
): Promise<
  | {
      orderStatus: OrderStatus;
      paymentStatus: PaymentStatus;
      amount: number;
      paidAt: Date | null;
      provider: string | null;
    }
  | null
> {
  const order = await getOrderByCode(orderCode);
  if (!order) return null;
  const payment = await getActivePaymentByOrder(order.id);
  return {
    orderStatus: order.status,
    paymentStatus: (payment?.status ?? "pending") as PaymentStatus,
    amount: order.totalAmount,
    paidAt: payment?.paidAt ?? null,
    provider: payment?.provider ?? null,
  };
}

export async function getStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totals] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalAmount}) filter (where ${orders.status} in ('paid','preparing','shipping','delivered')), 0)::bigint`,
      today: sql<number>`count(*) filter (where ${orders.createdAt} >= ${startOfDay.toISOString()})::int`,
    })
    .from(orders);

  const byStatusRows = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .groupBy(orders.status);

  const byStatus: Record<string, number> = {};
  for (const r of byStatusRows) byStatus[r.status] = r.count;

  return {
    totalOrders: totals?.totalOrders ?? 0,
    revenue: Number(totals?.revenue ?? 0),
    today: totals?.today ?? 0,
    byStatus,
  };
}

/**
 * Lấy danh sách webhook logs (phân trang) — cho admin debug.
 */
export async function listSepayWebhookLogs(opts: { limit?: number; offset?: number }) {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = await db
    .select()
    .from(sepayWebhookLogs)
    .orderBy(desc(sepayWebhookLogs.processedAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

/**
 * Lấy payment có sepay transaction_id cụ thể (dùng cho dedup).
 */
export async function getPaymentBySepayTransactionId(
  transactionId: number,
): Promise<Payment | null> {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.sepayTransactionId, transactionId));
  return row ?? null;
}

/**
 * Lấy webhook log theo transaction_id (dùng cho idempotency).
 */
export async function getWebhookLogByTransactionId(
  transactionId: number,
): Promise<SepayWebhookLog | null> {
  const [row] = await db
    .select()
    .from(sepayWebhookLogs)
    .where(eq(sepayWebhookLogs.transactionId, transactionId));
  return row ?? null;
}

/**
 * Mark payment FAILED (cho edge case webhook xử lý nhưng lỗi logic).
 * KHÔNG update order status.
 */
export async function markPaymentFailed(
  paymentId: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await db
    .update(payments)
    .set({
      status: "failed",
      updatedAt: new Date(),
      sepayContent: meta.content ? String(meta.content) : null,
    })
    .where(eq(payments.id, paymentId));
}

/**
 * Expose schema cho callers muốn dùng drizzle.
 */
export { schema };
