"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { reserveSlot, cancelReservation, checkIn, logoutMember } from "@/app/actions/member";
import type { SlotView, MyReservation } from "@/lib/member-data";
import { MonthCalendar } from "@/components/MonthCalendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WD, DOW_ORDER, dowClass } from "@/lib/dow";

type Props = {
  today: string;
  date: string;
  membership: { end_date: string; daysLeft: number } | null;
  monthSlots: SlotView[];
  mine: MyReservation[];
  settings: { penalty_enabled: boolean; penalty_hours: number; notice_text: string | null; notice_updated_at: string | null };
  usage: { used: number; weekly_limit: number } | null;
  hours: { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }[];
  notices: { id: string; body: string; created_at: string }[];
};


const fmtDay = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)} (${WD[new Date(d + "T00:00:00Z").getUTCDay()]})`;
const fmtTime = (t: string) => t.slice(0, 5);

export default function DashboardClient(p: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  // 날짜 전환은 서버 왕복 없이 로컬 상태로. 달 이동만 서버에서 새로 받는다.
  const [date, setDate] = useState(p.date);
  useEffect(() => setDate(p.date), [p.date]);

  const slotDates = useMemo(() => new Set(p.monthSlots.map((s) => s.date)), [p.monthSlots]);
  const slots = useMemo(() => p.monthSlots.filter((s) => s.date === date), [p.monthSlots, date]);
  const isPast = date < p.today;
  // 1일 1회: 같은 날 이미 예약이 있으면 그 날의 다른 슬롯은 막힌다
  const reservedToday = slots.some((s) => s.my_status === "reserved");

  // 실시간: 선택 날짜 채널의 slot_changed 브로드캐스트를 받으면 서버 데이터 재조회.
  useEffect(() => {
    const ch = supabaseBrowser
      .channel("slots:" + date)
      .on("broadcast", { event: "slot_changed" }, () => router.refresh())
      .subscribe();
    return () => void supabaseBrowser.removeChannel(ch);
  }, [date, router]);

  const onReserve = (slot: SlotView) =>
    start(async () => {
      const r = await reserveSlot(slot.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.status === "reserved" ? "예약 완료!" : `대기 신청 완료 (대기 ${r.waiting_order}번)`);
    });

  const onCheckIn = (id: string) =>
    start(async () => {
      const r = await checkIn(id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("출석 완료!");
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

      {p.notices.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-3 space-y-2">
            <div className="text-xs font-semibold text-primary">📢 공지사항</div>
            {p.notices.map((n) => (
              <div key={n.id}>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(n.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {p.hours.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">🕒 운영시간</div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
              {DOW_ORDER.map((d) => p.hours.find((x) => x.day_of_week === d)).filter(Boolean).map((h) => (
                <div key={h!.day_of_week}>
                  <div className={dowClass(h!.day_of_week)}>
                    {WD[h!.day_of_week]}
                  </div>
                  <div className="text-muted-foreground mt-0.5 leading-tight">
                    {h!.is_closed || !h!.open_time || !h!.close_time ? (
                      <span className="text-muted-foreground/60">휴무</span>
                    ) : (
                      <>{fmtTime(h!.open_time)}<br />{fmtTime(h!.close_time)}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              이번 주{" "}
              <b className={p.usage.used >= p.usage.weekly_limit ? "text-amber-600" : ""}>
                {p.usage.used}/{p.usage.weekly_limit}회
              </b>{" "}
              사용
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
            date={date}
            today={p.today}
            slotDates={slotDates}
            myDates={new Map(p.monthSlots.filter((s) => s.my_status).map((s) => [s.date, s.my_status === "waiting" ? "waiting" : "reserved"]))}
            onPick={setDate}
            onMonth={(d) => router.push(`/?date=${d}`, { scroll: false })}
            allowPast
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-semibold">{fmtDay(date)}</span>
            {p.settings.penalty_enabled && !isPast && (
              <span className="text-xs text-muted-foreground">
                수업 {p.settings.penalty_hours}시간 전부터 취소 불가
              </span>
            )}
          </div>

          {slots.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">이 날은 수업이 없습니다.</p>
          )}

          {slots.map((s) => {
            const full = s.reserved >= s.capacity;
            const mineHere = s.my_status;
            const blockedDaily = reservedToday && !mineHere;

            return (
              <Card key={s.id} className={isPast ? "opacity-80" : ""}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      {fmtTime(s.start_time)} · {s.is_open_gym ? "자율운동" : s.coach_name}
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
                    {/* 지난 수업: 출석 결과만 보여준다 */}
                    {isPast ? (
                      mineHere === "attended" ? (
                        <Badge>출석</Badge>
                      ) : mineHere === "noshow" || mineHere === "reserved" ? (
                        // 출석을 누르지 않은 채 지난 예약은 미출석으로 본다
                        <Badge variant="destructive">미출석</Badge>
                      ) : mineHere ? (
                        <Badge variant="secondary">예약함</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )
                    ) : mineHere === "attended" ? (
                      <Badge>출석 완료</Badge>
                    ) : date === p.today && mineHere === "reserved" ? (
                      <div className="flex gap-1">
                        <Button size="sm" disabled={busy} onClick={() => onCheckIn(s.my_reservation_id!)}>출석</Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => onCancel(s.my_reservation_id!)}>취소</Button>
                      </div>
                    ) : mineHere === "reserved" || mineHere === "waiting" ? (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => onCancel(s.my_reservation_id!)}>
                        {mineHere === "reserved" ? "예약 취소" : "대기 취소"}
                      </Button>
                    ) : blockedDaily ? (
                      <Button size="sm" disabled>{date === p.today ? "오늘 예약함" : "이 날 예약함"}</Button>
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
                    <Badge variant="default">예약 확정{r.promoted_at ? " (대기→승격)" : ""}</Badge>
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
