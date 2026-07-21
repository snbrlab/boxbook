"use client";
import { useActionState } from "react";
import { adminLogin } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(adminLogin, null as any);
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">관리자 로그인</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "확인 중…" : "로그인"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
