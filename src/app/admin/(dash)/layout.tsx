import Link from "next/link";
import { adminLogout } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { href: "/admin", label: "타임슬롯" },
  { href: "/admin/members", label: "회원" },
  { href: "/admin/schedule", label: "주간 시간표" },
  { href: "/admin/settings", label: "설정" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      <header className="flex items-center justify-between mb-4">
        <nav className="flex gap-1 flex-wrap">
          {NAV.map((n) => (
            <Button key={n.href} variant="ghost" size="sm" render={<Link href={n.href} />}>
              {n.label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={adminLogout}>
            <Button variant="ghost" size="sm" type="submit">로그아웃</Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
