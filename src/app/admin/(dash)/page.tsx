import Link from "next/link";
import { adminDaySlots } from "@/lib/admin-data";
import { todayKST, addDays } from "@/lib/kst";
import { AdminSlotCard } from "@/components/admin/AdminSlotCard";
import { GenerateButton } from "@/components/admin/GenerateButton";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDay = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)} (${WD[new Date(d + "T00:00:00Z").getUTCDay()]})`;

export default async function AdminTimeslots({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = todayKST();
  const date = (await searchParams).date ?? today;
  const slots = await adminDaySlots(date);
  const strip = Array.from({ length: 21 }, (_, i) => addDays(today, i));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">타임슬롯 · {fmtDay(date)}</h1>
        <GenerateButton />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {strip.map((d) => (
          <Link
            key={d}
            href={`/admin?date=${d}`}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs border ${
              d === date ? "bg-primary text-primary-foreground border-primary" : ""
            }`}
          >
            {fmtDay(d)}
          </Link>
        ))}
      </div>

      {slots.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">이 날은 생성된 슬롯이 없습니다.</p>}
      {slots.map((s) => (
        <AdminSlotCard key={s.id} slot={s} />
      ))}
    </div>
  );
}
