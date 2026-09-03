import { NextResponse } from "next/server";
import { getOrderByCode, getOrderHistory } from "@/lib/orders";

export const runtime = "nodejs";

/**
 * Tra cứu đơn cho khách — cần 4 số cuối SĐT.
 * GET /api/orders/LC-XXXXXX?phone=1234
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const phone4 = new URL(req.url).searchParams.get("phone")?.trim();

  const order = await getOrderByCode(code);
  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  }
  if (!phone4 || !/^\d{4}$/.test(phone4) || !order.customerPhone.endsWith(phone4)) {
    return NextResponse.json(
      { error: "Cần đúng 4 số cuối điện thoại để xem đơn" },
      { status: 403 },
    );
  }

  const history = await getOrderHistory(order.id);

  return NextResponse.json({
    code: order.code,
    status: order.status,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    shippingFee: order.shippingFee,
    totalAmount: order.totalAmount,
    customerName: order.customerName,
    addressLine: order.addressLine,
    carrier: order.carrier,
    trackingNo: order.trackingNo,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    history: history.map((h) => ({
      toStatus: h.toStatus,
      actor: h.actor,
      createdAt: h.createdAt,
    })),
  });
}
