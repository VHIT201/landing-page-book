import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";

export const runtime = "nodejs";

// /middleware.ts đã chặn /api/admin bằng basic auth
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const statusRaw = sp.get("status") ?? undefined;
  const status =
    statusRaw && (ORDER_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as OrderStatus)
      : undefined;

  const data = await listOrders({
    status,
    q: sp.get("q") ?? undefined,
    page: Number(sp.get("page") ?? 1),
  });

  return NextResponse.json(data);
}
