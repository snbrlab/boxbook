"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkImportMembers } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

// 종이 명부 이관용. 엑셀/메모장에서 복사해 붙여넣으면 줄 단위로 등록한다.
export function BulkImportDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState<{ line: string; reason: string }[]>([]);
  const [busy, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFailed([]); }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>일괄 등록</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>회원 일괄 등록</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>한 줄에 한 명씩. 쉼표 또는 탭으로 구분합니다. (엑셀에서 복사해 붙여넣기 가능)</p>
            <pre className="rounded bg-muted p-2 text-[11px] whitespace-pre-wrap">
{`이름,전화번호,시작일,종료일,주간횟수,메모
홍길동,010-1234-5678,2026-07-01,2026-08-01,3,3개월 등록
김철수,010-2222-3333`}
            </pre>
            <p>시작일 뒤는 생략 가능합니다 (이용권 없이 회원만 등록).</p>
          </div>

          <textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="여기에 붙여넣기"
            className="w-full rounded-lg border bg-transparent p-2 text-sm font-mono"
          />

          {failed.length > 0 && (
            <div className="rounded-lg border border-red-500/50 p-2 space-y-1">
              <p className="text-xs font-medium text-red-500">등록 실패 {failed.length}건</p>
              {failed.map((f, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{f.line}</span> — {f.reason}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={busy || !text.trim()}
              onClick={() => start(async () => {
                const r = await bulkImportMembers(text);
                setFailed(r.failed);
                if (r.added > 0) toast.success(`${r.added}명 등록 완료`);
                if (r.failed.length === 0) { setOpen(false); setText(""); }
                else toast.error(`${r.failed.length}건 실패 — 아래 확인`);
              })}
            >
              등록
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
