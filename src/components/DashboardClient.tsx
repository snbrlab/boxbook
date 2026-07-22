"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { reserveSlot, cancelReservation, logoutMember } from "@/app/actions/member";
import type { SlotView, MyReservation } from "@/lib/member-data";
import { MonthCalendar } from "@/components/MonthCalendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  today: string;
  date: string;
  membership: { end_date: string; daysLeft: number } | null;
  slots: SlotView[];
  reservedToday: boolean;
  mine: MyReservation[];
  settings: { penalty_enabled: boolean; penalty_hours: number };
  slotDates: string[];
  usage: { used: number; weekly_limit: number } | null;
};

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDay = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)} (${WD[new Date(d + "T00:00:00Z").getUTCDay()]})`;
const fmtTime = (t: string) => t.slice(0, 5);

export default function DashboardClient(p: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();

  // 실시간: 선택 날짜 채널의 slot_changed 브로드캐스트를 받으면 서버 데이터 재조회(router.refresh).
  // 클라이언트에서 정원/대기를 임의 계산하지 않는다.
  useEffect(() => {
    const ch = supabaseBrowser
      .channel("slots:" + p.date)
      .on("broadcast", { event: "slot_changed" }, () => router.refresh())
      .subscribe();
    return () => void supabaseBrowser.removeChannel(ch);
  }, [p.date, router]);

  const go = (d: string) => router.push(`/?date=${d}`);

  const onReserve = (slot: SlotView) =>
    start(async () => {
      const r = await reserveSlot(slot.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.status === "reserved" ? "예약 완료!" : `대기 신청 완료 (대기 ${r.waiting_order}번)`);
    });

  const onCancel = (id: string) =>
    start(async () => {
      const r = await cancelReservation(id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("취소되었습니다.");
    });

  return (
    <main className="max-w-md mx-auto p-4 pb-24 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">🥊 복싱 예약</h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => start(async () => void (await logoutMember()))}>
            로그아웃
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="py-3 text-sm">
          {p.membership ? (
            <span>
              남은 회원권 <b className={p.membership.daysLeft <= 7 ? "text-red-500" : ""}>{p.membership.daysLeft}일</b>
              <span className="text-muted-foreground"> ({p.membership.end_date} 까지)</span>
            </span>
          ) : (
            <span className="text-red-500">유효한 회원권이 없습니다. 관장님께 문의하세요.</span>
          )}
          {p.usage && (
            <div className="text-xs text-muted-foreground mt-1">
              이번 주 <b className={p.usage.used >= p.usage.weekly_limit ? "text-amber-600" : ""}>
                {p.usage.used}/{p.usage.weekly_limit}회
              </b> 사용
              {p.usage.used >= p.usage.weekly_limit && " · 이번 주 예약을 모두 사용했습니다"}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="book">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="book">예약하기</TabsTrigger>
          <TabsTrigger value="mine">내 예약{p.mine.length ? ` (${p.mine.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="space-y-3">
          <MonthCalendar
            date={p.date}
            today={p.today}
            slotDates={new Set(p.slotDates)}
            myDates={new Map(p.mine.map((r) => [r.date, r.status]))}
            onPick={go}
            onMonth={go}
          />

          <div className="text-sm font-semibold pt-1">{fmtDay(p.date)} 수업</div>

          {p.settings.penalty_enabled && (
            <p className="text-xs text-muted-foreground">
              ⚠️ 수업 시작 {p.settings.penalty_hours}시간 전부터는 취소할 수 없습니다.
            </p>
          )}

          {p.slots.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">이 날은 수업이 없습니다.</p>}

          {p.slots.map((s) => {
            const full = s.reserved >= s.capacity;
            const mineHere = s.my_status;
            // 1일 1회: 같은 날 다른 슬롯에 이미 예약 → 이 슬롯 버튼 비활성 + 이유 표시
            const blockedDaily = p.reservedToday && !mineHere;
            return (
              <Card key={s.id}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      {fmtTime(s.start_time)} · {s.coach_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      예약 {s.reserved}/{s.capacity}
                      {s.waiting > 0 && ` · 대기 ${s.waiting}명`}
                    </div>
                    {mineHere === "waiting" && (
                      <div className="text-xs text-amber-600">내 대기 순번 {s.my_waiting_order}번</div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {mineHere ? (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => onCancel(s.my_reservation_id!)}>
                        {mineHere === "reserved" ? "예약 취소" : "대기 취소"}
                      </Button>
                    ) : blockedDaily ? (
                      <div className="text-right">
                        <Button size="sm" disabled>오늘 예약함</Button>
                      </div>
                    ) : (
                      <Button size="sm" disabled={busy} variant={full ? "secondary" : "default"} onClick={() => onReserve(s)}>
                        {full ? "대기 신청" : "예약하기"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3">
          {p.mine.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">예약 내역이 없습니다.</p>}
          {p.mine.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {fmtDay(r.date)} {fmtTime(r.start_time)} · {r.coach_name}
                  </div>
                  {r.status === "reserved" ? (
                    <Badge variant="default">
                      예약 확정{r.promoted_at ? " (대기→승격)" : ""}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">대기 {r.waiting_order}번</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onCancel(r.id)}>
                  취소
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </main>
  );
}
