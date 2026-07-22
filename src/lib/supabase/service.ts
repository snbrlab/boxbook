import { createClient } from "@supabase/supabase-js";

// service_role: RLS 우회. 서버 전용. 절대 클라이언트 번들에 들어가면 안 된다.
// next/headers를 import하지 않으므로 middleware(edge)에서도 쓸 수 있다.
export function supabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// 관리자 판정의 단일 진실. RLS/세션 타이밍에 영향받지 않도록 service_role로 확정 조회한다.
// (로그인 직후에는 새 세션 쿠키가 아직 안 읽혀 anon으로 나가는 경우가 있어 RLS 조회는 신뢰할 수 없다)
export async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabaseService().from("admins").select("id").eq("id", userId).maybeSingle();
  return !!data;
}
