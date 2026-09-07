import { NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { notifyOwner } from "@/lib/notify";
import { createOrderSchema } from "@/lib/validation";
import { buildPaymentInstructions, getBankInfo } from "@/lib/sepay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const order = await createOrder(parsed.data);

    notifyOwner(
      `🆕 <b>Đơn mới ${order.code}</b>\n` +
        `${order.customerName} — ${order.customerPhone}\n` +
        `${order.addressLine}\n` +
        `SL ${order.quantity} — <b>${order.totalAmount.toLocaleString("vi-VN")}đ</b>`,
    );

    // Build payment instructions nếu SePay đã được config.
    const bank = getBankInfo();
    const paymentInfo =
      bank && process.env.SEPAY_ENABLED === "true"
        ? buildPaymentInstructions(bank, order.code, order.totalAmount)
        : null;

    return NextResponse.json(
      {
        code: order.code,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        shippingFee: order.shippingFee,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentInfo,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/orders]", err);
    return NextResponse.json(
      { error: "Không tạo được đơn, thử lại sau" },
      { status: 500 },
    );
  }
}
