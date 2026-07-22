"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { generateSlots } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

// today+0 ~ +21 보충 생성(멱등). Cron과 별개로 관리자가 즉시 채우고 싶을 때.
export function GenerateButton() {
  const [busy, start] = useTransition();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const to = new Date(today + "T00:00:00Z");
  to.setUTCDate(to.getUTCDate() + 21);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await generateSlots(today, to.toISOString().slice(0, 10));
          if ("error" in r) toast.error(r.error as string);
          else toast.success(`슬롯 ${r.inserted}개 생성 · 고정 수업 ${r.autoReserved}건 예약`);
        })
      }
    >
      슬롯 채우기
    </Button>
  );
}
