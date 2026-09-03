"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";
import { STATUS_LABEL } from "@/lib/orderStatus";

export default function AdminStatusSelect({
  id,
  status,
}: {
  id: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);

  return (
    <select
      value={status}
      disabled={pending}
      onChange={async (e) => {
        setErr(false);
        const res = await fetch(`/api/admin/orders/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: e.target.value }),
        });
        if (!res.ok) {
          setErr(true);
          return;
        }
        start(() => router.refresh());
      }}
      className={`rounded border px-2 py-1 ${
        err ? "border-red-500" : "border-neutral-300"
      }`}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
