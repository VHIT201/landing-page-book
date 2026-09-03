import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

// Basic Auth tạm thời cho khu vực admin.
// Nâng cấp lên Supabase Auth / NextAuth ở phase sau.
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD;

  // chưa đặt mật khẩu → khoá cứng, tránh lộ dữ liệu
  if (!pass) {
    return new NextResponse("Admin chưa cấu hình ADMIN_PASSWORD", {
      status: 503,
    });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [u, p] = atob(header.slice(6)).split(":");
    if (safeEqual(u, user) && safeEqual(p, pass)) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Cần đăng nhập", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
