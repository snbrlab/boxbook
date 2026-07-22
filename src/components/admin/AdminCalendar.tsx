"use client";
import { useRouter } from "next/navigation";
import { MonthCalendar } from "@/components/MonthCalendar";

// 회원 화면과 같은 캘린더를 재사용한다. 관리자는 지난 날짜도 열람 가능(출석 확인).
// 점 표시는 "예약자 있는 날" 하나만 쓴다.
export function AdminCalendar({
  date, today, slotDates, booked,
}: {
  date: string; today: string; slotDates: string[]; booked: string[];
}) {
  const router = useRouter();
  // scroll:false — 날짜를 바꿀 때마다 화면이 맨 위로 튀지 않게
  const go = (d: string) => router.push(`/admin?date=${d}`, { scroll: false });
  return (
    <MonthCalendar
      date={date}
      today={today}
      slotDates={new Set(slotDates)}
      myDates={new Map(booked.map((d) => [d, "reserved" as const]))}
      onPick={go}
      onMonth={go}
      allowPast
      legend={{ filled: "예약 있음", hollow: "" }}
    />
  );
}
