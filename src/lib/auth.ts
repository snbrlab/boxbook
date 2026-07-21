import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// 회원 세션: Supabase JWT Secret으로 직접 서명한 HS256 JWT.
// sub=member_id, role='authenticated' → Supabase RLS의 auth.uid()가 member_id로 잡힌다.
// 향후 Supabase Phone OTP로 승격할 때 이 레이어만 교체하면 된다.

const COOKIE = "gym_member";
const secret = () => new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

export async function issueMemberSession(memberId: string) {
  const jwt = await new SignJWT({ role: "authenticated", sub: memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearMemberSession() {
  (await cookies()).delete(COOKIE);
}

// 반환: { memberId, jwt } | null. jwt는 supabaseAsMember()에 그대로 넘긴다.
export async function getMemberSession() {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return { memberId: payload.sub as string, jwt };
  } catch {
    return null;
  }
}
