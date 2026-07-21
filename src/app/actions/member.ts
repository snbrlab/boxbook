"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseService, supabaseAsMember } from "@/lib/supabase/clients";
import { issueMemberSession, clearMemberSession, getMemberSession } from "@/lib/auth";
import { rpcMessage } from "@/lib/errors";

type Result = { ok: true; status?: string; waiting_order?: number } | { ok: false; error: string };

export async function loginMember(_prev: unknown, form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  if (!name || !phone) return { ok: false, error: "이름과 전화번호를 입력해 주세요." };

  // 대조는 service_role로 (로그인 전이라 세션 없음). 이름+전화번호 완전 일치.
  const svc = supabaseService();
  const { data } = await svc
    .from("members")
    .select("id, is_active")
    .eq("name", name)
    .eq("phone", phone)
    .maybeSingle();
  if (!data) return { ok: false, error: "일치하는 회원 정보가 없습니다. 관장님께 등록을 요청하세요." };
  if (!data.is_active) return { ok: false, error: "비활성화된 회원입니다." };

  await issueMemberSession(data.id);
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
