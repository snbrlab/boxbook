"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMember, extendMembership, toggleMemberActive } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Member = {
  id: string; name: string; phone: string; is_active: boolean; isNew: boolean;
  active: { end_date: string; weekly_limit: number } | null;
  daysLeft: number | null;
  history: { start_date: string; end_date: string; weekly_limit: number; payment_memo: string | null }[];
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export function MembersClient({ members }: { members: Member[] }) {
  const [busy, start] = useTransition();
  const [openNew, setOpenNew] = useState(false);
  const [extendFor, setExtendFor] = useState<Member | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">회원 ({members.length})</h1>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger render={<Button size="sm" />}>신규 등록</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>신규 회원 등록</DialogTitle></DialogHeader>
            <form
              action={(fd) => start(async () => {
                const r = await createMember(fd);
                if (r?.error) return void toast.error(r.error.includes("duplicate") ? "이미 등록된 회원입니다." : r.error);
                toast.success("등록되었습니다."); setOpenNew(false);
              })}
              className="space-y-3"
            >
              <div className="space-y-1.5"><Label htmlFor="n">이름</Label><Input id="n" name="name" required /></div>
              <div className="space-y-1.5"><Label htmlFor="p">전화번호</Label><Input id="p" name="phone" placeholder="010-0000-0000" required /></div>
              <DialogFooter><Button type="submit" disabled={busy}>등록</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {members.map((m) => {
        const expiring = m.daysLeft !== null && m.daysLeft <= 7;
        return (
          <Card key={m.id} className={expiring ? "border-red-500/60" : ""}>
            <CardContent className="py-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold">{m.name}</span>
                  {m.isNew && <Badge variant="secondary" className="text-[10px]">신규</Badge>}
                  {!m.is_active && <Badge variant="outline" className="text-[10px]">비활성</Badge>}
                  <span className="text-xs text-muted-foreground">{m.phone}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setExtendFor(m)}>이용권 연장</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => start(async () => { await toggleMemberActive(m.id, !m.is_active); })}>
                    {m.is_active ? "비활성" : "활성"}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {m.active ? (
                  <span className={expiring ? "text-red-500" : ""}>
                    회원권 {m.active.end_date}까지 (주 {m.active.weekly_limit}회, {m.daysLeft}일 남음)
                  </span>
                ) : (
                  <span className="text-red-500">유효 회원권 없음</span>
                )}
                {m.history.length > 1 && <span> · 이력 {m.history.length}건</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* 이용권 연장: 새 이력 로우를 쌓는다 */}
      <Dialog open={!!extendFor} onOpenChange={(o) => !o && setExtendFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{extendFor?.name} 이용권 연장</DialogTitle></DialogHeader>
          {extendFor && (
            <form
              action={(fd) => start(async () => {
                const r = await extendMembership(fd);
                if (r?.error) return void toast.error(r.error);
                toast.success("이용권을 추가했습니다."); setExtendFor(null);
              })}
              className="space-y-3"
            >
              <input type="hidden" name="member_id" value={extendFor.id} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="sd">시작일</Label><Input id="sd" type="date" name="start_date" defaultValue={extendFor.active?.end_date ?? today()} required /></div>
                <div className="space-y-1.5"><Label htmlFor="ed">종료일</Label><Input id="ed" type="date" name="end_date" required /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="wl">주간 횟수</Label><Input id="wl" type="number" name="weekly_limit" min={1} defaultValue={extendFor.active?.weekly_limit ?? 3} required /></div>
              <div className="space-y-1.5"><Label htmlFor="pm">결제 메모</Label><Input id="pm" name="payment_memo" placeholder="3개월 등록 등" /></div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="ghost" />}>취소</DialogClose>
                <Button type="submit" disabled={busy}>추가</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
