import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import {
  getActiveMembership, getDaySlots, getMyUpcoming, getSettings,
  getSlotDates, getWeeklyUsage, hasReservationThatDay,
} from "@/lib/member-data";
import { todayKST, daysBetween } from "@/lib/kst";
import DashboardClient from "@/components/DashboardClient";

// 선택한 날짜가 속한 달의 1일 ~ 말일 (캘린더 표시 범위)
function monthRange(date: string) {
  const from = date.slice(0, 8) + "01";
  const d = new Date(from + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { from, to: d.toISOString().slice(0, 10) };
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const s = await getMemberSession();
  if (!s) redirect("/login");

  const today = todayKST();
  const date = (await searchParams).date ?? today;
  const { from, to } = monthRange(date);

  const [membership, slots, mine, settings, slotDates, usage] = await Promise.all([
    getActiveMembership(s.jwt, s.memberId),
    getDaySlots(s.jwt, date),
    getMyUpcoming(s.jwt),
    getSettings(s.jwt),
    getSlotDates(s.jwt, from, to),
    getWeeklyUsage(s.jwt, date),
  ]);

  return (
    <DashboardClient
      today={today}
      date={date}
      membership={
        membership
          ? { end_date: membership.end_date, daysLeft: daysBetween(today, membership.end_date) }
          : null
      }
      slots={slots}
      reservedToday={hasReservationThatDay(slots)}
      mine={mine}
      settings={settings}
      slotDates={slotDates}
      usage={usage}
    />
  );
}
