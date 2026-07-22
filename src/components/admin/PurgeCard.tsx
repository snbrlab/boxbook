"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { purgeSlots } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const plus = (days: number) => {
  const d = new Date(today() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// 전달 전 초기화용. 되돌릴 수 없으므로 설정 화면 맨 아래에 두고 두 번 확인받는다.
export function PurgeCard() {
  const [busy, start] = useTransition();
  const [from, setFrom] = useState(plus(-365));
  const [to, setTo] = useState(plus(365));

  return (
    <Card className="border-red-500/40">
      <CardHeader className="py-3">
        <CardTitle className="text-base text-red-500">수업 일괄 삭제</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          기간 내 생성된 수업과 <b>그 예약을 전부 삭제</b>합니다. 되돌릴 수 없습니다.
          테스트 데이터를 정리하고 깨끗한 상태로 시작할 때만 쓰세요.
        </p>
        <p className="text-xs text-muted-foreground">
          회원·이용권·주간 시간표는 <b>지워지지 않습니다.</b> 수업(슬롯)과 예약만 사라집니다.
        </p>
        <div className="flex gap-2 items-end">
          <div className="space-y-1"><Label className="text-xs">시작</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">종료</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <Button
          variant="outline"
          className="text-red-500 border-red-500/50"
          disabled={busy}
          onClick={() =>
            start(async () => {
              if (!confirm(`${from} ~ ${to} 기간의 모든 수업과 예약을 삭제합니다.\n\n되돌릴 수 없습니다. 계속할까요?`)) return;
              if (!confirm("정말 삭제할까요? 이 작업은 취소할 수 없습니다.")) return;
              const r = await purgeSlots(from, to);
              if ("error" in r) return void toast.error(r.error as string);
              toast.success(`수업 ${r.slots}개와 관련 예약을 삭제했습니다.`);
            })
          }
        >
          삭제하기
        </Button>
      </CardContent>
    </Card>
  );
}
