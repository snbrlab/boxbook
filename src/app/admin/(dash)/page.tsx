import { adminDaySlots, adminMonthOverview } from "@/lib/admin-data";
import { todayKST } from "@/lib/kst";
import { AdminSlotCard } from "@/components/admin/AdminSlotCard";
import { GenerateButton } from "@/components/admin/GenerateButton";
import { AdminCalendar } from "@/components/admin/AdminCalendar";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDay = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)} (${WD[new Date(d + "T00:00:00Z").getUTCDay()]})`;

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

  const [slots, overview] = await Promise.all([adminDaySlots(date), adminMonthOverview(from, to)]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">타임슬롯 · {fmtDay(date)}</h1>
        <GenerateButton />
      </div>

      <AdminCalendar date={date} today={today} slotDates={overview.slotDates} booked={overview.booked} />

      {slots.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">이 날은 생성된 슬롯이 없습니다.</p>
      )}
      {slots.map((s) => (
        <AdminSlotCard key={s.id} slot={s} />
      ))}
    </div>
  );
}
