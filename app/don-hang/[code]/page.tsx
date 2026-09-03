"use client";

import { use, useEffect, useRef, useState } from "react";
import { STATUS_FLOW, STATUS_LABEL } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/schema";

type PaymentView = {
  status: "pending" | "paid" | "refunded" | "failed";
  provider: string | null;
  paidAt: string | null;
  gateway: string | null;
  transactionId: number | null;
  referenceCode: string | null;
};

type OrderView = {
  code: string;
  status: OrderStatus;
  quantity: number;
  unitPrice: number;
  shippingFee: number;
  totalAmount: number;
  customerName: string;
  addressLine: string;
  carrier: string | null;
  trackingNo: string | null;
  createdAt: string;
  paidAt: string | null;
  payment: PaymentView | null;
  history: { toStatus: OrderStatus; actor: string; createdAt: string }[];
};

type PollStatus = {
  code: string;
  orderStatus: OrderStatus;
  paymentStatus: "pending" | "paid" | "refunded" | "failed";
  amount: number;
  provider: string | null;
  paidAt: string | null;
};

export default function CustomerOrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(
      `/api/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`,
    );
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data?.error ?? "Không tra được đơn");
      setOrder(null);
      return;
    }
    setOrder(data);
  }

  // === Polling payment status (khi order.pending_payment) ===
  // Polling 5s. Stop khi paid hoặc unmount.
  const pollStopRef = useRef(false);
  useEffect(() => {
    pollStopRef.current = false;
    if (!order) return;
    if (order.status !== "pending_payment") return;
    if (order.payment?.status === "paid") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      if (pollStopRef.current) return;
      try {
        const res = await fetch(
          `/api/payments/${encodeURIComponent(code)}/status`,
          { cache: "no-store" },
        );
        if (pollStopRef.current) return;
        if (res.ok) {
          const data = (await res.json()) as PollStatus;
          if (data.paymentStatus === "paid" || data.orderStatus === "paid") {
            // Cập nhật UI — reload data
            // Re-fetch lookup nếu cần
            // Ở đây đơn giản: hiển thị "Đã thanh toán" hint + nút refresh
            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    status: "paid",
                    paidAt: data.paidAt ?? new Date().toISOString(),
                  }
                : prev,
            );
            return;
          }
        }
      } catch {
        // ignore
      }
      if (!pollStopRef.current) {
        timer = setTimeout(tick, 5000);
      }
    }

    tick();

    return () => {
      pollStopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [order?.status, order?.payment?.status, code]);

  const fmt = (n: number) => n.toLocaleString("vi-VN");

  return (
    <main className="mx-auto max-w-lg px-5 py-16 font-sans text-neutral-800">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
        THE LIFECAR
      </p>
      <h1 className="mt-1 text-2xl font-bold">
        Tra cứu đơn{" "}
        <span className="font-mono">{code}</span>
      </h1>

      {!order && (
        <form onSubmit={lookup} className="mt-6 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={4}
            placeholder="4 số cuối SĐT"
            className="w-40 rounded border border-neutral-300 px-3 py-2"
          />
          <button
            disabled={busy || phone.length !== 4}
            className="rounded bg-neutral-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Xem"}
          </button>
        </form>
      )}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {order && (
        <div className="mt-8 space-y-6">
          {/* payment banner */}
          {order.status === "pending_payment" && (
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Đang chờ thanh toán</p>
              <p className="mt-1 text-xs">
                Vui lòng CK theo mã đơn{" "}
                <span className="font-mono font-bold">{order.code}</span> với số tiền{" "}
                <b>{fmt(order.totalAmount)}đ</b>. Trang sẽ tự cập nhật khi nhận được
                tiền (tối đa 30 giây).
              </p>
            </div>
          )}
          {order.status === "paid" && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">Đã thanh toán ✓</p>
              {order.paidAt && (
                <p className="mt-1 text-xs">
                  Lúc {new Date(order.paidAt).toLocaleString("vi-VN")}
                </p>
              )}
            </div>
          )}

          {/* tiến trình */}
          <ol className="flex items-center">
            {STATUS_FLOW.map((s, i) => {
              const reached =
                STATUS_FLOW.indexOf(order.status) >= i ||
                order.status === "delivered";
              return (
                <li key={s} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                        reached
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-200 text-neutral-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="mt-1 w-16 text-center text-[10px] leading-tight text-neutral-500">
                      {STATUS_LABEL[s]}
                    </span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <span
                      className={`mx-1 h-0.5 flex-1 ${
                        reached ? "bg-neutral-900" : "bg-neutral-200"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {(order.status === "cancelled" || order.status === "refunded") && (
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Đơn: {STATUS_LABEL[order.status]}
            </p>
          )}

          <dl className="rounded border border-neutral-200 bg-white p-4 text-sm">
            <Row k="Người nhận" v={order.customerName} />
            <Row k="Địa chỉ" v={order.addressLine} />
            <Row k="Số lượng" v={String(order.quantity)} />
            <Row k="Tổng tiền" v={<b>{fmt(order.totalAmount)}đ</b>} />
            <Row
              k="Thanh toán"
              v={
                order.payment
                  ? `${order.payment.provider ?? "sepay"} — ${STATUS_LABEL_BY_PAYMENT(order.payment.status)}`
                  : order.paidAt
                    ? "Đã thanh toán"
                    : "Chưa thanh toán"
              }
            />
            {order.payment?.gateway && (
              <Row k="Ngân hàng" v={order.payment.gateway} />
            )}
            {order.payment?.transactionId && (
              <Row
                k="Mã giao dịch"
                v={<span className="font-mono">#{order.payment.transactionId}</span>}
              />
            )}
            {order.carrier && (
              <Row
                k="Vận chuyển"
                v={`${order.carrier}${order.trackingNo ? ` · ${order.trackingNo}` : ""}`}
              />
            )}
          </dl>

          <div className="text-sm">
            <p className="font-semibold">Lịch sử</p>
            <ol className="mt-2 space-y-1 text-neutral-600">
              {order.history.map((h, i) => (
                <li key={i}>
                  {new Date(h.createdAt).toLocaleString("vi-VN")} —{" "}
                  {STATUS_LABEL[h.toStatus]}{" "}
                  <span className="text-xs text-neutral-400">
                    ({h.actor === "sepay" ? "SePay" : h.actor})
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </main>
  );
}

function STATUS_LABEL_BY_PAYMENT(s: PaymentView["status"]): string {
  switch (s) {
    case "paid":
      return "Đã thanh toán";
    case "refunded":
      return "Đã hoàn tiền";
    case "failed":
      return "Thất bại";
    default:
      return "Đang chờ";
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-neutral-100 py-1.5 last:border-0">
      <dt className="w-24 shrink-0 text-neutral-500">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
