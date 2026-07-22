"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setRecurring } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 ~ 23:00

type Member = {
  id: string; name: string;
  active: { weekly_limit: number } | null;
  recurring: { day_of_week: number; start_time: string }[];
};

// 고정 수업 = "화·목 19시" 같은 기본 요일. 슬롯 생성 시 자동 예약된다.
export function RecurringDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [busy, start] = useTransition();
  const [days, setDays] = useState<number[]>([]);
  const [hours, setHours] = useState<number[]>([]);
  const [seeded, setSeeded] = useState<string | null>(null);

  // 다이얼로그가 열릴 때 기존 설정을 폼에 채운다
  if (member && seeded !== member.id) {
    setSeeded(member.id);
    setDays([...new Set(member.recurring.map((r) => r.day_of_week))].sort());
    setHours([...new Set(member.recurring.map((r) => Number(r.start_time.slice(0, 2))))].sort((a, b) => a - b));
  }

  const total = days.length * hours.length;
  const limit = member?.active?.weekly_limit ?? null;
  const over = limit !== null && total > limit;

  return (
    <Dialog open={!!member} onOpenChange={(o) => { if (!o) { onClose(); setSeeded(null); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{member?.name} 고정 수업</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            지정한 요일·시간은 슬롯이 생성될 때 자동으로 예약됩니다. 일정이 생기면 그 건만 취소하고 다른 날로 옮기면 됩니다.
          </p>

          <div className="space-y-1">
            <Label className="text-xs">요일</Label>
            <div className="flex gap-1">
              {WD.map((w, i) => (
                <button type="button" key={i}
                  onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))}
                  className={`w-9 h-9 rounded text-sm border ${days.includes(i) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">시간</Label>
            <div className="flex flex-wrap gap-1">
              {HOURS.map((h) => (
                <button type="button" key={h}
                  onClick={() => setHours((s) => (s.includes(h) ? s.filter((x) => x !== h) : [...s, h].sort((a, b) => a - b)))}
                  className={`w-11 h-8 rounded text-xs border ${hours.includes(h) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                  {String(h).padStart(2, "0")}:00
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs">
            주 <b>{total}</b>회 고정
            {limit !== null && <span className="text-muted-foreground"> / 이용권 주 {limit}회</span>}
            {over && (
              <p className="text-amber-600 mt-1">
                이용권 횟수를 넘습니다. 초과분은 주간 한도에 걸려 자동 예약되지 않습니다.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" disabled={busy}
            onClick={() => start(async () => {
              if (!member) return;
              await setRecurring(member.id, [], []);
              toast.success("고정 수업을 해제했습니다."); onClose(); setSeeded(null);
            })}>
            해제
          </Button>
          <Button type="button" disabled={busy}
            onClick={() => start(async () => {
              if (!member) return;
              const times = hours.map((h) => `${String(h).padStart(2, "0")}:00`);
              const r = await setRecurring(member.id, days, times);
              if (r?.error) return void toast.error(r.error);
              toast.success(`고정 수업 ${r.count}개 저장`); onClose(); setSeeded(null);
            })}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
