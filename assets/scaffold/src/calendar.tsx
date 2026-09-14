import { useEffect, useState } from "react";
import { config, currentWeek, fmtDate, parseDetail, parseNote, plan, runs, sessions, t, TODAY, weekday } from "./lib";
import type { DoneSession, Feedback, PlanDay, Week } from "./lib";

const ICON: Record<string, string> = {
  run: "🏃",
  strength: "💪",
  rest: "🛌",
};

function isDone(date: string) {
  return sessions.some((s) => s.date === date && s.done);
}

function dayState(d: PlanDay): "done" | "today" | "past" | "future" {
  if (isDone(d.date)) return "done";
  if (d.date === TODAY) return "today";
  return d.date < TODAY ? "past" : "future";
}

/** The plan detail, with hierarchy instead of a monospace dump. */
function Prescription({ detail }: { detail: string }) {
  return (
    <div className="rx">
      {parseDetail(detail).map((b, i) => {
        switch (b.kind) {
          case "steps":
            return (
              <table key={i} className="fbTable rxSteps">
                <tbody>
                  {b.items.map((x, j) => (
                    <tr key={j}>
                      <th>{x.what}</th>
                      <td>{x.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case "note":
            return (
              <div key={i} className="rxNote">
                <h4>{b.title}</h4>
                {b.text && <p className="fbPara">{b.text}</p>}
                {b.items.length > 0 && (
                  <ul className="fbList">
                    {b.items.map((x, j) => <li key={j}>{x}</li>)}
                  </ul>
                )}
              </div>
            );
          case "list":
            return (
              <ul key={i} className="fbList">
                {b.items.map((x, j) => <li key={j}>{x}</li>)}
              </ul>
            );
          case "watch":
            return (
              <details key={i} className="techNotes">
                <summary>{t.watchWorkout}</summary>
                <pre className="modalDetail">{b.text}</pre>
              </details>
            );
          default:
            return <p key={i} className="fbPara">{b.text}</p>;
        }
      })}
    </div>
  );
}

const LIGHT_ICON: Record<Feedback["light"], string> = { ok: "✓", warn: "!", stop: "✕" };

/** The day's feedback: what was said, as it was said, inside the detail. */
function FeedbackView({ f }: { f: Feedback }) {
  return (
    <div className="fb">
      <p className={"fbVerdict " + f.light}>
        <span className="fbIcon" aria-hidden>{LIGHT_ICON[f.light]}</span>
        {f.verdict}
      </p>

      <table className="fbTable">
        <tbody>
          {f.table.map((r) => (
            <tr key={r.what} className={r.ok ? "" : "weak"}>
              <th>{r.what}</th>
              <td className={"dim" + (r.plan === "—" ? " empty" : "")}>{r.plan}</td>
              <td>{r.actual}</td>
              <td className="fbOk">{r.ok ? "✓" : "!"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>{t.whatMatters}</h4>
      <ul className="fbList">
        {f.matters.map((x, i) => <li key={i}>{x}</li>)}
      </ul>

      <h4>{t.whereYouAre}</h4>
      {f.whereYouAre.map((x, i) => <p key={i} className="fbPara">{x}</p>)}

      <p className={"fbNext " + f.next.level}>
        <b>{t.next[f.next.level]}: {f.next.action}</b> — {f.next.why}
      </p>
    </div>
  );
}

/** Detail panel: opens when tapping a day, or from the runs table. */
export function Detail({ day, onClose }: { day: PlanDay; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // A day can have more than one entry: the session and loose walks. The session leads
  // (it has the feedback) and the rest goes below, compact: rendering them all as equal
  // blocks made them look like duplicates.
  const actual = sessions.filter((s) => s.date === day.date);
  const main: DoneSession | undefined = actual.find((r) => r.type !== "walk") ?? actual[0];
  const others = actual.filter((r) => r !== main);

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
        <p className="modalDate">
          {weekday(day.date)} {fmtDate(day.date)}
        </p>

        {day.workouts.map((w, i) => (
          <div key={i} className="modalBlock">
            <h3>
              <span className="icon">{ICON[w.sport] ?? "•"}</span> {w.name}
            </h3>
            <div className="chips">
              {w.type !== "rest" && <span className="chip">{t.workoutTypes[w.type] ?? w.type}</span>}
              {w.km > 0 && <span className="chip">{w.km} km</span>}
              {w.min > 0 && <span className="chip">{w.min} min</span>}
              {w.zone && w.zone !== "N/A" && <span className="chip">{w.zone}</span>}
            </div>
            {w.desc && <p className="modalDesc">{w.desc}</p>}
            {w.detail && <Prescription detail={w.detail} />}
          </div>
        ))}

        {main && (
          <div className="modalBlock did">
            <h3>
              {t.whatYouDid}
              {main.feedback && <span className="fbTitle">{main.feedback.title}</span>}
            </h3>
            <div className="chips">
              <span className="chip on">{main.km} km</span>
              <span className="chip on">{main.minutes} min</span>
              {main.avgHr && (
                <span className="chip on">{t.hr} {main.avgHr}/{main.maxHr}</span>
              )}
              {main.cadence && <span className="chip on">{main.cadence} {t.units.spm}</span>}
            </div>
            {main.feedback && <FeedbackView f={main.feedback} />}
            {main.notes && (
              <details className="techNotes">
                <summary>{t.techNotes}</summary>
                <pre className="modalDetail">{main.notes}</pre>
              </details>
            )}

            {/* Walks on the same day are real activity and stay recorded, but they are not
                the session: as full blocks they looked like duplicates. */}
            {others.length > 0 && (
              <div className="others">
                <h4>{t.alsoThatDay}</h4>
                {others.map((o, i) => (
                  <details key={i} className="other">
                    <summary>
                      <b>{o.type === "walk" ? t.walk : t.run}</b>
                      <span className="dim">
                        {o.km} km · {o.minutes} min
                        {o.avgHr ? ` · ${t.hr} ${o.avgHr}/${o.maxHr}` : ""}
                      </span>
                    </summary>
                    {o.notes && <pre className="modalDetail">{o.notes}</pre>}
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekBlock({
  w,
  open,
  toggle,
  show,
}: {
  w: Week;
  open: boolean;
  toggle: () => void;
  show: (d: PlanDay) => void;
}) {
  // Runs only: recovery walks are marked done but don't count against the week's runs.
  const done = w.days.filter((d) => runs.some((c) => c.date === d.date)).length;
  const totalRuns = w.sessions.filter((x) => x.km > 0).length;

  return (
    <div className={"weekBlock" + (w.n === currentWeek.n ? " current" : "")}>
      <button className="weekHead" onClick={toggle} aria-expanded={open}>
        <span className="weekN">{t.weekShort(w.n)}</span>
        <span className="weekInfo">
          <b>{w.phase}</b>
          <em>{w.focus}</em>
        </span>
        <span className="weekNums">
          {w.plannedKm > 0 && <span>{w.plannedKm} km</span>}
          <span className="dim">
            {done}/{totalRuns}
          </span>
          {w.deload && <span className="tag">{t.deload}</span>}
        </span>
        <span className={"arrow" + (open ? " open" : "")}>›</span>
      </button>

      {open && (
        <div className="weekDays">
          {w.days.map((d) => {
            const run = d.workouts.find((x) => x.sport === "run");
            const extras = d.workouts.filter((x) => x.sport === "strength");
            const state = dayState(d);
            return (
              <button
                key={d.date}
                className={`dayCell ${state}${run ? "" : " rest"}`}
                onClick={() => show(d)}
              >
                <span className="dayTop">
                  <span className="dayName">{weekday(d.date).slice(0, 3)}</span>
                  <span className="dayNum">{d.date.slice(8)}</span>
                </span>
                <span className="dayBody">
                  <span className="dayIcon">{ICON[run ? "run" : "rest"]}</span>
                  <span className="dayTitle">{run ? run.name : t.rest}</span>
                </span>
                <span className="dayFoot">
                  {run && run.km > 0 && <span>{run.km} km</span>}
                  {run && run.min > 0 && <span className="dim">{run.min}′</span>}
                  {extras.length > 0 && <span className="dim">💪</span>}
                  {state === "done" && <span className="ok">✓</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CalendarPanel() {
  const [open, setOpen] = useState<number[]>([currentWeek.n]);
  const [detail, setDetail] = useState<PlanDay | null>(null);

  const toggle = (n: number) => setOpen((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
  const sessionCount = plan.weeks.reduce((a, w) => a + w.sessions.length, 0);

  return (
    <>
      <section className="card full">
        <h2>{t.tabs.calendar}</h2>
        <p className="sub">{t.calendarSub(plan.weeks.length, sessionCount)}</p>
        <div className="calActions">
          <button onClick={() => setOpen(plan.weeks.map((w) => w.n))}>{t.openAll}</button>
          <button onClick={() => setOpen([])}>{t.closeAll}</button>
          <button onClick={() => setOpen([currentWeek.n])}>{t.currentWeek}</button>
        </div>

        <div className="calendar">
          {plan.weeks.map((w) => (
            <WeekBlock
              key={w.n}
              w={w}
              open={open.includes(w.n)}
              toggle={() => toggle(w.n)}
              show={setDetail}
            />
          ))}
        </div>
      </section>

      {detail && <Detail day={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

/** Plan notes: the "why" behind everything. */
export function NotesPanel() {
  const zones = config.zones;
  return (
    <>
      {zones && (
        <section className="card full">
          <h2>{t.zones}</h2>
          {zones.note && <p className="sub">{zones.note}</p>}
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t.zoneCols.zone}</th>
                  <th>{t.zoneCols.pace}</th>
                  <th className="n">{t.zoneCols.hr}</th>
                  <th>{t.zoneCols.feel}</th>
                </tr>
              </thead>
              <tbody>
                {zones.pace.map((z, i) => (
                  <tr key={z.zone}>
                    <td>{z.name}</td>
                    <td>{z.pace}</td>
                    <td className="n">{zones.hr[i] ? `${zones.hr[i].hrLow}-${zones.hr[i].hrHigh}` : "—"}</td>
                    <td className="wrap">{z.feel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {plan.notes.length > 1 && (
        <nav className="noteToc card full" aria-label={t.tabs.notes}>
          {plan.notes.map((n) => (
            <a key={n.id} href={`#note-${n.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`note-${n.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              {n.title}
            </a>
          ))}
        </nav>
      )}

      {plan.notes.map((n) => (
        <article key={n.id} id={`note-${n.id}`} className="card full note">
          <h2>{n.title}</h2>
          <div className="noteBody">
            {parseNote(n.body).map((b, i) => <NoteBlockView key={i} b={b} />)}
          </div>
        </article>
      ))}
    </>
  );
}

// ------------------------------------------------------------ notes rendering

const LIGHT_TERMS: Record<string, string> = {
  VERDE: "green", GREEN: "green", AMARILLO: "yellow", YELLOW: "yellow", ROJO: "red", RED: "red",
};
/** Acronyms that stay as written instead of becoming emphasis. */
const ACRONYMS = new Set(["RPE", "GPS", "VO2", "LTHR", "HRV", "FC", "BPM", "KM", "PDF", "API"]);

/**
 * Inline text: "->" becomes an arrow and ALL-CAPS runs (the author's way of stressing a word
 * in plain text) become bold in normal case. Acronyms and anything with digits are left alone.
 */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\s*->\s*|(?<![\p{L}\d])\p{Lu}{2,}(?:[ ,]+\p{Lu}{2,})*(?![\p{L}\d]))/u);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^\s*->\s*$/.test(p)) return <span key={i} className="arrowSep"> → </span>;
        if (i % 2 === 1 && !ACRONYMS.has(p) && /[AEIOUÁÉÍÓÚ]/.test(p)) {
          return <strong key={i}>{p.toLocaleLowerCase(config.locale.lang)}</strong>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function SubPoints({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="notePoints">
      {items.map((x, j) => <li key={j}><Rich text={x} /></li>)}
    </ul>
  );
}

function NoteBlockView({ b }: { b: ReturnType<typeof parseNote>[number] }) {
  switch (b.kind) {
    case "lead":
      return <p className="noteLead"><Rich text={b.text} /></p>;
    case "section":
      return (
        <section className="noteSection">
          <h3>{b.title}</h3>
          {b.text && <p><Rich text={b.text} /></p>}
          <SubPoints items={b.items} />
        </section>
      );
    case "defs":
      return (
        <div className="noteDefs">
          {b.items.map((d, j) => (
            <div key={j} className={"noteDef " + (LIGHT_TERMS[d.term] ?? "")}>
              <span className="noteTerm">{d.term.charAt(0) + d.term.slice(1).toLocaleLowerCase(config.locale.lang)}</span>
              <span className="noteMeaning"><Rich text={d.text} /></span>
              {d.action && <span className="noteAction">→ <Rich text={d.action} /></span>}
            </div>
          ))}
        </div>
      );
    default:
      return (
        <>
          {b.text && <p><Rich text={b.text} /></p>}
          <SubPoints items={b.items} />
        </>
      );
  }
}
