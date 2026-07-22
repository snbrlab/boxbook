"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAdmin, removeAdmin } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Admin = { id: string; email: string; created_at: string };

export function AdminsCard({ me, admins }: { me: string | null; admins: Admin[] }) {
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>관리자 ({admins.length})</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "닫기" : "추가"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <form
            action={(fd) =>
              start(async () => {
                const r = await createAdmin(fd);
                if (r?.error) return void toast.error(r.error);
                toast.success("관리자를 추가했습니다.");
                setOpen(false);
              })
            }
            className="space-y-2 p-3 rounded-lg border"
          >
            <div className="space-y-1.5">
              <Label htmlFor="ae">이메일</Label>
              <Input id="ae" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap">초기 비밀번호 (8자 이상)</Label>
              <Input id="ap" name="password" type="text" minLength={8} required />
            </div>
            <p className="text-xs text-muted-foreground">
              이 이메일/비밀번호로 바로 로그인할 수 있습니다. 전달 후 본인이 변경하도록 안내하세요.
            </p>
            <Button type="submit" size="sm" disabled={busy}>추가</Button>
          </form>
        )}

        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate">{a.email}</span>
              {a.id === me && <Badge variant="secondary" className="text-[10px]">나</Badge>}
            </div>
            {a.id !== me && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 h-7"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    if (!confirm(`${a.email} 관리자 권한과 계정을 삭제할까요?`)) return;
                    const r = await removeAdmin(a.id);
                    if (r?.error) return void toast.error(r.error);
                    toast.success("삭제했습니다.");
                  })
                }
              >
                삭제
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
