import { supabaseAdminSession } from "@/lib/supabase/clients";
import { todayKST, daysBetween } from "@/lib/kst";

// 관리자는 RLS상 전부 조회 가능. 타임슬롯 대시보드: 날짜별 슬롯 + 실명/전화 명단.
export async function adminDaySlots(date: string) {
  const sb = await supabaseAdminSession();
  const { data } = await sb
    .from("slots")
    .select("id, start_time, coach_name, capacity, reservations(id, status, waiting_order, member:members(id, name, phone, created_at))")
    .eq("date", date)
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
      start_time: s.start_time,
      coach_name: s.coach_name,
      capacity: s.capacity,
      reserved: rs.filter((r) => ["reserved", "attended", "noshow"].includes(r.status)).map(norm),
      waiting: rs.filter((r) => r.status === "waiting").sort((a, b) => a.waiting_order - b.waiting_order).map(norm),
    };
  });
}

export async function adminMembers() {
  const sb = await supabaseAdminSession();
  const today = todayKST();
  const { data } = await sb
    .from("members")
    .select("id, name, phone, is_active, created_at, membership_histories(start_date, end_date, weekly_limit, payment_memo)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((m: any) => {
    const hist = (m.membership_histories ?? []).sort((a: any, b: any) => (a.end_date < b.end_date ? 1 : -1));
    const active = hist.find((h: any) => h.start_date <= today && h.end_date >= today) ?? null;
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      is_active: m.is_active,
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

export async function adminClosedDates() {
  const sb = await supabaseAdminSession();
  const { data } = await sb.from("closed_dates").select("date, reason").gte("date", todayKST()).order("date");
  return data ?? [];
}

export async function adminSettings() {
  const sb = await supabaseAdminSession();
  const { data } = await sb.from("gym_settings").select("*").eq("id", 1).single();
  return data as { penalty_enabled: boolean; penalty_hours: number; noshow_counts: boolean };
}
