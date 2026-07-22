"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addTemplate, editTemplate, closeTemplate, addClosedDate, removeClosedDate } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WD, DOW_ORDER, dowClass } from "@/lib/dow";

type Tpl = { id: string; day_of_week: number; start_time: string; coach_name: string; capacity: number };
type Closed = { date: string; reason: string | null };

// ponytail: 정시 단위만 지원. 30분 단위가 필요해지면 여기에 30분 슬롯을 추가한다.
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 ~ 23:00

export function ScheduleClient({ templates, closed }: { templates: Tpl[]; closed: Closed[] }) {
  const [busy, start] = useTransition();
  const [days, setDays] = useState<number[]>([1]);
  const [hours, setHours] = useState<number[]>([]);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const toggleDay = (i: number) =>
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()));
  const toggleHour = (h: number) =>
    setHours((s) => (s.includes(h) ? s.filter((x) => x !== h) : [...s, h].sort((a, b) => a - b)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold mb-1">주간 시간표</h1>
        <p className="text-xs text-muted-foreground">
          반복 패턴을 정의합니다. 여기 변경은 <b>이미 생성된 슬롯을 바꾸지 않습니다</b>. 다음 슬롯 생성부터 반영됩니다.
        </p>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">항목 추가</CardTitle></CardHeader>
        <CardContent>
          <form
            action={(fd) => start(async () => {
              const r = await addTemplate(fd);
              if (r?.error) return void toast.error(r.error);
              toast.success(`${r.count}개 추가${r.skipped ? ` (${r.skipped}개는 이미 등록됨)` : ""}`);
              setHours([]);
            })}
            className="flex flex-wrap gap-2 items-end"
          >
            <div className="space-y-1">
              <Label className="text-xs">요일 (여러 개 선택 가능)</Label>
              <div className="flex gap-1">
                {DOW_ORDER.map((i) => (
                  <button type="button" key={i} onClick={() => toggleDay(i)}
                    aria-pressed={days.includes(i)}
                    className={`w-8 h-9 rounded text-sm border ${days.includes(i) ? "bg-primary text-primary-foreground border-primary" : dowClass(i)}`}>
                    {WD[i]}
                  </button>
                ))}
              </div>
              {/* 선택한 요일마다 hidden input → 서버에서 getAll로 받는다 */}
              {days.map((d) => (
                <input key={d} type="hidden" name="day_of_week" value={d} />
              ))}
            </div>
            <div className="space-y-1 w-full">
              <Label className="text-xs">시간 (정시, 여러 개 선택 가능)</Label>
              <div className="flex flex-wrap gap-1">
                {HOURS.map((h) => (
                  <button type="button" key={h} onClick={() => toggleHour(h)}
                    aria-pressed={hours.includes(h)}
                    className={`w-11 h-8 rounded text-xs border ${hours.includes(h) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                    {String(h).padStart(2, "0")}:00
                  </button>
                ))}
              </div>
              {hours.map((h) => (
                <input key={h} type="hidden" name="start_time" value={`${String(h).padStart(2, "0")}:00`} />
              ))}
            </div>
            <div className="space-y-1"><Label className="text-xs">코치</Label><Input name="coach_name" required className="w-24" /></div>
            <div className="space-y-1"><Label className="text-xs">정원</Label><Input type="number" name="capacity" min={1} defaultValue={6} required className="w-20" /></div>
            <Button type="submit" disabled={busy || days.length === 0 || hours.length === 0}>
              추가{days.length * hours.length > 1 ? ` (${days.length}요일 × ${hours.length}시간 = ${days.length * hours.length}개)` : ""}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DOW_ORDER.map((i) => {
          const w = WD[i];
          const items = templates.filter((t) => t.day_of_week === i);
          return (
            <Card key={i}>
              <CardHeader className="py-2"><CardTitle className="text-sm">{w}요일</CardTitle></CardHeader>
              <CardContent className="py-2 space-y-1">
                {items.length === 0 && <p className="text-xs text-muted-foreground">없음</p>}
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span>{t.start_time.slice(0, 5)} · {t.coach_name} · {t.capacity}명</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(t)}>수정</Button>
                      <Button size="sm" variant="ghost" className="text-red-500 h-7"
                        disabled={busy}
                        onClick={() => start(async () => {
                          const r = await closeTemplate(t.id);
                          if (r?.error) return void toast.error(r.error);
                          toast.success("폐기했습니다.");
                        })}>
                        폐기
                      </Button>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>시간표 항목 수정</DialogTitle></DialogHeader>
          {editing && (
            <form
              action={(fd) => start(async () => {
                const r = await editTemplate(fd);
                if (r?.error) return void toast.error(r.error);
                toast.success("수정되었습니다."); setEditing(null);
              })}
              className="space-y-3"
            >
              <input type="hidden" name="template_id" value={editing.id} />
              <div className="space-y-1">
                <Label className="text-xs">요일</Label>
                <select name="day_of_week" defaultValue={editing.day_of_week}
                  className="w-full rounded border bg-transparent px-2 py-1.5 text-sm">
                  {DOW_ORDER.map((i) => <option key={i} value={i}>{WD[i]}요일</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">시간</Label><Input type="time" name="start_time" defaultValue={editing.start_time.slice(0, 5)} required /></div>
                <div className="space-y-1"><Label className="text-xs">코치</Label><Input name="coach_name" defaultValue={editing.coach_name} required /></div>
                <div className="space-y-1"><Label className="text-xs">정원</Label><Input type="number" name="capacity" min={1} defaultValue={editing.capacity} required /></div>
              </div>
              <p className="text-xs text-muted-foreground">
                기존 항목을 닫고 새 값으로 다시 등록합니다. <b>이미 생성된 슬롯은 바뀌지 않습니다.</b>
              </p>
              <DialogFooter><Button type="submit" disabled={busy}>저장</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">휴관일</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form
            action={(fd) => start(async () => {
              const r = await addClosedDate(fd);
              if (r?.error) return void toast.error(r.error);
              toast.success("추가되었습니다.");
            })}
            className="flex flex-wrap gap-2 items-end"
          >
            <div className="space-y-1"><Label className="text-xs">날짜</Label><Input type="date" name="date" required /></div>
            <div className="space-y-1"><Label className="text-xs">사유</Label><Input name="reason" placeholder="명절 등" /></div>
            <Button type="submit" disabled={busy}>추가</Button>
          </form>
          <div className="space-y-1">
            {closed.length === 0 && <p className="text-xs text-muted-foreground">예정된 휴관일 없음</p>}
            {closed.map((c) => (
              <div key={c.date} className="flex items-center justify-between text-sm">
                <span>{c.date} {c.reason && <span className="text-muted-foreground">· {c.reason}</span>}</span>
                <Button size="sm" variant="ghost" className="h-7" disabled={busy}
                  onClick={() => start(async () => {
                    const r = await removeClosedDate(c.date);
                    if (r?.error) toast.error(r.error);
                  })}>제거</Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">휴관일로 등록해도 이미 생성된 해당일 슬롯은 자동 삭제되지 않습니다. 타임슬롯 화면에서 개별 삭제하세요.</p>
        </CardContent>
      </Card>
    </div>
  );
}
