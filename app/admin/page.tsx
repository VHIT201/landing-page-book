import Link from "next/link";
import { getStats, listOrders } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";
import { STATUS_LABEL } from "@/lib/orderStatus";
import AdminStatusSelect from "./AdminStatusSelect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as OrderStatus)
    : undefined;

  const [stats, list] = await Promise.all([
    getStats(),
    listOrders({ status, q: sp.q, page: Number(sp.page ?? 1) }),
  ]);
  const { rows, total, page, pageSize } = list;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-sm">
      <h1 className="text-xl font-bold">Đơn hàng</h1>

      {/* stat cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Tổng đơn" value={fmt(stats.totalOrders)} />
        <Card label="Doanh thu (đã TT+)" value={`${fmt(stats.revenue)}đ`} />
        <Card label="Đơn hôm nay" value={fmt(stats.today)} />
        <Card
          label="Chờ thanh toán"
          value={fmt(stats.byStatus["pending_payment"] ?? 0)}
        />
      </div>

      {/* per-status chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusChip active={!status} href="/admin" label={`Tất cả (${total})`} />
        {ORDER_STATUSES.map((s) => (
          <StatusChip
            key={s}
            active={status === s}
            href={`/admin?status=${s}`}
            label={`${STATUS_LABEL[s]} (${stats.byStatus[s] ?? 0})`}
          />
        ))}
      </div>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Tìm mã / SĐT / tên"
          className="rounded border border-neutral-300 px-3 py-1.5"
        />
        <button className="rounded bg-neutral-900 px-4 py-1.5 font-semibold text-white">
          Tìm
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded border border-neutral-200 bg-white">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Mã / Ngày</th>
              <th className="px-3 py-2">Khách</th>
              <th className="px-3 py-2">Địa chỉ</th>
              <th className="px-3 py-2">SL / Tổng</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Vận chuyển</th>
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
              <tr
                key={o.id}
                className="border-b border-neutral-100 align-top last:border-0"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/orders/${o.code}`}
                    className="font-mono font-semibold text-blue-700 hover:underline"
                  >
                    {o.code}
                  </Link>
                  <div className="text-xs text-neutral-400">
                    {new Date(o.createdAt).toLocaleString("vi-VN")}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {o.customerName}
                  <div className="text-xs text-neutral-500">
                    {o.customerPhone}
                  </div>
                </td>
                <td className="max-w-[240px] px-3 py-2 text-neutral-600">
                  {o.addressLine}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {o.quantity} ·{" "}
                  <span className="font-semibold">{fmt(o.totalAmount)}đ</span>
                </td>
                <td className="px-3 py-2">
                  <AdminStatusSelect id={o.id} status={o.status} />
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">
                  {o.carrier || "—"}
                  {o.trackingNo ? ` · ${o.trackingNo}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {Array.from({ length: pages }).map((_, i) => {
            const p = i + 1;
            const params = new URLSearchParams();
            if (sp.q) params.set("q", sp.q);
            if (status) params.set("status", status);
            params.set("page", String(p));
            return (
              <Link
                key={p}
                href={`/admin?${params}`}
                className={`rounded border px-3 py-1 ${
                  p === page
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function StatusChip({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {label}
    </Link>
  );
}
