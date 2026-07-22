"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adminReserve } from "@/app/actions/admin";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Option = { id: string; name: string; phone: string };

// 관리자가 회원을 수업에 직접 넣는다. [보강]을 켜면 1일1회·주간횟수를 건너뛴다.
export function AddMemberDialog({ slotId, members, open, onClose }: {
  slotId: string; members: Option[]; open: boolean; onClose: () => void;
}) {
  const [busy, start] = useTransition();
  const [q, setQ] = useState("");
  const [force, setForce] = useState(false);

  const filtered = q
    ? members.filter((m) => m.name.includes(q) || m.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
    : members.slice(0, 20);

  const add = (m: Option) =>
    start(async () => {
      const r = await adminReserve(slotId, m.id, force);
      if (r?.error) return void toast.error(r.error);
      toast.success(
        r.status === "reserved"
          ? `${m.name} 예약 완료${force ? " (보강)" : ""}`
          : `${m.name} 대기 ${r.waiting_order}번 (정원이 찼습니다)`,
      );
      onClose();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setQ(""); setForce(false); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>회원 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="이름 또는 전화번호로 검색" value={q} onChange={(e) => setQ(e.target.value)} />

          <label className="flex items-start gap-2 rounded-lg border p-2">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4 mt-0.5" />
            <span className="text-sm">
              보강으로 넣기
              <span className="block text-xs text-muted-foreground">
                하루 1회·주간 횟수 제한을 건너뜁니다. 못 온 수업을 채워줄 때 쓰세요.
                이용권 기간과 정원은 그대로 지켜집니다.
              </span>
            </span>
          </label>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">검색 결과 없음</p>}
            {filtered.map((m) => (
              <button key={m.id} disabled={busy} onClick={() => add(m)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted disabled:opacity-50">
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.phone}</span>
              </button>
            ))}
            {!q && members.length > 20 && (
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                {members.length}명 중 20명 표시 — 검색해서 찾으세요
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
