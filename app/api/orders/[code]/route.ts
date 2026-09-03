import { NextResponse } from "next/server";
import { getOrderByCode } from "@/lib/orders";

export const runtime = "nodejs";

/**
 * Tra cứu đơn cho khách — cần 4 số cuối SĐT, không trả PII đầy đủ.
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
  if (!phone4 || !order.customerPhone.endsWith(phone4)) {
    return NextResponse.json(
      { error: "Cần 4 số cuối điện thoại để xem đơn" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    code: order.code,
    status: order.status,
    quantity: order.quantity,
    totalAmount: order.totalAmount,
    carrier: order.carrier,
    trackingNo: order.trackingNo,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  });
}
