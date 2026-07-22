"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateSlot } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Slot = { id: string; start_time: string; coach_name: string; capacity: number };

// 이 슬롯 하나만 고친다. 주간 시간표(반복 패턴)는 그대로다.
export function SlotEditDialog({ slot, open, onClose }: { slot: Slot; open: boolean; onClose: () => void }) {
  const [busy, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{slot.start_time.slice(0, 5)} 수업 수정</DialogTitle></DialogHeader>
        <form
          action={(fd) => start(async () => {
            const r = await updateSlot(slot.id, {
              start_time: String(fd.get("start_time")),
              coach_name: String(fd.get("coach_name")).trim(),
              capacity: Number(fd.get("capacity")),
            });
            if (r?.error) return void toast.error(r.error);
            toast.success("수정되었습니다."); onClose();
          })}
          className="space-y-3"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label className="text-xs">시간</Label><Input type="time" name="start_time" defaultValue={slot.start_time.slice(0, 5)} required /></div>
            <div className="space-y-1"><Label className="text-xs">코치</Label><Input name="coach_name" defaultValue={slot.coach_name} required /></div>
            <div className="space-y-1"><Label className="text-xs">정원</Label><Input type="number" name="capacity" min={1} defaultValue={slot.capacity} required /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            이 수업 하나만 바뀝니다. 매주 반복되는 설정은 <b>주간 시간표</b>에서 고치세요.
          </p>
          <DialogFooter><Button type="submit" disabled={busy}>저장</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
