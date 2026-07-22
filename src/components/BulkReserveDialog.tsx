"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkReserve } from "@/app/actions/member";
import type { SlotView } from "@/lib/member-data";
import { WD, DOW_ORDER, dowClass } from "@/lib/dow";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// "앞으로 화·목 19시 전부" 같은 신청을 한 번에.
// 달력을 넘겨가며 하나씩 누르는 게 회원 입장에서 가장 번거로운 일이다.
export function BulkReserveDialog({ monthSlots, today, open, onClose }: {
  monthSlots: SlotView[]; today: string; open: boolean; onClose: () => void;
}) {
  const [busy, start] = useTransition();
  const [days, setDays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>([]);

  // 아직 안 지난, 내가 예약하지 않은 수업만 대상
  const available = useMemo(
    () => monthSlots.filter((s) => s.date >= today && !s.my_status),
    [monthSlots, today],
  );
  const availTimes = useMemo(
    () => [...new Set(available.map((s) => s.start_time.slice(0, 5)))].sort(),
    [available],
  );
  const availDays = useMemo(
    () => new Set(available.map((s) => new Date(s.date + "T00:00:00Z").getUTCDay())),
    [available],
  );

  const picked = useMemo(
    () => available.filter((s) =>
      days.includes(new Date(s.date + "T00:00:00Z").getUTCDay()) &&
      times.includes(s.start_time.slice(0, 5))),
    [available, days, times],
  );

  const submit = () =>
    start(async () => {
      const r = await bulkReserve(picked.map((s) => s.id));
      if (!r.ok) return void toast.error(r.error);
      const parts = [];
      if (r.reserved) parts.push(`${r.reserved}건 예약`);
      if (r.waiting) parts.push(`${r.waiting}건 대기`);
      if (r.failed.length) parts.push(`${r.failed.length}건 실패`);
      toast.success(parts.join(" · ") || "신청된 수업이 없습니다.");
      if (r.failed.length) {
        const reasons: Record<string, string> = {
          DAILY_LIMIT: "같은 날 이미 예약", WEEKLY_LIMIT: "주간 횟수 초과",
          NO_ACTIVE_MEMBERSHIP: "회원권 기간 밖", PAST_SLOT: "지난 수업",
        };
        const first = r.failed.slice(0, 3).map((f) => {
          const key = Object.keys(reasons).find((k) => f.reason.includes(k));
          return `${f.date.slice(5)} ${f.time} — ${key ? reasons[key] : "실패"}`;
        });
        toast.error(first.join("\n") + (r.failed.length > 3 ? `\n외 ${r.failed.length - 3}건` : ""));
      }
      onClose(); setDays([]); setTimes([]);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setDays([]); setTimes([]); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>여러 수업 한 번에 신청</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            이번 달에 남은 수업 중에서 고릅니다. 주간 횟수를 넘는 건은 자동으로 빠집니다.
          </p>

          <div className="space-y-1">
            <Label className="text-xs">요일</Label>
            <div className="flex gap-1">
              {DOW_ORDER.map((d) => (
                <button type="button" key={d} disabled={!availDays.has(d)}
                  onClick={() => setDays((v) => v.includes(d) ? v.filter((x) => x !== d) : [...v, d])}
                  className={`w-9 h-9 rounded text-sm border disabled:opacity-30 ${
                    days.includes(d) ? "bg-primary text-primary-foreground border-primary" : dowClass(d)}`}>
                  {WD[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">시간</Label>
            <div className="flex flex-wrap gap-1">
              {availTimes.map((t) => (
                <button type="button" key={t}
                  onClick={() => setTimes((v) => v.includes(t) ? v.filter((x) => x !== t) : [...v, t])}
                  className={`w-14 h-8 rounded text-xs border ${
                    times.includes(t) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {picked.length > 0 && (
            <div className="rounded-lg border p-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium mb-1">신청할 수업 {picked.length}건</p>
              {picked.map((s) => (
                <p key={s.id} className="text-[11px] text-muted-foreground">
                  {s.date.slice(5)} ({WD[new Date(s.date + "T00:00:00Z").getUTCDay()]}) {s.start_time.slice(0, 5)}
                  {s.reserved >= s.capacity && " · 정원 참 → 대기"}
                </p>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={busy || picked.length === 0} onClick={submit}>
            {picked.length > 0 ? `${picked.length}건 신청` : "요일과 시간을 고르세요"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
