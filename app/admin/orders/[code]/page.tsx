import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByCode, getOrderHistory } from "@/lib/orders";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/orderStatus";
import AdminOrderEditor from "./AdminOrderEditor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await getOrderByCode(code);
  if (!order) notFound();
  const history = await getOrderHistory(order.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-sm">
      <Link href="/admin" className="text-blue-700 hover:underline">
        ← Danh sách
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold">{order.code}</h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[order.status]}`}
        >
          {STATUS_LABEL[order.status]}
        </span>
        <span className="text-neutral-400">
          {new Date(order.createdAt).toLocaleString("vi-VN")}
        </span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* thông tin */}
        <section className="rounded border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Khách hàng</h2>
          <dl className="mt-2 space-y-1">
            <Row k="Họ tên" v={order.customerName} />
            <Row k="Điện thoại" v={order.customerPhone} />
            <Row k="Địa chỉ" v={order.addressLine} />
            <Row k="Chi tiết" v={order.addressDetail ?? "—"} />
            <Row
              k="Hành chính"
              v={[order.wardName, order.districtName, order.provinceName]
                .filter(Boolean)
                .join(" · ")}
            />
          </dl>

          <h2 className="mt-4 font-semibold">Đơn</h2>
          <dl className="mt-2 space-y-1">
            <Row k="Số lượng" v={String(order.quantity)} />
            <Row k="Đơn giá" v={`${fmt(order.unitPrice)}đ`} />
            <Row k="Phí ship" v={`${fmt(order.shippingFee)}đ`} />
            <Row
              k="Tổng"
              v={<b>{fmt(order.totalAmount)}đ</b>}
            />
            <Row
              k="Thanh toán"
              v={order.paidAt ? new Date(order.paidAt).toLocaleString("vi-VN") : "Chưa"}
            />
          </dl>
        </section>

        {/* chỉnh sửa */}
        <AdminOrderEditor
          id={order.id}
          status={order.status}
          carrier={order.carrier}
          trackingNo={order.trackingNo}
          adminNote={order.adminNote}
        />
      </div>

      {/* timeline */}
      <section className="mt-6 rounded border border-neutral-200 bg-white p-4">
        <h2 className="font-semibold">Lịch sử trạng thái</h2>
        <ol className="mt-3 space-y-2">
          {history.map((h) => (
            <li key={h.id} className="flex items-center gap-3">
              <span className="text-neutral-400">
                {new Date(h.createdAt).toLocaleString("vi-VN")}
              </span>
              <span className="font-medium">
                {STATUS_LABEL[h.toStatus]}
              </span>
              <span className="text-xs text-neutral-400">({h.actor})</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-neutral-500">{k}</dt>
      <dd className="text-neutral-800">{v}</dd>
    </div>
  );
}
