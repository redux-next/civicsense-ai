
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const saved = localStorage.getItem("theme");

    if (saved === "light" || saved === "dark") {
      return saved;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);

    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
    }

    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}


// "use client";

// import {
//   createContext,
//   useCallback,
//   useContext,
//   useEffect,
//   useState,
//   type ReactNode,
//   Suspense,
// } from "react";

// type Theme = "light" | "dark";

// type ThemeContextType = {
//   theme: Theme;
//   toggleTheme: () => void;
// };

// const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// function applyTheme(theme: Theme) {
//   const root = document.documentElement;

//   root.dataset.theme = theme;
//   root.classList.toggle("dark", theme === "dark");
//   root.classList.toggle("light", theme === "light");
//   root.style.colorScheme = theme;
// }

// export function ThemeProvider({ children }: { children: ReactNode }) {
//   const [theme, setTheme] = useState<Theme>("light");

//   useEffect(() => {
//     const saved = localStorage.getItem("civicsense-theme");

//     const preferred = window.matchMedia(
//       "(prefers-color-scheme: dark)"
//     ).matches
//       ? "dark"
//       : "light";

//     const initial: Theme =
//       saved === "dark" || saved === "light" ? saved : preferred;

//     setTheme(initial);
//     applyTheme(initial);
//   }, []);

//   const toggleTheme = useCallback(() => {
//     setTheme((current) => {
//       const next: Theme = current === "dark" ? "light" : "dark";

//       applyTheme(next);
//       localStorage.setItem("civicsense-theme", next);

//       return next;
//     });
//   }, []);

//   return (
//     <ThemeContext.Provider value={{ theme, toggleTheme }}>
//       <Suspense
//         fallback={
//           <div className="min-h-screen bg-[#f5f7f4]" />
//         }
//       >
//         {children}
//       </Suspense>
//     </ThemeContext.Provider>
//   );
// }

// export function useTheme() {
//   const context = useContext(ThemeContext);

//   if (!context) {
//     throw new Error("useTheme must be used inside ThemeProvider.");
//   }

//   return context;
// }
