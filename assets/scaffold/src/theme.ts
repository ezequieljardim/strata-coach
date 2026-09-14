import { useEffect, useState } from "react";

/** "system" follows the OS; "light"/"dark" are an explicit choice, remembered per browser. */
export type ThemeMode = "system" | "light" | "dark";

const KEY = "theme";
const media = window.matchMedia("(prefers-color-scheme: light)");

function stored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? (media.matches ? "light" : "dark") : mode;
}

/** Applies the mode to <html>. index.html runs the same logic inline before first paint. */
function apply(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", css("--bg"));
}

/** A token's current value, for places CSS can't reach (chart SVG attributes). */
export function css(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

/** Current mode, a setter, and the resolved theme (use it as a key to re-render charts). */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(stored);
  const [resolved, setResolved] = useState(() => resolve(stored()));

  useEffect(() => {
    apply(mode);
    setResolved(resolve(mode));
    try {
      if (mode === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    if (mode !== "system") return;
    const onChange = () => {
      apply("system");
      setResolved(resolve("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  return { mode, setMode, resolved };
}
