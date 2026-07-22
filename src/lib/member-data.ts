import { supabaseAsMember } from "@/lib/supabase/clients";
import { todayKST } from "@/lib/kst";

export type SlotView = {
  id: string;
  start_time: string;
  coach_name: string;
  capacity: number;
  reserved: number;
  waiting: number;
  // 내 예약(있으면)
  my_reservation_id: string | null;
  my_status: "reserved" | "waiting" | null;
  my_waiting_order: number | null;
};

// 대상 날짜의 슬롯 목록 + 집계 + 내 예약 상태. 타인 이름은 애초에 안 읽는다(RLS).
export async function getDaySlots(jwt: string, date: string): Promise<SlotView[]> {
  const sb = supabaseAsMember(jwt);
  const [{ data: slots }, { data: counts }, { data: mine }] = await Promise.all([
    sb.from("slots").select("id, start_time, coach_name, capacity").eq("date", date).order("start_time"),
    sb.rpc("slot_counts", { p_date: date }),
    // RLS로 내 예약만 반환됨
    sb.from("reservations").select("id, slot_id, status, waiting_order").in("status", ["reserved", "waiting"]),
  ]);
  const cMap = new Map((counts ?? []).map((c: any) => [c.slot_id, c]));
  const mMap = new Map((mine ?? []).map((m: any) => [m.slot_id, m]));
  return (slots ?? []).map((s: any) => {
    const c: any = cMap.get(s.id);
    const m: any = mMap.get(s.id);
    return {
      id: s.id,
      start_time: s.start_time,
      coach_name: s.coach_name,
      capacity: s.capacity,
      reserved: c?.reserved_count ?? 0,
      waiting: c?.waiting_count ?? 0,
      my_reservation_id: m?.id ?? null,
      my_status: m?.status ?? null,
      my_waiting_order: m?.waiting_order ?? null,
    };
  });
}

// 대상 날짜에 이미 다른 예약이 있는지 (1일 1회 안내용)
export function hasReservationThatDay(slots: SlotView[]): boolean {
  return slots.some((s) => s.my_status === "reserved");
}

// 캘린더에 "수업 있는 날"을 표시하기 위한 날짜 목록
export async function getSlotDates(jwt: string, from: string, to: string): Promise<string[]> {
  const sb = supabaseAsMember(jwt);
  const { data } = await sb.from("slots").select("date").gte("date", from).lte("date", to);
  return [...new Set((data ?? []).map((r: any) => r.date))];
}

// 이번 주 사용량. 범위 계산은 reserve_slot과 동일한 로직을 RPC가 담당한다(중복 구현 금지).
export async function getWeeklyUsage(jwt: string, date: string) {
  const sb = supabaseAsMember(jwt);
  const { data } = await sb.rpc("my_weekly_usage", { p_date: date });
  const row = (data ?? [])[0] as { used: number; weekly_limit: number } | undefined;
  return row ?? null;
}

export async function getSettings(jwt: string) {
  const sb = supabaseAsMember(jwt);
  const { data } = await sb.from("gym_settings").select("penalty_enabled, penalty_hours").eq("id", 1).maybeSingle();
  return (data as { penalty_enabled: boolean; penalty_hours: number } | null) ?? { penalty_enabled: true, penalty_hours: 2 };
}

export type MyReservation = {
  id: string;
  status: "reserved" | "waiting";
  waiting_order: number | null;
  promoted_at: string | null;
  date: string;
  start_time: string;
  coach_name: string;
};

// 내 예약 (오늘 이후, 활성 상태). '내 예약' 탭용.
export async function getMyUpcoming(jwt: string): Promise<MyReservation[]> {
  const sb = supabaseAsMember(jwt);
  const { data } = await sb
    .from("reservations")
    .select("id, status, waiting_order, promoted_at, slots!inner(date, start_time, coach_name)")
    .in("status", ["reserved", "waiting"])
    .gte("slots.date", todayKST())
    .order("date", { foreignTable: "slots" })
    .order("start_time", { foreignTable: "slots" });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    waiting_order: r.waiting_order,
    promoted_at: r.promoted_at,
    date: r.slots.date,
    start_time: r.slots.start_time,
    coach_name: r.slots.coach_name,
  }));
}

// 유효 회원권: 오늘 기준. { until, daysLeft } | null
export async function getActiveMembership(jwt: string, memberId: string) {
  const sb = supabaseAsMember(jwt);
  const today = todayKST();
  const { data } = await sb
    .from("membership_histories")
    .select("end_date, weekly_limit")
    .eq("member_id", memberId)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { end_date: string; weekly_limit: number } | null;
}
