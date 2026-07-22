"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseService, supabaseAsMember } from "@/lib/supabase/clients";
import { issueMemberSession, clearMemberSession, getMemberSession } from "@/lib/auth";
import { rpcMessage } from "@/lib/errors";

type Result =
  | { ok: true; status?: string; waiting_order?: number }
  | { ok: false; error: string; needFullPhone?: boolean };

const digits = (s: string) => s.replace(/\D/g, "");

export async function loginMember(_prev: unknown, form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  const tail = digits(String(form.get("phone_tail") ?? ""));
  if (!name || tail.length !== 4) return { ok: false, error: "이름과 전화번호 뒤 4자리를 입력해 주세요." };

  // 대조는 service_role로 (로그인 전이라 세션 없음).
  const svc = supabaseService();
  const { data } = await svc.from("members").select("id, phone, is_active").eq("name", name);

  // 저장된 번호는 하이픈 유무가 섞일 수 있으므로 숫자만 남겨 뒤 4자리를 비교한다.
  const matches = (data ?? []).filter((m: any) => digits(m.phone).slice(-4) === tail);

  if (matches.length === 0) {
    return { ok: false, error: "일치하는 회원 정보가 없습니다. 관장님께 등록을 요청하세요." };
  }
  // 동명이인 + 같은 뒤 4자리 → 누구인지 확정 불가. 전체 번호를 받아 좁힌다.
  if (matches.length > 1) {
    const full = digits(String(form.get("phone_full") ?? ""));
    const exact = full ? matches.filter((m: any) => digits(m.phone) === full) : [];
    if (exact.length !== 1) {
      return { ok: false, error: "동일한 이름·뒷자리 회원이 있습니다. 전화번호 전체를 입력해 주세요.", needFullPhone: true };
    }
    matches.splice(0, matches.length, exact[0]);
  }

  const me = matches[0];
  if (!me.is_active) return { ok: false, error: "비활성화된 회원입니다." };

  await issueMemberSession(me.id);
  redirect("/");
}

export async function logoutMember() {
  await clearMemberSession();
  redirect("/login");
}

// 예약: 회원 JWT로 RPC 호출 → RLS/권한 일관. 낙관적 업데이트 없음, RPC 응답으로 확정.
export async function reserveSlot(slotId: string): Promise<Result> {
  const s = await getMemberSession();
  if (!s) return { ok: false, error: "로그인이 필요합니다." };
  const supabase = supabaseAsMember(s.jwt);
  const { data, error } = await supabase.rpc("reserve_slot", { p_slot_id: slotId, p_member_id: s.memberId });
  if (error) return { ok: false, error: rpcMessage(error) };
  revalidatePath("/");
  return { ok: true, status: data.status, waiting_order: data.waiting_order };
}

export async function cancelReservation(reservationId: string): Promise<Result> {
  const s = await getMemberSession();
  if (!s) return { ok: false, error: "로그인이 필요합니다." };
  const supabase = supabaseAsMember(s.jwt);
  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: reservationId,
    p_member_id: s.memberId,
  });
  if (error) return { ok: false, error: rpcMessage(error) };
  revalidatePath("/");
  return { ok: true, status: data.status };
}
