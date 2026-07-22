"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdminSession } from "@/lib/supabase/clients";
import { supabaseService, isAdminUser } from "@/lib/supabase/service";
import { exportAll } from "@/lib/backup";

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
// 회원 등록 = 회원 + (선택)이용권 + (선택)규정동의 서명을 한 번에.
// 이용권 인서트가 실패하면 회원도 되돌린다 — 이용권 없는 반쪽 회원이 남으면 예약이 안 돼 헷갈린다.
export async function createMember(form: FormData) {
  const sb = await db();
  const signature = String(form.get("signature") ?? "");

  const { data: member, error } = await sb
    .from("members")
    .insert({
      name: String(form.get("name")).trim(),
      phone: String(form.get("phone")).trim(),
      signature: signature || null,
      agreed_at: signature ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const start_date = String(form.get("start_date") ?? "");
  const end_date = String(form.get("end_date") ?? "");
  if (start_date && end_date) {
    const { error: mhErr } = await sb.from("membership_histories").insert({
      member_id: member.id,
      start_date,
      end_date,
      weekly_limit: Number(form.get("weekly_limit")),
      payment_memo: String(form.get("payment_memo") ?? "") || null,
    });
    if (mhErr) {
      await sb.from("members").delete().eq("id", member.id);
      return { error: `이용권 등록 실패: ${mhErr.message}` };
    }
  }
  revalidatePath("/admin/members");
  return { ok: true };
}

// 이름·전화번호 수정 (번호 바뀌면 로그인도 새 번호 기준이 된다)
export async function updateMember(form: FormData) {
  const sb = await db();
  const { error } = await sb
    .from("members")
    .update({ name: String(form.get("name")).trim(), phone: String(form.get("phone")).trim() })
    .eq("id", String(form.get("member_id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true };
}

// ── 고정 수업 (정기 예약) ────────────────────────────
// 기존 설정을 통째로 교체한다. 요일×시간 조합을 그대로 저장.
export async function setRecurring(memberId: string, days: number[], times: string[]) {
  const sb = await db();
  await sb.from("member_recurring_slots").delete().eq("member_id", memberId);
  if (days.length === 0 || times.length === 0) {
    revalidatePath("/admin/members");
    return { ok: true, count: 0 };
  }
  const rows = days.flatMap((d) => times.map((t) => ({ member_id: memberId, day_of_week: d, start_time: t })));
  const { error } = await sb.from("member_recurring_slots").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true, count: rows.length };
}

// 나중에 서명을 다시 받는 경우 (등록 때 안 받았거나 규정이 바뀐 경우)
export async function saveSignature(memberId: string, signature: string) {
  const sb = await db();
  const { error } = await sb
    .from("members")
    .update({ signature, agreed_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function toggleMemberActive(id: string, is_active: boolean) {
  const { error } = await (await db()).from("members").update({ is_active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true };
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

// 이용권 수정: 잘못 입력한 값을 바로잡는 용도.
// 기간을 늘리려면 extendMembership으로 새 이력을 쌓아야 이전 조건이 기록에 남는다.
export async function updateMembership(form: FormData) {
  const sb = await db();
  const start_date = String(form.get("start_date"));
  const end_date = String(form.get("end_date"));
  if (end_date < start_date) return { error: "종료일이 시작일보다 빠릅니다." };

  const { error } = await sb
    .from("membership_histories")
    .update({
      start_date,
      end_date,
      weekly_limit: Number(form.get("weekly_limit")),
      payment_memo: String(form.get("payment_memo") ?? "") || null,
    })
    .eq("id", String(form.get("membership_id")));
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function deleteMembership(id: string) {
  const sb = await db();
  const { error } = await sb.from("membership_histories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return { ok: true };
}

// ── 출석/상태 (관리자 수동) ──────────────────────────────
export async function setAttendance(reservationId: string, status: "attended" | "noshow" | "reserved") {
  const { error } = await (await db()).from("reservations").update({ status }).eq("id", reservationId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// 관리자가 회원 대신 예약. force=true면 1일1회·주간횟수를 건너뛴다(보강).
export async function adminReserve(slotId: string, memberId: string, force: boolean) {
  const { data, error } = await (await db()).rpc("admin_reserve_slot", {
    p_slot_id: slotId, p_member_id: memberId, p_force: force,
  });
  if (error) {
    const msg = error.message;
    if (msg.includes("NO_ACTIVE_MEMBERSHIP")) return { error: "이 날짜를 덮는 이용권이 없습니다. 이용권을 먼저 조정하세요." };
    if (msg.includes("DAILY_LIMIT")) return { error: "같은 날 이미 예약이 있습니다. 보강으로 넣으려면 [보강]을 체크하세요." };
    if (msg.includes("WEEKLY_LIMIT")) return { error: "이번 주 횟수를 모두 썼습니다. 보강으로 넣으려면 [보강]을 체크하세요." };
    if (msg.includes("23505")) return { error: "이미 이 수업에 예약되어 있습니다." };
    if (msg.includes("MEMBER_INACTIVE")) return { error: "비활성화된 회원입니다." };
    return { error: msg };
  }
  revalidatePath("/admin");
  return { ok: true, status: data.status as string, waiting_order: data.waiting_order as number | undefined };
}

// ── 주간 시간표 (slot_templates) ────────────────────────
// 시간표 등록은 코치 단위로 다룬다. 같은 시간대에 코치가 둘 이상일 수 있으므로
// 중복 판정 키는 (요일, 시간, 코치)다.
//
// mode="add"  : 선택한 조합만 반영. 선택하지 않은 기존 시간대는 그대로 둔다.
// mode="sync" : 선택 요일에서 이 코치의 시간표를 선택한 시간들과 일치시킨다.
//               선택하지 않은 시간대는 폐기 → "월수금 18/19/20 → 월수금 18/20" 같은 일괄 변경용.
//
// 어느 쪽이든 UPDATE로 덮어쓰지 않는다. 기존 로우를 닫고(is_active=false + effective_until)
// 새 로우를 추가한다(원칙 4). 이미 생성된 슬롯은 바뀌지 않고 다음 슬롯 생성부터 반영된다.
export async function addTemplate(form: FormData) {
  const days = form.getAll("day_of_week").map(Number).filter((d) => d >= 0 && d <= 6);
  const times = form.getAll("start_time").map(String).filter(Boolean);
  const mode = String(form.get("mode") ?? "add");
  const coach_name = String(form.get("coach_name")).trim();
  const capacity = Number(form.get("capacity"));

  if (days.length === 0) return { error: "요일을 하나 이상 선택하세요." };
  if (times.length === 0 && mode === "add") return { error: "시간을 하나 이상 선택하세요." };
  if (!coach_name) return { error: "코치를 입력하세요." };

  const sb = await db();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  // 이 코치의 대상 요일 활성 템플릿
  const { data: existing, error: exErr } = await sb
    .from("slot_templates")
    .select("id, day_of_week, start_time, capacity")
    .eq("is_active", true)
    .eq("coach_name", coach_name)
    .in("day_of_week", days);
  if (exErr) return { error: exErr.message };

  const hhmm = (t: string) => String(t).slice(0, 5);
  const key = (d: number, t: string) => `${d}@${hhmm(t)}`;
  const current = new Map((existing ?? []).map((e: any) => [key(e.day_of_week, e.start_time), e]));
  const wanted = new Set(times.map(hhmm));

  const toClose: string[] = [];
  const toInsert: { day_of_week: number; start_time: string; coach_name: string; capacity: number }[] = [];
  let unchanged = 0;

  for (const d of days) {
    for (const t of times) {
      const cur: any = current.get(key(d, t));
      if (!cur) toInsert.push({ day_of_week: d, start_time: t, coach_name, capacity });
      else if (cur.capacity === capacity) unchanged++;
      else { toClose.push(cur.id); toInsert.push({ day_of_week: d, start_time: t, coach_name, capacity }); }
    }
  }

  // sync: 선택하지 않은 시간대는 폐기
  let removed = 0;
  if (mode === "sync") {
    for (const [k, cur] of current) {
      if (!wanted.has(k.split("@")[1])) { toClose.push((cur as any).id); removed++; }
    }
  }

  if (toInsert.length === 0 && toClose.length === 0) {
    return { error: `선택한 ${unchanged}개 시간대가 이미 같은 값으로 등록되어 있습니다.` };
  }

  if (toClose.length > 0) {
    const { error } = await sb.from("slot_templates")
      .update({ is_active: false, effective_until: today }).in("id", toClose);
    if (error) return { error: error.message };
  }
  if (toInsert.length > 0) {
    const { error } = await sb.from("slot_templates").insert(toInsert);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/schedule");
  return { ok: true, added: toInsert.length - (toClose.length - removed), replaced: toClose.length - removed, removed, unchanged };
}

// 시간표 항목 수정: UPDATE로 덮어쓰지 않는다. 기존 로우를 닫고 새 값으로 새 로우를 만든다.
// 이미 생성된 슬롯은 그대로 두고, 다음 슬롯 생성부터 새 값이 적용된다.
export async function editTemplate(form: FormData) {
  const sb = await db();
  const id = String(form.get("template_id"));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  const { error: closeErr } = await sb
    .from("slot_templates").update({ is_active: false, effective_until: today }).eq("id", id);
  if (closeErr) return { error: closeErr.message };

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
  const { error } = await (await db())
    .from("slot_templates").update({ is_active: false, effective_until: today }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

// ── 휴관일 ────────────────────────────────────────────
export async function addClosedDate(form: FormData) {
  const sb = await db();
  const { error } = await sb
    .from("closed_dates")
    .upsert({ date: String(form.get("date")), reason: String(form.get("reason") ?? "") || null });
  if (error) return { error: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}
export async function removeClosedDate(date: string) {
  const { error } = await (await db()).from("closed_dates").delete().eq("date", date);
  if (error) return { error: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

// ── 개별 슬롯 예외 ──────────────────────────────────────
// 이미 생성된 슬롯의 정원·코치·시간 수정 (그 슬롯 하나만. 시간표는 안 건드린다)
export async function updateSlot(id: string, patch: { coach_name?: string; capacity?: number; start_time?: string }) {
  const sb = await db();
  if (patch.capacity !== undefined) {
    // 정원을 줄일 때 이미 예약이 더 많으면 막는다 — 초과 상태가 되면 정원 개념이 무너진다
    const { count } = await sb.from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("slot_id", id).in("status", ["reserved", "attended", "noshow"]);
    if ((count ?? 0) > patch.capacity) {
      return { error: `이미 예약이 ${count}명입니다. 정원을 그보다 작게 줄일 수 없습니다.` };
    }
  }
  const { error } = await sb.from("slots").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// 기간 내 슬롯 일괄 취소 (전달 전 초기화용). 예약도 함께 취소된다.
export async function purgeSlots(from: string, to: string) {
  await requireAdmin();
  const svc = supabaseService();
  const { data: ids, error } = await svc.from("slots").select("id").gte("date", from).lte("date", to);
  if (error) return { error: error.message };
  const list = (ids ?? []).map((r: any) => r.id);
  if (list.length === 0) return { ok: true, slots: 0 };

  // 이 경로는 되돌릴 수 없다. 취소 표시가 아니라 실제 삭제 (cascade로 예약도 삭제).
  const { error: delErr } = await svc.from("slots").delete().in("id", list);
  if (delErr) return { error: delErr.message };
  revalidatePath("/admin");
  return { ok: true, slots: list.length };
}
// 수업 ↔ 자율운동 전환. 예약 규칙은 동일하게 적용되므로 표시만 달라진다.
export async function toggleOpenGym(id: string, is_open_gym: boolean) {
  const { error } = await (await db()).from("slots").update({ is_open_gym }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// 슬롯 취소. 행을 지우면 generate_slots가 같은 슬롯을 다시 만들어버리므로
// 취소 표시만 하고 행은 남긴다(유니크 제약이 재생성을 막는다). 실수해도 복구 가능.
export async function deleteSlot(id: string) {
  const sb = await db();
  const { error } = await sb.from("slots").update({ is_cancelled: true }).eq("id", id);
  if (error) return { error: error.message };
  // 해당 슬롯의 살아있는 예약도 함께 취소
  await sb.from("reservations").update({ status: "cancelled", waiting_order: null })
    .eq("slot_id", id).in("status", ["reserved", "waiting"]);
  revalidatePath("/admin");
  return { ok: true };
}

// 취소 범위: 'one'(이 수업만) | 'day'(이 날 전체) | 'future'(앞으로 계속)
// 'future'는 시간표 항목까지 닫는다 — 안 그러면 다음 생성 때 되살아난다.
export async function cancelSlots(slotId: string, scope: "one" | "day" | "future") {
  const { data, error } = await (await db()).rpc("cancel_slots", { p_slot_id: slotId, p_scope: scope });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true, slots: data.slots as number, templates: data.templates as number };
}

export async function restoreSlot(id: string) {
  const { error } = await (await db()).from("slots").update({ is_cancelled: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// 수동 슬롯 생성 트리거 (보충용). generate_slots는 authenticated에서 revoke되어 있으므로
// 관리자 확인 후 service_role로 실행한다.
export async function generateSlots(from: string, to: string) {
  await requireAdmin();
  const svc = supabaseService();
  const { data, error } = await svc.rpc("generate_slots", { p_from: from, p_to: to });
  if (error) return { error: `슬롯 생성 실패: ${error.message}` };

  // 생성 직후 고정 수업 자동 예약까지 함께 (Cron과 동일 동작).
  // 여기 실패를 삼키면 "슬롯은 생겼는데 고정 예약만 안 되는" 상태가 조용히 만들어진다.
  const { data: auto, error: autoErr } = await svc.rpc("auto_reserve_recurring", { p_from: from, p_to: to });
  revalidatePath("/admin");
  if (autoErr) return { error: `슬롯 ${data}개는 생성됐지만 고정 수업 자동 예약에 실패: ${autoErr.message}` };
  return { inserted: data, autoReserved: auto ?? 0 };
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

// ── 운영시간 (요일별) ─────────────────────────────────
export async function saveHours(form: FormData) {
  const sb = await db();
  const rows = Array.from({ length: 7 }, (_, d) => ({
    day_of_week: d,
    is_closed: form.get(`closed_${d}`) === "on",
    open_time: String(form.get(`open_${d}`) ?? "") || null,
    close_time: String(form.get(`close_${d}`) ?? "") || null,
  }));
  const { error } = await sb.from("gym_hours").upsert(rows, { onConflict: "day_of_week" });
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ── 회원 일괄 등록 (종이 명부 이관) ──────────────────────
// 한 줄에 한 명: 이름,전화번호[,시작일,종료일,주간횟수,메모]
// 전부 성공하거나 전부 실패하는 대신, 줄 단위로 결과를 돌려준다 —
// 명부 이관은 오타가 섞이기 마련이라 되는 것부터 들어가는 편이 낫다.
export async function bulkImportMembers(text: string) {
  const sb = await db();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const failed: { line: string; reason: string }[] = [];
  let added = 0;

  for (const line of lines) {
    const [name, phone, start_date, end_date, weekly, ...memo] = line.split(/[,\t]/).map((c) => c.trim());
    if (!name || !phone) {
      failed.push({ line, reason: "이름 또는 전화번호 없음" });
      continue;
    }
    const { data: member, error } = await sb
      .from("members").insert({ name, phone }).select("id").single();
    if (error) {
      failed.push({ line, reason: error.message.includes("duplicate") ? "이미 등록된 회원" : error.message });
      continue;
    }
    if (start_date && end_date) {
      const { error: mhErr } = await sb.from("membership_histories").insert({
        member_id: member.id,
        start_date,
        end_date,
        weekly_limit: Number(weekly) || 3,
        payment_memo: memo.join(",") || null,
      });
      if (mhErr) {
        await sb.from("members").delete().eq("id", member.id);
        failed.push({ line, reason: `이용권: ${mhErr.message}` });
        continue;
      }
    }
    added++;
  }
  revalidatePath("/admin/members");
  return { added, failed };
}

// ── 공지사항 (이력) ───────────────────────────────────
// 수정이 아니라 새 로우로 쌓는다. 지난 공지를 되짚을 수 있어야 한다.
export async function addNotice(form: FormData) {
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "내용을 입력하세요." };
  const { error } = await (await db()).from("notices").insert({ body });
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

// 내리기/올리기 — 지우지 않고 노출만 끈다
export async function toggleNotice(id: string, is_active: boolean) {
  const { error } = await (await db()).from("notices").update({ is_active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function deleteNotice(id: string) {
  const { error } = await (await db()).from("notices").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ── 백업 ──────────────────────────────────────────────
// 파일로 즉시 내려받는다. 자동 백업(Cron)과 별개로, 손으로 한 부 챙겨두는 용도.
export async function downloadBackup() {
  await requireAdmin();
  try {
    const data = await exportAll(true);
    return { ok: true as const, json: JSON.stringify(data, null, 2), counts: data.counts };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

// ── 설정 ──────────────────────────────────────────────
export async function saveSettings(form: FormData) {
  const sb = await db();
  await sb.from("gym_settings").update({
    penalty_enabled: form.get("penalty_enabled") === "on",
    penalty_hours: Number(form.get("penalty_hours")),
    noshow_counts: form.get("noshow_counts") === "on",
    rules_text: String(form.get("rules_text") ?? "") || null,
  }).eq("id", 1);
  revalidatePath("/admin/settings");
}
