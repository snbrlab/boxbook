"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { extendMembership, updateMembership, deleteMembership } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type Membership = {
  id: string; start_date: string; end_date: string; weekly_limit: number; payment_memo: string | null;
};
type Member = { id: string; name: string; history: Membership[]; active: { end_date: string; weekly_limit: number } | null };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export function MembershipDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<Membership | null>(null);

  const close = () => { setEditing(null); onClose(); };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{member?.name} 이용권</DialogTitle></DialogHeader>
        {member && (
          <div className="space-y-4">
            {/* 기존 이력: 수정은 오타 정정용 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">이력 ({member.history.length})</p>
              {member.history.length === 0 && <p className="text-xs text-muted-foreground">등록된 이용권이 없습니다.</p>}
              {member.history.map((h) => {
                const isActive = h.start_date <= today() && h.end_date >= today();
                return editing?.id === h.id ? (
                  <form
                    key={h.id}
                    action={(fd) => start(async () => {
                      const r = await updateMembership(fd);
                      if (r?.error) return void toast.error(r.error);
                      toast.success("수정되었습니다."); setEditing(null);
                    })}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <input type="hidden" name="membership_id" value={h.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs">시작일</Label><Input type="date" name="start_date" defaultValue={h.start_date} required /></div>
                      <div className="space-y-1"><Label className="text-xs">종료일</Label><Input type="date" name="end_date" defaultValue={h.end_date} required /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs">주간 횟수</Label><Input type="number" name="weekly_limit" min={1} defaultValue={h.weekly_limit} required /></div>
                      <div className="space-y-1"><Label className="text-xs">메모</Label><Input name="payment_memo" defaultValue={h.payment_memo ?? ""} /></div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>취소</Button>
                      <Button type="submit" size="sm" disabled={busy}>저장</Button>
                    </div>
                  </form>
                ) : (
                  <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span>{h.start_date} ~ {h.end_date}</span>
                        {isActive && <Badge className="text-[10px]">사용중</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        주 {h.weekly_limit}회{h.payment_memo && ` · ${h.payment_memo}`}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(h)}>수정</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-red-500" disabled={busy}
                        onClick={() => start(async () => {
                          if (!confirm(`${h.start_date} ~ ${h.end_date} 이용권을 삭제할까요?`)) return;
                          const r = await deleteMembership(h.id);
                          if (r?.error) return void toast.error(r.error);
                          toast.success("삭제했습니다.");
                        })}>삭제</Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 연장: 새 이력을 쌓는다 (덮어쓰지 않음) */}
            <form
              action={(fd) => start(async () => {
                const r = await extendMembership(fd);
                if (r?.error) return void toast.error(r.error);
                toast.success("이용권을 추가했습니다."); close();
              })}
              className="rounded-lg border p-3 space-y-2"
            >
              <p className="text-sm font-medium">이용권 추가 (연장)</p>
              <input type="hidden" name="member_id" value={member.id} />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">시작일</Label><Input type="date" name="start_date" defaultValue={member.active?.end_date ?? today()} required /></div>
                <div className="space-y-1"><Label className="text-xs">종료일</Label><Input type="date" name="end_date" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">주간 횟수</Label><Input type="number" name="weekly_limit" min={1} defaultValue={member.active?.weekly_limit ?? 3} required /></div>
                <div className="space-y-1"><Label className="text-xs">메모</Label><Input name="payment_memo" placeholder="3개월 등록 등" /></div>
              </div>
              <Button type="submit" size="sm" disabled={busy}>추가</Button>
            </form>

            <p className="text-xs text-muted-foreground">
              기간을 늘릴 땐 <b>추가</b>를 쓰세요. 이전 조건이 이력에 남습니다. <b>수정</b>은 잘못 입력한 값을 바로잡을 때만 쓰세요.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
