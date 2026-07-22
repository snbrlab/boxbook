import { adminMonthSlots, adminMemberOptions } from "@/lib/admin-data";
import { todayKST } from "@/lib/kst";
import { TimeslotsClient } from "@/components/admin/TimeslotsClient";

function monthRange(date: string) {
  const from = date.slice(0, 8) + "01";
  const d = new Date(from + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { from, to: d.toISOString().slice(0, 10) };
}

export default async function AdminTimeslots({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = todayKST();
  const date = (await searchParams).date ?? today;
  const { from, to } = monthRange(date);
  const [monthSlots, members] = await Promise.all([adminMonthSlots(from, to), adminMemberOptions()]);

  return <TimeslotsClient today={today} date={date} monthSlots={monthSlots} members={members} />;
}
