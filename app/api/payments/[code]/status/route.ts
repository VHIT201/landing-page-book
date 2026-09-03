/**
 * GET /api/payments/[code]/status
 *
 * Endpoint polling mà frontend gọi mỗi 5s để check thanh toán.
 *
 * Auth: KHÔNG yêu cầu — KHÔNG chứa thông tin nhạy cảm (chỉ status).
 * Rate limit: nên có ở level khác (Vercel default), polling 5s rất nhẹ.
 *
 * Response:
 *   200 { code, orderStatus, paymentStatus, amount, provider, paidAt }
 *   404 { error: "order_not_found" }
 */

import { NextResponse } from "next/server";
import { getPaymentStatusForOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  const status = await getPaymentStatusForOrder(code);

  if (!status) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    code: code.toUpperCase(),
    orderStatus: status.orderStatus,
    paymentStatus: status.paymentStatus,
    amount: status.amount,
    provider: status.provider,
    paidAt: status.paidAt,
  });
}
