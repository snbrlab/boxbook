"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { addNotice, toggleNotice, deleteNotice } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Notice = { id: string; body: string; is_active: boolean; created_at: string };
const fmt = (t: string) => new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

// 공지는 수정하지 않고 새로 올린다. 지난 공지가 이력으로 남는다.
export function NoticesCard({ notices }: { notices: Notice[] }) {
  const [busy, start] = useTransition();

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>공지사항</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form
          action={(fd) => start(async () => {
            const r = await addNotice(fd);
            if (r?.error) return void toast.error(r.error);
            toast.success("공지를 등록했습니다.");
            (document.getElementById("notice-body") as HTMLTextAreaElement).value = "";
          })}
          className="space-y-2"
        >
          <textarea
            id="notice-body"
            name="body"
            rows={3}
            placeholder="회원 화면 상단에 표시할 공지를 입력하세요."
            className="w-full rounded-lg border bg-transparent p-2 text-sm"
          />
          <Button type="submit" size="sm" disabled={busy}>등록</Button>
        </form>

        <div className="space-y-2">
          {notices.length === 0 && <p className="text-xs text-muted-foreground">등록된 공지가 없습니다.</p>}
          {notices.map((n) => (
            <div key={n.id} className={`rounded-lg border p-2 space-y-1 ${n.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{fmt(n.created_at)}</span>
                <div className="flex items-center gap-1">
                  {n.is_active ? <Badge className="text-[10px]">게시중</Badge> : <Badge variant="outline" className="text-[10px]">내림</Badge>}
                  <Button size="sm" variant="ghost" className="h-7" disabled={busy}
                    onClick={() => start(async () => {
                      const r = await toggleNotice(n.id, !n.is_active);
                      if (r?.error) toast.error(r.error);
                    })}>
                    {n.is_active ? "내리기" : "올리기"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-red-500" disabled={busy}
                    onClick={() => start(async () => {
                      if (!confirm("이 공지를 삭제할까요? 이력에서도 사라집니다.")) return;
                      const r = await deleteNotice(n.id);
                      if (r?.error) toast.error(r.error);
                    })}>
                    삭제
                  </Button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
