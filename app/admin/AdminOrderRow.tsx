"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  preparing: "Đang đóng gói",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã huỷ",
  refunded: "Hoàn tiền",
};

type Row = {
  id: string;
  code: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  addressLine: string;
  quantity: number;
  totalAmount: number;
  status: OrderStatus;
  carrier: string | null;
  trackingNo: string | null;
  adminNote: string | null;
};

export default function AdminOrderRow({ order }: { order: Row }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [trackingNo, setTrackingNo] = useState(order.trackingNo ?? "");
  const [adminNote, setAdminNote] = useState(order.adminNote ?? "");
  const [err, setErr] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>) {
    setErr(null);
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Lỗi cập nhật");
      return;
    }
    start(() => router.refresh());
  }

  return (
    <>
      <tr className="border-b border-neutral-200 align-top">
        <td className="py-2 pr-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="font-mono font-semibold underline decoration-dotted"
          >
            {order.code}
          </button>
          <div className="text-xs text-neutral-400">
            {new Date(order.createdAt).toLocaleString("vi-VN")}
          </div>
        </td>
        <td className="py-2 pr-3">
          {order.customerName}
          <div className="text-xs text-neutral-500">{order.customerPhone}</div>
        </td>
        <td className="max-w-[220px] py-2 pr-3 text-neutral-600">
          {order.addressLine}
        </td>
        <td className="py-2 pr-3 tabular-nums">
          {order.quantity} ·{" "}
          <span className="font-semibold">
            {order.totalAmount.toLocaleString("vi-VN")}đ
          </span>
        </td>
        <td className="py-2 pr-3">
          <select
            value={order.status}
            disabled={pending}
            onChange={(e) => patch({ status: e.target.value })}
            className="rounded border border-neutral-300 px-2 py-1"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 pr-3 text-xs text-neutral-500">
          {order.carrier || "—"}
          {order.trackingNo ? ` · ${order.trackingNo}` : ""}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-neutral-200 bg-neutral-50">
          <td colSpan={6} className="px-3 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs">
                Hãng vận chuyển
                <input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="mt-1 block rounded border border-neutral-300 px-2 py-1"
                />
              </label>
              <label className="text-xs">
                Mã vận đơn
                <input
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  className="mt-1 block rounded border border-neutral-300 px-2 py-1"
                />
              </label>
              <label className="text-xs grow">
                Ghi chú
                <input
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
                />
              </label>
              <button
                disabled={pending}
                onClick={() => patch({ carrier, trackingNo, adminNote })}
                className="rounded bg-neutral-900 px-4 py-1.5 font-semibold text-white"
              >
                Lưu
              </button>
            </div>
            {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
