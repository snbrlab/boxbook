"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthCalendar } from "@/components/MonthCalendar";
import { AdminSlotCard } from "@/components/admin/AdminSlotCard";
import { GenerateButton } from "@/components/admin/GenerateButton";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDay = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)} (${WD[new Date(d + "T00:00:00Z").getUTCDay()]})`;

type Person = { id: string; status: string; waiting_order: number | null; name: string; phone: string; isNew: boolean };
type Slot = {
  id: string; date: string; start_time: string; coach_name: string; capacity: number;
  reserved: Person[]; waiting: Person[];
};

// 날짜 전환은 로컬 상태로 처리(서버 왕복 없음). 달 이동만 서버에서 새로 받는다.
export function TimeslotsClient({ today, date: initialDate, monthSlots }: {
  today: string; date: string; monthSlots: Slot[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  useEffect(() => setDate(initialDate), [initialDate]);

  const slotDates = useMemo(() => new Set(monthSlots.map((s) => s.date)), [monthSlots]);
  const booked = useMemo(
    () => new Map(monthSlots.filter((s) => s.reserved.length + s.waiting.length > 0).map((s) => [s.date, "reserved" as const])),
    [monthSlots],
  );
  const slots = useMemo(() => monthSlots.filter((s) => s.date === date), [monthSlots, date]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">타임슬롯</h1>
        <GenerateButton />
      </div>

      <MonthCalendar
        date={date}
        today={today}
        slotDates={slotDates}
        myDates={booked}
        onPick={setDate}
        onMonth={(d) => router.push(`/admin?date=${d}`, { scroll: false })}
        allowPast
        legend={{ filled: "예약 있음", hollow: "" }}
      />

      <div className="text-sm font-semibold pt-1">{fmtDay(date)}</div>

      {slots.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">이 날은 생성된 슬롯이 없습니다.</p>
      )}
      {slots.map((s) => (
        <AdminSlotCard key={s.id} slot={s} />
      ))}
    </div>
  );
}
