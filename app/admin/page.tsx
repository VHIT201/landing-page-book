import { listOrders } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";
import AdminOrderRow from "./AdminOrderRow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  preparing: "Đang đóng gói",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã huỷ",
  refunded: "Hoàn tiền",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as OrderStatus)
    : undefined;

  const { rows, total, page, pageSize } = await listOrders({
    status,
    q: sp.q,
    page: Number(sp.page ?? 1),
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 font-sans text-sm text-neutral-800">
      <h1 className="text-xl font-bold">Đơn hàng — THE LIFECAR</h1>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Tìm mã / SĐT / tên"
          className="rounded border border-neutral-300 px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Tất cả trạng thái</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="rounded bg-neutral-900 px-4 py-1.5 font-semibold text-white">
          Lọc
        </button>
        <span className="self-center text-neutral-500">{total} đơn</span>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b-2 border-neutral-300 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-2 pr-3">Mã / Ngày</th>
              <th className="py-2 pr-3">Khách</th>
              <th className="py-2 pr-3">Địa chỉ</th>
              <th className="py-2 pr-3">SL / Tổng</th>
              <th className="py-2 pr-3">Trạng thái</th>
              <th className="py-2 pr-3">Vận chuyển</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-neutral-400">
                  Chưa có đơn
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <AdminOrderRow
                key={o.id}
                order={{
                  id: o.id,
                  code: o.code,
                  createdAt: o.createdAt.toISOString(),
                  customerName: o.customerName,
                  customerPhone: o.customerPhone,
                  addressLine: o.addressLine,
                  quantity: o.quantity,
                  totalAmount: o.totalAmount,
                  status: o.status,
                  carrier: o.carrier,
                  trackingNo: o.trackingNo,
                  adminNote: o.adminNote,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex gap-1">
          {Array.from({ length: pages }).map((_, i) => {
            const p = i + 1;
            const params = new URLSearchParams();
            if (sp.q) params.set("q", sp.q);
            if (sp.status) params.set("status", sp.status);
            params.set("page", String(p));
            return (
              <a
                key={p}
                href={`/admin?${params}`}
                className={`rounded border px-3 py-1 ${
                  p === page
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300"
                }`}
              >
                {p}
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}
