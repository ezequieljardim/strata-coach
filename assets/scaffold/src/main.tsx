import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { athleteNames, config, slug, slugs } from "./lib";
import { stringsFor } from "./i18n";
import { ThemePicker } from "./ThemePicker";
import { useTheme } from "./theme";
import "./styles.css";

const LAST = "lastAthlete";
const store = {
  get: () => { try { return localStorage.getItem(LAST); } catch { return null; } },
  set: (s: string) => { try { localStorage.setItem(LAST, s); } catch { /* private mode */ } },
};

/** No athlete in the URL: nothing to choose → go; otherwise a plain list of links. */
function Picker() {
  const t = stringsFor(navigator.language);
  const theme = useTheme();
  return (
    <div className="app picker">
      <ThemePicker mode={theme.mode} onChange={theme.setMode} t={t} />
      <h1>{t.pickAthlete}</h1>
      <ul>
        {slugs.map((s) => (
          <li key={s}>
            <a href={`/${s}`}>{athleteNames[s]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const onRoot = location.pathname === "/";
const last = store.get();
if (!slug && onRoot && (slugs.length === 1 || (last && slugs.includes(last)))) {
  // The home-screen icon opens "/": this sends it to the only athlete or the last one seen.
  location.replace(`/${slugs.length === 1 ? slugs[0] : last}`);
} else {
  if (slug) {
    store.set(slug);
    document.documentElement.lang = config.locale.lang;
    document.title = config.goal.name ? `${config.athlete.name} · ${config.goal.name}` : config.athlete.name;
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{slug ? <App /> : <Picker />}</StrictMode>,
  );
}
