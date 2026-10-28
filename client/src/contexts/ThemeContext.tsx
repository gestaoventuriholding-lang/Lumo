import React, { createContext, useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme?: (theme: Theme) => void;
  /** Alterna o tema; com `origin`, o novo tema nasce em círculo a partir do centro desse elemento */
  toggleTheme?: (origin?: Element | null) => void;
  switchable: boolean;
}

const REVEAL_MS = 400;
const REVEAL_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const setThemeValue = switchable
    ? (value: Theme) => setTheme(value)
    : undefined;

  const toggleTheme = switchable
    ? (origin?: Element | null) => {
        const next: Theme = theme === "light" ? "dark" : "light";
        const doc = document as ViewTransitionDocument;
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

        // Sem suporte (ou sem ponto de origem): troca na hora, sem erro.
        if (!origin || !doc.startViewTransition || reduceMotion) {
          setTheme(next);
          return;
        }

        const rect = origin.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        try {
          const transition = doc.startViewTransition(() => {
            document.documentElement.classList.toggle("dark", next === "dark");
            flushSync(() => setTheme(next));
          });
          transition.ready
            .then(() => {
              document.documentElement.animate(
                {
                  clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
                },
                {
                  duration: REVEAL_MS,
                  easing: REVEAL_EASING,
                  pseudoElement: "::view-transition-new(root)",
                }
              );
            })
            .catch(() => undefined);
        } catch {
          setTheme(next);
        }
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeValue, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
