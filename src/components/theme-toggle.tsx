"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * next-themes writes `.dark` onto <html> before paint, so the light/dark faces
 * are swapped purely with CSS. That avoids a mounted-flag effect (which causes
 * a cascading render) and keeps the markup identical on server and client.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-md border border-current/25 px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
    >
      <Moon className="size-3.5 dark:hidden" strokeWidth={1.6} />
      <Sun className="hidden size-3.5 dark:block" strokeWidth={1.6} />
      <span className="kicker dark:hidden">Dark</span>
      <span className="kicker hidden dark:inline">Light</span>
      <span className="sr-only">Toggle colour theme</span>
    </button>
  );
}
