"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/admin";
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({})))?.error ?? "Đăng nhập lỗi");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="mx-auto mt-24 max-w-sm px-4 font-sans">
      <h1 className="text-lg font-bold text-neutral-800">Đăng nhập quản trị</h1>
      <p className="mt-1 text-sm text-neutral-500">THE LIFECAR</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Tài khoản
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Mật khẩu
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-neutral-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Đang vào…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
