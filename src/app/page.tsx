import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import {
  getActiveMembership, getMonthSlots, getMyUpcoming, getSettings, getWeeklyUsage, getHours, getNotices,
} from "@/lib/member-data";
import { todayKST, daysBetween } from "@/lib/kst";
import DashboardClient from "@/components/DashboardClient";

// 선택한 날짜가 속한 달의 1일 ~ 말일. 이 범위를 한 번에 받아 날짜 전환은 클라이언트에서 한다.
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

  const [membership, monthSlots, mine, settings, usage, hours, notices] = await Promise.all([
    getActiveMembership(s.jwt, s.memberId),
    getMonthSlots(s.jwt, from, to),
    getMyUpcoming(s.jwt),
    getSettings(s.jwt),
    // "이번 주"는 보고 있는 날짜가 아니라 오늘 기준이어야 한다
    getWeeklyUsage(s.jwt, today),
    getHours(s.jwt),
    getNotices(s.jwt),
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
      monthSlots={monthSlots}
      mine={mine}
      settings={settings}
      usage={usage}
      hours={hours}
      notices={notices}
    />
  );
}
