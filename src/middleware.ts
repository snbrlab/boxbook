import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// /admin/* 보호. 관리자 판정은 서버에서: Supabase Auth 세션 + admins 테이블 존재 확인.
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", req.url));
  const { data: admin } = await supabase.from("admins").select("id").eq("id", user.id).maybeSingle();
  if (!admin) return NextResponse.redirect(new URL("/admin/login", req.url));
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
