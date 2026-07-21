"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdminSession, supabaseService } from "@/lib/supabase/clients";

async function db() {
  return supabaseAdminSession();
}

// 현재 세션이 관리자인지 서버에서 확인. service_role 경로를 쓰기 전 게이트.
async function requireAdmin() {
  const sb = await db();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("unauthorized");
  const { data } = await sb.from("admins").select("id").eq("id", user.id).maybeSingle();
  if (!data) throw new Error("unauthorized");
  return user.id;
}

// ── 인증 ──────────────────────────────────────────────
export async function adminLogin(_prev: unknown, form: FormData) {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const sb = await db();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  const { data: admin } = await sb.from("admins").select("id").eq("id", data.user.id).maybeSingle();
  if (!admin) {
    await sb.auth.signOut();
    return { error: "관리자 권한이 없는 계정입니다." };
  }
  redirect("/admin");
}

export async function adminLogout() {
  (await db()).auth.signOut();
  redirect("/admin/login");
}

// ── 회원 ──────────────────────────────────────────────
export async function createMember(form: FormData) {
  const sb = await db();
  const { error } = await sb.from("members").insert({
    name: String(form.get("name")).trim(),
    phone: String(form.get("phone")).trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function toggleMemberActive(id: string, is_active: boolean) {
  await (await db()).from("members").update({ is_active }).eq("id", id);
  revalidatePath("/admin/members");
}

// 이용권 연장: 덮어쓰지 않고 새 이력 로우를 쌓는다 (원칙 4)
export async function extendMembership(form: FormData) {
  const sb = await db();
  const { error } = await sb.from("membership_histories").insert({
    member_id: String(form.get("member_id")),
    start_date: String(form.get("start_date")),
    end_date: String(form.get("end_date")),
    weekly_limit: Number(form.get("weekly_limit")),
    payment_memo: String(form.get("payment_memo") ?? "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true };
}

// ── 출석/상태 (관리자 수동) ──────────────────────────────
export async function setAttendance(reservationId: string, status: "attended" | "noshow" | "reserved") {
  await (await db()).from("reservations").update({ status }).eq("id", reservationId);
  revalidatePath("/admin");
}

// ── 주간 시간표 (slot_templates) ────────────────────────
export async function addTemplate(form: FormData) {
  const sb = await db();
  const { error } = await sb.from("slot_templates").insert({
    day_of_week: Number(form.get("day_of_week")),
    start_time: String(form.get("start_time")),
    coach_name: String(form.get("coach_name")).trim(),
    capacity: Number(form.get("capacity")),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

// 시간표 항목 폐기: 덮어쓰지 않고 닫는다 (is_active=false + effective_until=오늘). 새 값은 addTemplate로.
export async function closeTemplate(id: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  await (await db()).from("slot_templates").update({ is_active: false, effective_until: today }).eq("id", id);
  revalidatePath("/admin/schedule");
}

// ── 휴관일 ────────────────────────────────────────────
export async function addClosedDate(form: FormData) {
  const sb = await db();
  await sb.from("closed_dates").upsert({ date: String(form.get("date")), reason: String(form.get("reason") ?? "") });
  revalidatePath("/admin/schedule");
}
export async function removeClosedDate(date: string) {
  await (await db()).from("closed_dates").delete().eq("date", date);
  revalidatePath("/admin/schedule");
}

// ── 개별 슬롯 예외 ──────────────────────────────────────
export async function updateSlot(id: string, patch: { coach_name?: string; capacity?: number; start_time?: string }) {
  await (await db()).from("slots").update(patch).eq("id", id);
  revalidatePath("/admin");
}
// 예약자 있는 슬롯 삭제는 UI에서 확인 절차를 거친 뒤 호출 (cascade로 예약도 삭제)
export async function deleteSlot(id: string) {
  await (await db()).from("slots").delete().eq("id", id);
  revalidatePath("/admin");
}

// 수동 슬롯 생성 트리거 (보충용). generate_slots는 authenticated에서 revoke되어 있으므로
// 관리자 확인 후 service_role로 실행한다.
export async function generateSlots(from: string, to: string) {
  await requireAdmin();
  const { data, error } = await supabaseService().rpc("generate_slots", { p_from: from, p_to: to });
  revalidatePath("/admin");
  return error ? { error: error.message } : { inserted: data };
}

// ── 설정 ──────────────────────────────────────────────
export async function saveSettings(form: FormData) {
  const sb = await db();
  await sb.from("gym_settings").update({
    penalty_enabled: form.get("penalty_enabled") === "on",
    penalty_hours: Number(form.get("penalty_hours")),
    noshow_counts: form.get("noshow_counts") === "on",
  }).eq("id", 1);
  revalidatePath("/admin/settings");
}
