"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, start] = useTransition();

  return (
    <button
      disabled={busy}
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        start(() => {
          router.replace("/admin/login");
          router.refresh();
        });
      }}
      className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
    >
      Đăng xuất
    </button>
  );
}
