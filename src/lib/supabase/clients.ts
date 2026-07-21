import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 관리자용: Supabase Auth 세션을 쿠키에서 읽는 SSR 클라이언트. auth.uid() = admins.id
export async function supabaseAdminSession() {
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}

// 회원용: 우리가 서명한 JWT(sub=member_id)를 Bearer로 붙인 클라이언트. RLS의 auth.uid()=member_id.
export function supabaseAsMember(memberJwt: string) {
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${memberJwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// service_role: RLS 우회. Cron 등 서버 전용 경로에서만. 절대 클라이언트로 내보내지 않는다.
export function supabaseService() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
