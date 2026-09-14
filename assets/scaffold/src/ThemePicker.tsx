import type { Strings } from "./i18n";
import type { ThemeMode } from "./theme";

const OPTIONS: { mode: ThemeMode; icon: string }[] = [
  { mode: "system", icon: "◐" },
  { mode: "light", icon: "☀" },
  { mode: "dark", icon: "☾" },
];

export function ThemePicker({ mode, onChange, t }: { mode: ThemeMode; onChange: (m: ThemeMode) => void; t: Strings }) {
  return (
    <div className="themePick" role="radiogroup" aria-label={t.theme.label}>
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          role="radio"
          aria-checked={mode === o.mode}
          aria-label={t.theme[o.mode]}
          title={t.theme[o.mode]}
          className={mode === o.mode ? "on" : ""}
          onClick={() => onChange(o.mode)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
