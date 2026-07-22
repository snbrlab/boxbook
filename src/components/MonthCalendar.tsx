"use client";
import { addDays } from "@/lib/kst";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  date: string;                 // 선택된 날짜
  today: string;
  slotDates: Set<string>;       // 수업이 있는 날
  myDates: Map<string, "reserved" | "waiting">; // 내 예약이 있는 날
  onPick: (d: string) => void;
  onMonth: (d: string) => void; // 달 이동 (해당 달의 1일을 넘김)
};

// ponytail: 캘린더 라이브러리 없이 그리드 한 판. 필요한 건 월 이동 + 날짜 선택 + 표시뿐.
export function MonthCalendar({ date, today, slotDates, myDates, onPick, onMonth }: Props) {
  const first = date.slice(0, 8) + "01";
  const firstDow = new Date(first + "T00:00:00Z").getUTCDay();
  const daysInMonth = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7), 0)).getUTCDate();

  const shift = (n: number) => {
    const d = new Date(first + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    onMonth(d.toISOString().slice(0, 10));
  };

  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="px-3 py-1 rounded hover:bg-muted" aria-label="이전 달">‹</button>
        <span className="text-sm font-semibold">
          {date.slice(0, 4)}년 {Number(date.slice(5, 7))}월
        </span>
        <button onClick={() => shift(1)} className="px-3 py-1 rounded hover:bg-muted" aria-label="다음 달">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WD.map((w, i) => (
          <div key={w} className={`text-[11px] py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>
            {w}
          </div>
        ))}

        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const day = Number(d.slice(8, 10));
          const isPast = d < today;
          const hasClass = slotDates.has(d);
          const mine = myDates.get(d);
          const selected = d === date;
          const disabled = isPast || !hasClass;

          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              disabled={disabled}
              className={[
                "relative aspect-square rounded-lg text-sm flex items-center justify-center border",
                selected ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-transparent",
                !selected && d === today ? "border-primary/50" : "",
                disabled ? "text-muted-foreground/40" : !selected ? "hover:bg-muted" : "",
              ].join(" ")}
            >
              {day}
              {/* 내 예약 표시: 확정=채운 점, 대기=빈 점 */}
              {mine && (
                <span
                  className={[
                    "absolute bottom-1 w-1.5 h-1.5 rounded-full",
                    mine === "reserved"
                      ? selected ? "bg-primary-foreground" : "bg-primary"
                      : selected ? "border border-primary-foreground" : "border border-primary",
                  ].join(" ")}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 justify-center text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" />예약</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full border border-primary" />대기</span>
        <span className="text-muted-foreground/60">흐린 날짜 = 수업 없음</span>
      </div>
    </div>
  );
}
