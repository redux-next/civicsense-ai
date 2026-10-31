
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({
  className = "",
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
        theme === "dark"
          ? "border-white/15 bg-white/10 text-yellow-300 hover:bg-white/20"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
      } ${className}`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
