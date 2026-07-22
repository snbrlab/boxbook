"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { downloadBackup } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BackupCard() {
  const [busy, start] = useTransition();

  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-base">백업</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          회원·이용권·예약·출석 기록을 파일 하나로 내려받습니다.
          <b> 한 달에 한 번</b> 정도 받아서 PC나 클라우드에 보관해 두세요.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await downloadBackup();
              if (!r.ok) return void toast.error(r.error);
              // 브라우저에서 바로 파일로 저장
              const blob = new Blob([r.json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
              a.href = url;
              a.download = `boxbook-backup-${d}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`회원 ${r.counts.members}명 · 예약 ${r.counts.reservations}건 백업 완료`);
            })
          }
        >
          백업 파일 내려받기
        </Button>
        <p className="text-[11px] text-muted-foreground">
          ⚠️ 회원 이름·전화번호·서명이 들어 있습니다. 아무 데나 두지 마세요.
        </p>
      </CardContent>
    </Card>
  );
}
