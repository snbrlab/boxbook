"use client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="테마 전환" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:inline">☀️</span>
    </Button>
  );
}
