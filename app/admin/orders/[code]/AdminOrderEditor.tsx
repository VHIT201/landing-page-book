"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";
import { STATUS_LABEL } from "@/lib/orderStatus";

export default function AdminOrderEditor({
  id,
  status,
  carrier,
  trackingNo,
  adminNote,
}: {
  id: string;
  status: OrderStatus;
  carrier: string | null;
  trackingNo: string | null;
  adminNote: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [st, setSt] = useState<OrderStatus>(status);
  const [c, setC] = useState(carrier ?? "");
  const [t, setT] = useState(trackingNo ?? "");
  const [n, setN] = useState(adminNote ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: st,
        carrier: c || null,
        trackingNo: t || null,
        adminNote: n || null,
      }),
    });
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({})))?.error ?? "Lỗi lưu");
      return;
    }
    setMsg("Đã lưu");
    start(() => router.refresh());
  }

  return (
    <section className="rounded border border-neutral-200 bg-white p-4">
      <h2 className="font-semibold">Cập nhật</h2>

      <label className="mt-3 block text-xs">
        Trạng thái
        <select
          value={st}
          onChange={(e) => setSt(e.target.value as OrderStatus)}
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-xs">
        Hãng vận chuyển
        <input
          value={c}
          onChange={(e) => setC(e.target.value)}
          placeholder="GHTK, GHN, VNPost…"
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5"
        />
      </label>

      <label className="mt-3 block text-xs">
        Mã vận đơn
        <input
          value={t}
          onChange={(e) => setT(e.target.value)}
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5"
        />
      </label>

      <label className="mt-3 block text-xs">
        Ghi chú nội bộ
        <textarea
          value={n}
          onChange={(e) => setN(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5"
        />
      </label>

      <button
        onClick={save}
        disabled={pending}
        className="mt-4 w-full rounded bg-neutral-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        Lưu
      </button>
      {msg && (
        <p
          className={`mt-2 text-xs ${
            msg === "Đã lưu" ? "text-green-700" : "text-red-600"
          }`}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
