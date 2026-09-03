import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export const metadata = { title: "Quản trị — THE LIFECAR" };

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authed = await getSession();

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-800">
      {authed && (
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/admin" className="font-bold">
              THE LIFECAR · Quản trị
            </Link>
            <LogoutButton />
          </div>
        </header>
      )}
      {children}
    </div>
  );
}
