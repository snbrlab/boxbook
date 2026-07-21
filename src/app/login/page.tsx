"use client";
import { useActionState } from "react";
import { loginMember } from "@/app/actions/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MemberLogin() {
  const [state, action, pending] = useActionState(loginMember, null as any);
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
              <Label htmlFor="phone">전화번호</Label>
              <Input id="phone" name="phone" inputMode="tel" placeholder="010-0000-0000" required />
            </div>
            {state && !state.ok && <p className="text-sm text-red-500">{state.error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "확인 중…" : "입장하기"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              등록된 회원만 입장할 수 있습니다. 문의는 관장님께.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
