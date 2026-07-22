"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { generateSlots } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

// 지금 보고 있는 달(1일~말일)을 채운다. 멱등이라 여러 번 눌러도 중복 생성되지 않는다.
export function GenerateButton({ date }: { date: string }) {
  const [busy, start] = useTransition();

  const from = date.slice(0, 8) + "01";
  const last = new Date(from + "T00:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const to = last.toISOString().slice(0, 10);
  const label = `${Number(date.slice(5, 7))}월 슬롯 채우기`;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await generateSlots(from, to);
          if ("error" in r) toast.error(r.error as string);
          else toast.success(`슬롯 ${r.inserted}개 생성 · 고정 수업 ${r.autoReserved}건 예약`);
        })
      }
    >
      {label}
    </Button>
  );
}
