"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginMember } from "@/app/actions/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MemberLogin() {
  const [state, action, pending] = useActionState(loginMember, null as any);
  const needFull = state && !state.ok && state.needFullPhone;

  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">🥊 복싱 예약</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">이름</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tail">전화번호 뒤 4자리</Label>
              <Input
                id="tail"
                name="phone_tail"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                placeholder="0000"
                required
              />
            </div>
            {/* 동명이인 + 같은 뒷자리일 때만 전체 번호를 추가로 받는다 */}
            {needFull && (
              <div className="space-y-1.5">
                <Label htmlFor="full">전화번호 전체</Label>
                <Input id="full" name="phone_full" inputMode="tel" placeholder="010-0000-0000" required />
              </div>
            )}
            {state && !state.ok && <p className="text-sm text-red-500">{state.error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "확인 중…" : "입장하기"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              등록된 회원만 입장할 수 있습니다. 문의는 관장님께.
            </p>
          </form>

          <div className="mt-4 pt-4 border-t text-center">
            <Button variant="ghost" size="sm" render={<Link href="/admin/login" />}>
              관리자 로그인 →
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
