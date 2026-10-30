"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";

type ThemeToggleProps = { className?: string };

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e4eae4] bg-white text-[#52665a] shadow-sm transition hover:border-[#cbdccc] hover:bg-[#f2f7f2] ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      <span className="sr-only">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
