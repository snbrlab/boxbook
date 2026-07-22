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
  const [coach, setCoach] = useState("");
  const [capacity, setCapacity] = useState(6);
  const [filter, setFilter] = useState<string>("");   // 코치별 보기 ("" = 전체)

  const coaches = [...new Set(templates.map((t) => t.coach_name))].sort();
  const shown = filter ? templates.filter((t) => t.coach_name === filter) : templates;

  // 선택한 코치+요일의 현재 시간대 (sync 시 무엇이 사라지는지 보여주기 위함)
  const currentTimes = coach
    ? [...new Set(templates.filter((t) => t.coach_name === coach && days.includes(t.day_of_week))
        .map((t) => t.start_time.slice(0, 5)))].sort()
    : [];
  const picked = hours.map((h) => `${String(h).padStart(2, "0")}:00`);
  const willRemove = currentTimes.filter((t) => !picked.includes(t));

  const submit = (mode: "add" | "sync") => {
    const fd = new FormData();
    days.forEach((d) => fd.append("day_of_week", String(d)));
    picked.forEach((t) => fd.append("start_time", t));
    fd.set("coach_name", coach);
    fd.set("capacity", String(capacity));
    fd.set("mode", mode);
    start(async () => {
      const r = await addTemplate(fd);
      if (r?.error) return void toast.error(r.error);
      const parts = [];
      if (r.added) parts.push(`${r.added}개 추가`);
      if (r.replaced) parts.push(`${r.replaced}개 변경`);
      if (r.removed) parts.push(`${r.removed}개 폐기`);
      if (r.unchanged) parts.push(`${r.unchanged}개 그대로`);
      toast.success(parts.join(" · ") || "변경 없음");
      setHours([]);
    });
  };
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
        <CardHeader className="py-3"><CardTitle className="text-base">시간표 등록 / 일괄 변경</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">코치</Label>
              <Input value={coach} onChange={(e) => setCoach(e.target.value)}
                list="coach-list" placeholder="이름" className="w-28" />
              <datalist id="coach-list">
                {coaches.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">정원</Label>
              <Input type="number" min={1} value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))} className="w-20" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">요일</Label>
            <div className="flex gap-1">
              {DOW_ORDER.map((i) => (
                <button type="button" key={i} onClick={() => toggleDay(i)}
                  aria-pressed={days.includes(i)}
                  className={`w-9 h-9 rounded text-sm border ${days.includes(i) ? "bg-primary text-primary-foreground border-primary" : dowClass(i)}`}>
                  {WD[i]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">시간 (정시)</Label>
            <div className="flex flex-wrap gap-1">
              {HOURS.map((h) => {
                const on = hours.includes(h);
                const existing = currentTimes.includes(`${String(h).padStart(2, "0")}:00`);
                return (
                  <button type="button" key={h} onClick={() => toggleHour(h)} aria-pressed={on}
                    className={`w-11 h-8 rounded text-xs border ${
                      on ? "bg-primary text-primary-foreground border-primary"
                         : existing ? "border-primary/50 text-primary" : ""}`}>
                    {String(h).padStart(2, "0")}:00
                  </button>
                );
              })}
            </div>
            {coach && currentTimes.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                테두리 표시 = {coach} 코치가 선택 요일에 현재 운영 중인 시간
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button type="button" disabled={busy || !coach || days.length === 0 || hours.length === 0}
              onClick={() => submit("add")}>
              추가/변경
            </Button>
            <Button type="button" variant="outline"
              disabled={busy || !coach || days.length === 0}
              onClick={() => {
                if (willRemove.length > 0 &&
                    !confirm(`${coach} 코치의 선택 요일에서 ${willRemove.join(", ")} 시간대가 폐기됩니다. 계속할까요?`)) return;
                submit("sync");
              }}>
              이 시간표로 맞추기{willRemove.length > 0 ? ` (${willRemove.length}개 폐기)` : ""}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <b>추가/변경</b>은 선택한 조합만 반영합니다. <b>맞추기</b>는 선택 요일에서 이 코치의 시간표를
            선택한 시간들과 일치시킵니다(선택 안 한 시간대는 폐기). 이미 생성된 슬롯은 바뀌지 않습니다.
          </p>
        </CardContent>
      </Card>

      {coaches.length > 1 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs text-muted-foreground mr-1">코치별 보기</span>
          <Button size="sm" variant={filter === "" ? "default" : "ghost"} onClick={() => setFilter("")}>전체</Button>
          {coaches.map((c) => (
            <Button key={c} size="sm" variant={filter === c ? "default" : "ghost"} onClick={() => setFilter(c)}>{c}</Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DOW_ORDER.map((i) => {
          const w = WD[i];
          const items = shown.filter((t) => t.day_of_week === i);
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
