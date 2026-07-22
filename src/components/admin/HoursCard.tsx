"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { saveHours } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WD, DOW_ORDER, dowClass } from "@/lib/dow";


type Hour = { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean };

// 운영시간은 수업 시간표와 별개다. 요일별 개폐 시각만 관리한다.
export function HoursCard({ hours }: { hours: Hour[] }) {
  const [busy, start] = useTransition();
  const byDay = (d: number) => hours.find((h) => h.day_of_week === d);

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>운영시간</CardTitle></CardHeader>
      <CardContent>
        <form
          action={(fd) => start(async () => {
            const r = await saveHours(fd);
            if (r?.error) return void toast.error(r.error);
            toast.success("운영시간을 저장했습니다.");
          })}
          className="space-y-2"
        >
          {DOW_ORDER.map((d) => {
            const w = WD[d];
            const h = byDay(d);
            return (
              <div key={d} className="flex items-center gap-2 text-sm">
                <span className={`w-6 ${dowClass(d)}`}>{w}</span>
                <input type="time" name={`open_${d}`} defaultValue={h?.open_time?.slice(0, 5) ?? "06:00"}
                  className="rounded border bg-transparent px-2 py-1 text-sm" />
                <span className="text-muted-foreground">~</span>
                <input type="time" name={`close_${d}`} defaultValue={h?.close_time?.slice(0, 5) ?? "23:00"}
                  className="rounded border bg-transparent px-2 py-1 text-sm" />
                <label className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                  <input type="checkbox" name={`closed_${d}`} defaultChecked={h?.is_closed} className="h-4 w-4" />
                  휴무
                </label>
              </div>
            );
          })}
          <Button type="submit" size="sm" disabled={busy}>저장</Button>
        </form>
      </CardContent>
    </Card>
  );
}
