"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMember, extendMembership, toggleMemberActive, updateMember } from "@/app/actions/admin";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Member = {
  id: string; name: string; phone: string; is_active: boolean; isNew: boolean;
  signature: string | null; agreed_at: string | null;
  active: { end_date: string; weekly_limit: number } | null;
  daysLeft: number | null;
  history: { start_date: string; end_date: string; weekly_limit: number; payment_memo: string | null }[];
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const plusMonths = (n: number) => {
  const d = new Date(today() + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

export function MembersClient({ members, rulesText }: { members: Member[]; rulesText: string | null }) {
  const [busy, start] = useTransition();
  const [openNew, setOpenNew] = useState(false);
  const [extendFor, setExtendFor] = useState<Member | null>(null);
  const [editFor, setEditFor] = useState<Member | null>(null);
  const [viewSig, setViewSig] = useState<Member | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">회원 ({members.length})</h1>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger render={<Button size="sm" />}>신규 등록</DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>신규 회원 등록</DialogTitle></DialogHeader>
            <form
              action={(fd) => start(async () => {
                const r = await createMember(fd);
                if (r?.error) return void toast.error(r.error.includes("duplicate") ? "이미 등록된 회원입니다." : r.error);
                toast.success("등록되었습니다."); setOpenNew(false);
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="n">이름</Label><Input id="n" name="name" required /></div>
                <div className="space-y-1.5"><Label htmlFor="p">전화번호</Label><Input id="p" name="phone" placeholder="010-0000-0000" required /></div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">이용권 <span className="text-xs font-normal text-muted-foreground">(비워두면 나중에 등록)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="sd" className="text-xs">시작일</Label><Input id="sd" type="date" name="start_date" defaultValue={today()} /></div>
                  <div className="space-y-1.5"><Label htmlFor="ed" className="text-xs">종료일</Label><Input id="ed" type="date" name="end_date" defaultValue={plusMonths(1)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="wl" className="text-xs">주간 횟수</Label><Input id="wl" type="number" name="weekly_limit" min={1} defaultValue={3} /></div>
                  <div className="space-y-1.5"><Label htmlFor="pm" className="text-xs">결제 메모</Label><Input id="pm" name="payment_memo" placeholder="1개월 등록" /></div>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">체육관 규정 동의</p>
                {rulesText ? (
                  <div className="max-h-40 overflow-y-auto text-xs whitespace-pre-wrap rounded bg-muted p-2">{rulesText}</div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    규정이 아직 등록되지 않았습니다. 설정 화면에서 먼저 작성하세요.
                  </p>
                )}
                <SignaturePad name="signature" />
              </div>

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
                  {!m.signature && <Badge variant="outline" className="text-[10px] text-amber-600">서명없음</Badge>}
                  <span className="text-xs text-muted-foreground">{m.phone}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setExtendFor(m)}>연장</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditFor(m)}>수정</Button>
                  {m.signature && <Button size="sm" variant="ghost" onClick={() => setViewSig(m)}>서명</Button>}
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

      {/* 정보 수정 (전화번호 변경 시 로그인도 새 번호 기준) */}
      <Dialog open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>회원 정보 수정</DialogTitle></DialogHeader>
          {editFor && (
            <form
              action={(fd) => start(async () => {
                const r = await updateMember(fd);
                if (r?.error) return void toast.error(r.error);
                toast.success("수정되었습니다."); setEditFor(null);
              })}
              className="space-y-3"
            >
              <input type="hidden" name="member_id" value={editFor.id} />
              <div className="space-y-1.5"><Label htmlFor="en">이름</Label><Input id="en" name="name" defaultValue={editFor.name} required /></div>
              <div className="space-y-1.5"><Label htmlFor="ep">전화번호</Label><Input id="ep" name="phone" defaultValue={editFor.phone} required /></div>
              <p className="text-xs text-muted-foreground">전화번호를 바꾸면 회원은 새 번호 뒤 4자리로 로그인합니다.</p>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" disabled={busy}
                  onClick={() => start(async () => { await toggleMemberActive(editFor.id, !editFor.is_active); setEditFor(null); })}>
                  {editFor.is_active ? "비활성화" : "활성화"}
                </Button>
                <Button type="submit" disabled={busy}>저장</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
                <div className="space-y-1.5"><Label htmlFor="xsd">시작일</Label><Input id="xsd" type="date" name="start_date" defaultValue={extendFor.active?.end_date ?? today()} required /></div>
                <div className="space-y-1.5"><Label htmlFor="xed">종료일</Label><Input id="xed" type="date" name="end_date" required /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="xwl">주간 횟수</Label><Input id="xwl" type="number" name="weekly_limit" min={1} defaultValue={extendFor.active?.weekly_limit ?? 3} required /></div>
              <div className="space-y-1.5"><Label htmlFor="xpm">결제 메모</Label><Input id="xpm" name="payment_memo" placeholder="3개월 등록 등" /></div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="ghost" />}>취소</DialogClose>
                <Button type="submit" disabled={busy}>추가</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 서명 보기 */}
      <Dialog open={!!viewSig} onOpenChange={(o) => !o && setViewSig(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewSig?.name} 서명</DialogTitle></DialogHeader>
          {viewSig?.signature && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewSig.signature} alt="서명" className="w-full rounded border bg-white" />
              <p className="text-xs text-muted-foreground">
                동의 일시: {viewSig.agreed_at ? new Date(viewSig.agreed_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
