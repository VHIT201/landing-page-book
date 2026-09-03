import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  Order,
  OrderStatus,
  orderStatusHistory,
  orders,
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

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { unitPrice, shippingFee, totalAmount } = priceQuote(input.quantity);
  const addressLine = composeAddress(input);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    try {
      const [row] = await db
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

      await db.insert(orderStatusHistory).values({
        orderId: row.id,
        fromStatus: null,
        toStatus: "pending_payment",
        actor: "system",
      });

      return row;
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? "");
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
