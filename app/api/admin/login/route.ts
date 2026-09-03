import { NextResponse } from "next/server";
import {
  createSession,
  setSessionCookie,
  verifyCredentials,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { user?: string; pass?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  if (!verifyCredentials(body.user ?? "", body.pass ?? "")) {
    return NextResponse.json(
      { error: "Sai tài khoản hoặc mật khẩu" },
      { status: 401 },
    );
  }

  const token = await createSession();
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
