import { useState } from "react";
import { ContextPanel, ProgressPanel, RunsPanel, TrackedPanel } from "./panels";
import { CalendarPanel, NotesPanel } from "./calendar";
import { config, currentWeek, daysUntil, goalDate, nextSession, plan, slug, t, weekday } from "./lib";

export default function App() {
  const tabs = [
    { id: "progress", label: t.tabs.progress },
    { id: "calendar", label: t.tabs.calendar },
    ...config.tracked.map((x) => ({ id: `tracked:${x.id}`, label: x.label })),
    { id: "runs", label: t.tabs.runs },
    { id: "context", label: t.tabs.context },
    { id: "notes", label: t.tabs.notes },
  ];
  const [tab, setTab] = useState("progress");
  const left = daysUntil(goalDate);
  const next = nextSession();
  const g = config.goal;
  // A race is titled by its name; other goals by what they aim at, so the target isn't repeated below.
  const title = g.name ?? g.target ?? (g.distanceKm ? `${g.distanceKm} km` : config.athlete.name);
  const issue = config.tracked.find((x) => `tracked:${x.id}` === tab);
  const [footA, footCode, footB] = t.footer(slug!);

  return (
    <div className="app">
      <header>
        <div className="hero">
          <div>
            <p className="kicker">{g.type === "race" ? t.roadTo : t.goal}</p>
            <h1>{title}</h1>
            <p className="meta">
              {[
                `${weekday(goalDate)} ${goalDate.split("-").reverse().join("/")}`,
                g.time,
                g.place,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="countdown">
            <span className="n">{left}</span>
            <span className="l">{t.day(left)}</span>
          </div>
        </div>

        <div className="strips">
          <div className="strip">
            <span className="l">{t.week}</span>
            <span className="v">
              {currentWeek.n} <em>{t.of} {plan.weeks.length}</em>
            </span>
          </div>
          <div className="strip">
            <span className="l">{t.phase}</span>
            <span className="v">{currentWeek.phase}</span>
          </div>
          {g.target && g.target !== title && (
            <div className="strip">
              <span className="l">{t.goal}</span>
              <span className="v">{g.target}</span>
            </div>
          )}
          <div className="strip wide">
            <span className="l">{t.nextSession}</span>
            <span className="v">
              {next
                ? `${next.s.date.slice(8)}/${next.s.date.slice(5, 7)} · ${next.s.name}${next.s.km ? ` · ${next.s.km} km` : ""}`
                : "—"}
            </span>
          </div>
        </div>

        <nav>
          {tabs.map((x) => (
            <button key={x.id} className={tab === x.id ? "on" : ""} onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "progress" && <ProgressPanel />}
        {tab === "calendar" && <CalendarPanel />}
        {issue && <TrackedPanel key={issue.id} issue={issue} />}
        {tab === "runs" && <RunsPanel />}
        {tab === "context" && <ContextPanel />}
        {tab === "notes" && <NotesPanel />}
      </main>

      <footer>
        <p>
          {config.athlete.name} · {footA} <code>{footCode}</code> {footB}
        </p>
      </footer>
    </div>
  );
}
