"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { setAttendance, deleteSlot, restoreSlot, toggleOpenGym } from "@/app/actions/admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Person = { id: string; status: string; waiting_order: number | null; name: string; phone: string; isNew: boolean };
type Slot = { id: string; start_time: string; coach_name: string; capacity: number; is_open_gym: boolean; is_cancelled: boolean; reserved: Person[]; waiting: Person[] };

export function AdminSlotCard({ slot }: { slot: Slot }) {
  const [busy, start] = useTransition();

  const attend = (id: string, status: "attended" | "noshow" | "reserved") =>
    start(async () => {
      const r = await setAttendance(id, status);
      if (r?.error) toast.error(r.error);
    });

  const onDelete = () =>
    start(async () => {
      const n = slot.reserved.length + slot.waiting.length;
      const msg = n > 0
        ? `예약자 ${n}명이 있는 슬롯입니다. 취소하면 예약도 함께 취소됩니다. 계속할까요?`
        : "이 슬롯을 취소할까요?";
      if (!confirm(msg)) return;
      const r = await deleteSlot(slot.id);
      if (r?.error) return void toast.error(r.error);
      toast.success("슬롯을 취소했습니다.");
    });

  const onRestore = () =>
    start(async () => {
      const r = await restoreSlot(slot.id);
      if (r?.error) return void toast.error(r.error);
      toast.success("슬롯을 복구했습니다.");
    });

  return (
    <Card className={slot.is_cancelled ? "opacity-50 border-dashed" : ""}>
      <CardHeader className="flex-row items-center justify-between py-3 space-y-0">
        <div className="font-semibold">
          {slot.start_time.slice(0, 5)} · {slot.is_open_gym ? "자율운동" : slot.coach_name}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({slot.reserved.filter((r) => r.status !== "noshow").length}/{slot.capacity})
          </span>
          {slot.is_cancelled && <Badge variant="outline" className="ml-1 text-[10px]">취소됨</Badge>}
        </div>
        <div className="flex gap-1">
          {slot.is_cancelled ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>복구</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" disabled={busy}
                onClick={() => start(async () => {
                  const r = await toggleOpenGym(slot.id, !slot.is_open_gym);
                  if (r?.error) toast.error(r.error);
                })}>
                {slot.is_open_gym ? "수업으로" : "자율운동으로"}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500" disabled={busy} onClick={onDelete}>
                취소
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {slot.reserved.length === 0 && slot.waiting.length === 0 && (
          <p className="text-sm text-muted-foreground">예약 없음</p>
        )}
        {slot.reserved.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium truncate">{p.name}</span>
              {p.isNew && <Badge variant="secondary" className="text-[10px]">신규</Badge>}
              {p.status === "attended" && <Badge className="text-[10px]">출석</Badge>}
              {p.status === "noshow" && <Badge variant="destructive" className="text-[10px]">노쇼</Badge>}
              <span className="text-muted-foreground text-xs">{p.phone}</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant={p.status === "attended" ? "default" : "outline"} disabled={busy} onClick={() => attend(p.id, p.status === "attended" ? "reserved" : "attended")}>출석</Button>
              <Button size="sm" variant={p.status === "noshow" ? "destructive" : "outline"} disabled={busy} onClick={() => attend(p.id, p.status === "noshow" ? "reserved" : "noshow")}>노쇼</Button>
            </div>
          </div>
        ))}
        {slot.waiting.length > 0 && (
          <div className="pt-1 border-t">
            <p className="text-xs text-muted-foreground mb-1">대기자</p>
            {slot.waiting.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">{p.waiting_order}.</span>
                <span className="font-medium">{p.name}</span>
                {p.isNew && <Badge variant="secondary" className="text-[10px]">신규</Badge>}
                <span className="text-muted-foreground text-xs">{p.phone}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
