import { supabaseAsMember } from "@/lib/supabase/clients";
import { todayKST } from "@/lib/kst";

export type MyStatus = "reserved" | "waiting" | "attended" | "noshow";

export type SlotView = {
  id: string;
  date: string;
  start_time: string;
  coach_name: string;
  capacity: number;
  is_open_gym: boolean;
  reserved: number;
  waiting: number;
  // 내 예약(있으면). 지난 수업은 attended/noshow로 출석 여부가 남는다.
  my_reservation_id: string | null;
  my_status: MyStatus | null;
  my_waiting_order: number | null;
};

// 한 달치 슬롯 + 집계 + 내 예약 상태를 한 번에. 날짜 전환은 클라이언트에서 필터링한다
// (날짜마다 서버 왕복하면 화면 전환이 눈에 띄게 느려진다). 타인 이름은 애초에 안 읽는다(RLS).
export async function getMonthSlots(jwt: string, from: string, to: string): Promise<SlotView[]> {
  const sb = supabaseAsMember(jwt);
  const [{ data: slots }, { data: counts, error: cErr }, { data: mine }] = await Promise.all([
    sb.from("slots").select("id, date, start_time, coach_name, capacity, is_open_gym")
      .gte("date", from).lte("date", to).order("date").order("start_time"),
    sb.rpc("slot_counts_range", { p_from: from, p_to: to }),
    // RLS로 내 예약만 반환됨. 지난 수업의 출석 여부를 보려면 attended/noshow도 필요하다.
    sb.from("reservations").select("id, slot_id, status, waiting_order")
      .in("status", ["reserved", "waiting", "attended", "noshow"]),
  ]);
  // 집계 실패를 0으로 삼키면 "정원이 비어있다"는 잘못된 화면이 나온다. 원인을 그대로 드러낸다.
  if (cErr) throw new Error(`예약 집계 조회 실패 (slot_counts_range): ${cErr.message}`);

  const cMap = new Map((counts ?? []).map((c: any) => [c.slot_id, c]));
  const mMap = new Map((mine ?? []).map((m: any) => [m.slot_id, m]));
  return (slots ?? []).map((s: any) => {
    const c: any = cMap.get(s.id);
    const m: any = mMap.get(s.id);
    return {
      id: s.id,
      date: s.date,
      start_time: s.start_time,
      coach_name: s.coach_name,
      capacity: s.capacity,
      is_open_gym: s.is_open_gym ?? false,
      reserved: c?.reserved_count ?? 0,
      waiting: c?.waiting_count ?? 0,
      my_reservation_id: m?.id ?? null,
      my_status: m?.status ?? null,
      my_waiting_order: m?.waiting_order ?? null,
    };
  });
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
  const { data } = await sb.from("gym_settings").select("penalty_enabled, penalty_hours, notice_text, notice_updated_at, hours_text").eq("id", 1).maybeSingle();
  return (data as { penalty_enabled: boolean; penalty_hours: number; notice_text: string | null; notice_updated_at: string | null; hours_text: string | null } | null)
    ?? { penalty_enabled: true, penalty_hours: 2, notice_text: null, notice_updated_at: null, hours_text: null };
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
