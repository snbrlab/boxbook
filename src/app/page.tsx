import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/auth";
import { getActiveMembership, getDaySlots, getMyUpcoming, getSettings, hasReservationThatDay } from "@/lib/member-data";
import { todayKST, daysBetween } from "@/lib/kst";
import DashboardClient from "@/components/DashboardClient";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const s = await getMemberSession();
  if (!s) redirect("/login");

  const today = todayKST();
  const date = (await searchParams).date ?? today;

  const [membership, slots, mine, settings] = await Promise.all([
    getActiveMembership(s.jwt, s.memberId),
    getDaySlots(s.jwt, date),
    getMyUpcoming(s.jwt),
    getSettings(s.jwt),
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
    />
  );
}
