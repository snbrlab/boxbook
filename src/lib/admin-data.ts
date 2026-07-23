import { supabaseAdminSession } from "@/lib/supabase/clients";
import { todayKST, daysBetween } from "@/lib/kst";

// 관리자는 RLS상 전부 조회 가능. 타임슬롯 대시보드: 슬롯 + 실명/전화 명단.
// 한 달치를 한 번에 받아 날짜 전환은 클라이언트에서 한다 (날짜마다 왕복하면 느리다).
// 관리자는 어차피 전 명단 열람 권한이 있으므로 미리 받아도 새로 노출되는 정보는 없다.
export async function adminMonthSlots(from: string, to: string) {
  const sb = await supabaseAdminSession();
  const { data } = await sb
    .from("slots")
    .select("id, date, start_time, coach_name, capacity, is_open_gym, is_cancelled, reservations(id, status, waiting_order, member:members(id, name, phone, created_at))")
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("start_time");
  const today = todayKST();
  return (data ?? []).map((s: any) => {
    const rs = (s.reservations ?? []) as any[];
    const norm = (r: any) => ({
      id: r.id,
      status: r.status,
      waiting_order: r.waiting_order,
      name: r.member?.name ?? "(탈퇴)",
      phone: r.member?.phone ?? "",
      isNew: r.member?.created_at ? daysBetween(r.member.created_at.slice(0, 10), today) <= 7 : false,
    });
    return {
      id: s.id,
      date: s.date,
      start_time: s.start_time,
      coach_name: s.coach_name,
      capacity: s.capacity,
      is_open_gym: s.is_open_gym ?? false,
      is_cancelled: s.is_cancelled ?? false,
      reserved: rs.filter((r) => ["reserved", "attended", "noshow"].includes(r.status)).map(norm),
      waiting: rs.filter((r) => r.status === "waiting").sort((a, b) => a.waiting_order - b.waiting_order).map(norm),
    };
  });
}

// 슬롯에 회원을 직접 넣을 때 쓰는 가벼운 목록
export async function adminMemberOptions() {
  const sb = await supabaseAdminSession();
  const { data } = await sb.from("members").select("id, name, phone").eq("is_active", true).order("name");
  return (data ?? []) as { id: string; name: string; phone: string }[];
}

export async function adminMembers() {
  const sb = await supabaseAdminSession();
  const today = todayKST();
  const { data } = await sb
    .from("members")
    .select("id, name, phone, is_active, created_at, signature, agreed_at, membership_histories(id, start_date, end_date, weekly_limit, payment_memo), member_recurring_slots(day_of_week, start_time, is_active)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((m: any) => {
    const hist = (m.membership_histories ?? []).sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1));
    const active = hist.find((h: any) => h.start_date <= today && h.end_date >= today) ?? null;
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      is_active: m.is_active,
      signature: m.signature ?? null,
      agreed_at: m.agreed_at ?? null,
      recurring: ((m.member_recurring_slots ?? []) as any[])
        .filter((r) => r.is_active)
        .map((r) => ({ day_of_week: r.day_of_week, start_time: String(r.start_time).slice(0, 5) })),
      isNew: daysBetween(m.created_at.slice(0, 10), today) <= 7,
      active,
      daysLeft: active ? daysBetween(today, active.end_date) : null,
      history: hist,
    };
  });
}

export async function adminTemplates() {
  const sb = await supabaseAdminSession();
  const { data } = await sb
    .from("slot_templates")
    .select("id, day_of_week, start_time, coach_name, capacity, is_active, effective_from, effective_until")
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");
  return data ?? [];
}

// 지난 휴관일도 기록으로 남는다. 화면에서 예정/지난 것을 나눠 보여준다.
export async function adminClosedDates() {
  const sb = await supabaseAdminSession();
  const { data } = await sb.from("closed_dates").select("date, reason").order("date", { ascending: false });
  return (data ?? []) as { date: string; reason: string | null }[];
}

// 관리자 목록 + 현재 로그인한 관리자 id (본인 삭제 버튼 숨기기용)
export async function adminList() {
  const sb = await supabaseAdminSession();
  const [{ data: { user } }, { data }] = await Promise.all([
    sb.auth.getUser(),
    sb.from("admins").select("id, email, created_at").eq("is_super", false).order("created_at"),
  ]);
  return { me: user?.id ?? null, admins: (data ?? []) as { id: string; email: string; created_at: string }[] };
}

// 대시보드 통계. 기간 내 예약/출석/노쇼, 회원 현황, 시간대·요일별 인기도.
export async function adminStats(from: string, to: string) {
  const sb = await supabaseAdminSession();
  const today = todayKST();

  const [{ data: res }, { data: members }] = await Promise.all([
    sb.from("reservations")
      .select("status, member_id, slots!inner(date, start_time, is_open_gym)")
      .gte("slots.date", from).lte("slots.date", to),
    sb.from("members").select("id, name, is_active, created_at, membership_histories(start_date, end_date)"),
  ]);

  const rows = (res ?? []) as any[];
  const counted = rows.filter((r) => ["reserved", "attended", "noshow"].includes(r.status));

  const byHour = new Map<string, number>();
  const byDow = new Map<number, number>();
  const byMember = new Map<string, number>();
  for (const r of counted) {
    const h = String(r.slots.start_time).slice(0, 5);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
    byDow.set(new Date(r.slots.date + "T00:00:00Z").getUTCDay(), (byDow.get(new Date(r.slots.date + "T00:00:00Z").getUTCDay()) ?? 0) + 1);
    byMember.set(r.member_id, (byMember.get(r.member_id) ?? 0) + 1);
  }

  const ms = (members ?? []) as any[];
  const activeOf = (m: any) => (m.membership_histories ?? []).find((h: any) => h.start_date <= today && h.end_date >= today);
  const nameOf = new Map(ms.map((m) => [m.id, m.name]));

  const attended = rows.filter((r) => r.status === "attended").length;
  const noshow = rows.filter((r) => r.status === "noshow").length;

  return {
    total: counted.length,
    attended,
    noshow,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    openGym: counted.filter((r) => r.slots.is_open_gym).length,
    attendRate: attended + noshow > 0 ? Math.round((attended / (attended + noshow)) * 100) : null,
    memberTotal: ms.length,
    memberActive: ms.filter((m) => m.is_active).length,
    withMembership: ms.filter(activeOf).length,
    newMembers: ms.filter((m) => daysBetween(m.created_at.slice(0, 10), today) <= 30).length,
    expiringSoon: ms.filter((m) => { const a = activeOf(m); return a && daysBetween(today, a.end_date) <= 7; }).map((m) => m.name),
    byHour: [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    byDow: Array.from({ length: 7 }, (_, d) => byDow.get(d) ?? 0),
    topMembers: [...byMember.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, n]) => ({ name: nameOf.get(id) ?? "(탈퇴)", count: n })),
  };
}

export async function adminNotices() {
  const sb = await supabaseAdminSession();
  const { data } = await sb.from("notices").select("*").order("created_at", { ascending: false });
  return (data ?? []) as { id: string; body: string; is_active: boolean; created_at: string }[];
}

export async function adminHours() {
  const sb = await supabaseAdminSession();
  const { data } = await sb.from("gym_hours").select("*").order("day_of_week");
  return (data ?? []) as { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }[];
}

export async function adminSettings() {
  const sb = await supabaseAdminSession();
  const { data } = await sb.from("gym_settings").select("*").eq("id", 1).single();
  return data as {
    penalty_enabled: boolean;
    penalty_hours: number;
    noshow_counts: boolean;
    rules_text: string | null;
    notice_text: string | null;
    notice_updated_at: string | null;
  };
}
