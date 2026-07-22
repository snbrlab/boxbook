"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdminSession } from "@/lib/supabase/clients";
import { supabaseService, isAdminUser } from "@/lib/supabase/service";

async function db() {
  return supabaseAdminSession();
}

// 현재 세션이 관리자인지 서버에서 확인. service_role 경로를 쓰기 전 게이트.
async function requireAdmin() {
  const sb = await db();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("unauthorized");
  if (!(await isAdminUser(user.id))) throw new Error("unauthorized");
  return user.id;
}

// ── 인증 ──────────────────────────────────────────────
export async function adminLogin(_prev: unknown, form: FormData) {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const sb = await db();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };

  // RLS 조회는 로그인 직후 세션 타이밍 때문에 신뢰할 수 없다 → service_role로 확정 판정
  let ok: boolean;
  try {
    ok = await isAdminUser(data.user.id);
  } catch (e) {
    // 설정 오류를 "권한 없음"으로 숨기지 않는다. 원인을 그대로 보여줘야 고칠 수 있다.
    await sb.auth.signOut();
    return { error: `서버 설정 오류: ${(e as Error).message}` };
  }
  if (!ok) {
    await sb.auth.signOut();
    // admins에 행이 없다는 뜻. 진단을 위해 uid를 노출한다(관리자 로그인 화면이라 안전).
    return { error: `admins 테이블에 등록되지 않은 계정입니다. uid=${data.user.id}` };
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

// ── 관리자 관리 ────────────────────────────────────────
// Auth 유저 생성 + admins 인서트를 함께 해야 하므로 service_role 사용. 반드시 requireAdmin 뒤에.
export async function createAdmin(form: FormData) {
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || password.length < 8) return { error: "이메일과 8자 이상 비밀번호를 입력하세요." };

  const svc = supabaseService();
  // email_confirm: true → 확인 메일 없이 바로 로그인 가능 (무료 티어 SMTP 의존 제거)
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: error?.message ?? "계정 생성에 실패했습니다." };

  const { error: insErr } = await svc.from("admins").insert({ id: data.user.id, email });
  if (insErr) {
    // admins 등록 실패 시 방금 만든 Auth 유저를 되돌린다 (고아 계정 방지)
    await svc.auth.admin.deleteUser(data.user.id);
    return { error: insErr.message };
  }
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function removeAdmin(id: string) {
  const me = await requireAdmin();
  if (id === me) return { error: "본인 계정은 삭제할 수 없습니다." };

  const svc = supabaseService();
  const { count } = await svc.from("admins").select("id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return { error: "마지막 관리자는 삭제할 수 없습니다." };

  await svc.from("admins").delete().eq("id", id);
  await svc.auth.admin.deleteUser(id);
  revalidatePath("/admin/settings");
  return { ok: true };
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
