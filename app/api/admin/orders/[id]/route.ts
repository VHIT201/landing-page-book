import { NextResponse } from "next/server";
import { setOrderStatus, updateOrderFields } from "@/lib/orders";
import { updateOrderSchema } from "@/lib/validation";

export const runtime = "nodejs";

// PATCH /api/admin/orders/:id  — đổi status và/hoặc field vận chuyển
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { status, ...fields } = parsed.data;

  let order = null;
  if (
    fields.carrier !== undefined ||
    fields.trackingNo !== undefined ||
    fields.adminNote !== undefined
  ) {
    order = await updateOrderFields(id, {
      carrier: fields.carrier ?? null,
      trackingNo: fields.trackingNo ?? null,
      adminNote: fields.adminNote ?? null,
    });
  }
  if (status) {
    order = await setOrderStatus(id, status, "admin");
  }

  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  }
  return NextResponse.json(order);
}
