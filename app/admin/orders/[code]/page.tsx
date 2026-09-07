import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByCode, getOrderHistory, getActivePaymentByOrder } from "@/lib/orders";
import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
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
  const payment = await getActivePaymentByOrder(order.id);

  // 5 webhook logs gần nhất cho đơn này (nếu có).
  const recentLogs = payment
    ? await db
        .select()
        .from(schema.sepayWebhookLogs)
        .where(eq(schema.sepayWebhookLogs.orderId, order.id))
        .orderBy(desc(schema.sepayWebhookLogs.processedAt))
        .limit(5)
    : [];

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
              v={
                order.paidAt
                  ? new Date(order.paidAt).toLocaleString("vi-VN")
                  : "Chưa"
              }
            />
          </dl>

          {/* ==== Payment panel ==== */}
          {payment && (
            <>
              <h2 className="mt-4 font-semibold">Thanh toán (SePay)</h2>
              <dl className="mt-2 space-y-1">
                <Row k="Trạng thái" v={
                  <span className={payment.status === "paid" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700" :
                    payment.status === "failed" ? "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700" :
                    "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"}
                  >
                    {payment.status}
                  </span>
                } />
                <Row k="Số tiền" v={`${fmt(payment.amount)}đ`} />
                {payment.sepayGateway && (
                  <Row k="Ngân hàng" v={payment.sepayGateway} />
                )}
                {payment.sepayTransactionId && (
                  <Row
                    k="Mã giao dịch"
                    v={<span className="font-mono">#{Number(payment.sepayTransactionId)}</span>}
                  />
                )}
                {payment.sepayReferenceCode && (
                  <Row k="Ref code" v={<span className="font-mono">{payment.sepayReferenceCode}</span>} />
                )}
                {payment.sepayContent && (
                  <Row k="Nội dung CK" v={<span className="font-mono">{payment.sepayContent}</span>} />
                )}
                {payment.paidAt && (
                  <Row k="Thời điểm" v={new Date(payment.paidAt).toLocaleString("vi-VN")} />
                )}
              </dl>
            </>
          )}

          {/* ==== Recent webhook logs ==== */}
          {recentLogs.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-600">
                Webhook logs ({recentLogs.length} gần nhất)
              </summary>
              <ol className="mt-2 space-y-1 text-xs">
                {recentLogs.map((l) => (
                  <li key={l.id} className="border-l-2 border-neutral-200 pl-2">
                    <span className="font-mono">#{l.transactionId}</span>{" "}
                    <span className={
                      l.success === "true" ? "text-emerald-700" : "text-rose-700"
                    }>{l.action}</span>
                    <br />
                    <span className="text-neutral-500">
                      {new Date(l.processedAt).toLocaleString("vi-VN")}
                    </span>
                    {l.errorMessage && (
                      <pre className="mt-0.5 whitespace-pre-wrap break-all text-rose-600">
                        {l.errorMessage}
                      </pre>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          )}
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
              <span className="text-xs text-neutral-400">
                ({h.actor === "sepay" ? "SePay" : h.actor})
              </span>
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
