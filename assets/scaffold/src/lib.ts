import { stringsFor } from "./i18n";

// ---------------------------------------------------------------- types

export type PlanSession = { date: string; name: string; type: string; km: number; min: number };

export type Workout = {
  sport: "run" | "strength" | "rest" | string;
  type: string;
  name: string;
  desc: string;
  detail: string;
  km: number;
  min: number;
  zone: string;
};

export type PlanDay = { date: string; workouts: Workout[] };

export type Week = {
  n: number;
  from: string;
  to: string;
  phase: string;
  focus: string;
  deload: boolean;
  plannedKm: number;
  hours: number;
  sessions: PlanSession[];
  days: PlanDay[];
};

export type Plan = {
  phases: { name: string; from: number; to: number; focus: string }[];
  notes: { id: string; title: string; body: string }[];
  weeks: Week[];
};

export type TrackedField = {
  id: string;
  label: string;
  type: "number" | "scale" | "enum" | "text";
  options?: string[];
  min?: number;
  max?: number;
  prompt?: string;
};

/**
 * Something the athlete wants followed session by session: a recurring pain, numbness,
 * anything. Zero or more per athlete. The dashboard only knows how to chart `keyMetric`
 * week over week and tabulate `fields`; it knows nothing about any specific symptom.
 */
export type TrackedIssue = {
  id: string;
  label: string;
  keyMetric?: {
    field: string;
    unit: string;
    label: string;
    goodDirection: "up" | "down";
    baseline?: { value: number; label: string };
  };
  chart?: { title: string; subtitle?: string };
  fields: TrackedField[];
  trafficLight?: { green: string; yellow: string; red: string };
  redFlags?: string[];
};

export type Goal = {
  type: "race" | "distance" | "habit";
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  distanceKm?: number;
  target?: string;
  stretch?: string;
};

/**
 * One goal with its plan, under athletes/<slug>/cycles/<id>/. Past cycles stay as they were,
 * so their calendar and feedback can still be browsed; sessions and context span all of them.
 */
export type Cycle = {
  id: string;
  status: "active" | "completed" | "abandoned";
  from: string;
  to: string;
  goal: Goal;
  /** How it ended: a race time, "finished", or why it was abandoned. */
  result?: { summary: string; time?: string };
};

export type Config = {
  schemaVersion?: number;
  activeCycle: string;
  athlete: { name: string; age?: number; heightCm?: number; weightKg?: number };
  schedule: {
    /** Run days the plan uses. */
    days: string[];
    /** Every day they could run → minutes that fit. Fallback days when a session moves. */
    available?: Record<string, number>;
    preferred?: string[];
    longRunDay?: string;
    notes?: string;
  };
  rules: { easyDayHrCap?: number; [k: string]: unknown };
  zones?: {
    lthr?: number;
    note?: string;
    easyZone?: number;
    hr: { zone: number; name: string; hrLow: number; hrHigh: number }[];
    pace: { zone: number; name: string; pace: string; feel: string }[];
  };
  cadence?: { base: number; target: number; reference?: number };
  /** trackShoes false: shoes aren't asked after runs nor shown in the runs table. */
  gear?: { shoes?: string[]; surfaces?: string[]; trackShoes?: boolean };
  tracked: TrackedIssue[];
  locale: { tz: string; lang: string; tone?: string };
};

/** A tracked issue's report for one session. `present: false` + nulls = nothing happened. */
export type TrackedReport = { present: boolean; [field: string]: string | number | boolean | null };

/**
 * The coach's feedback as given on the day. Structured rather than markdown on purpose:
 * the sections are always the same (the template lives in the `session` command),
 * so storing it as data avoids a parser and lets each part be styled.
 * `notes` stays the raw technical record; this is the readable one.
 */
export type Feedback = {
  title: string;
  /** ok = done as written · warn = minor miss · stop = a stop rule fired. */
  light: "ok" | "warn" | "stop";
  verdict: string;
  table: { what: string; plan: string; actual: string; ok: boolean }[];
  /** Three bullets at most. Always an array. */
  matters: string[];
  /** Two or three paragraphs. Always an array: a bare string blanks the whole app. */
  whereYouAre: string[];
  next: { level: "good" | "tight" | "bad"; action: string; why: string };
};

export type DoneSession = {
  date: string;
  /** The cycle whose plan contains this date, or null for runs between cycles. */
  cycle: string | null;
  /** Week of that cycle's plan; null when `cycle` is null. */
  week: number | null;
  done: boolean;
  /**
   * Recovery walks are marked done on the calendar but do NOT count toward running
   * volume or the cadence/HR charts: ~105 spm and ~105 bpm aren't comparable with a run.
   */
  type: "run" | "walk";
  km: number;
  minutes: number;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  shoes?: string;
  surface?: string;
  rpe?: number | null;
  tracked?: Record<string, TrackedReport>;
  /**
   * Loaded by `tools/hae/hae.py` and still missing the athlete's subjective report.
   * While true, `tracked.*.present: false` means "not reported", NOT "didn't happen".
   */
  pendingReport?: boolean;
  notes?: string;
  feedback?: Feedback;
};

export type ContextDay = {
  date: string;
  sleep: number | null;
  deepSleep: number | null;
  remSleep: number | null;
  weight: number | null;
  restingHr: number | null;
  hrv: number | null;
  steps: number | null;
  vo2max: number | null;
};

type Athlete = {
  config: Config;
  sessions: { sessions: DoneSession[] };
  context: { sleepTarget: number; days: ContextDay[] };
  cycles: Record<string, { cycle: Cycle; plan: Plan }>;
};

// ---------------------------------------------------------------- athletes

/**
 * One folder per athlete under /athletes; the folder name is the slug and the URL. Each goal is
 * a cycle in athletes/<slug>/cycles/<id>/; /<slug> shows the active one, /<slug>/<id> any other.
 */
const files = import.meta.glob(["/athletes/*/*.json", "/athletes/*/cycles/*/*.json"], {
  eager: true,
  import: "default",
});
const athletes: Record<string, Athlete> = {};
for (const [path, data] of Object.entries(files)) {
  const parts = path.split("/"); // ["", "athletes", slug, file] or [..., "cycles", id, file]
  const a = (athletes[parts[2]] ??= { cycles: {} } as unknown as Athlete);
  if (parts[3] === "cycles") {
    const c = (a.cycles[parts[4]] ??= {} as Athlete["cycles"][string]);
    (c as Record<string, unknown>)[parts[5].replace(".json", "")] = data;
  } else {
    (a as Record<string, unknown>)[parts[3].replace(".json", "")] = data;
  }
}

export const slugs = Object.keys(athletes).sort();
if (!slugs.length) {
  // A fresh scaffold before the first athlete: say what to do instead of a blank page.
  document.getElementById("root")!.textContent = "No athletes yet — run /strata:start to add one.";
  throw new Error("no athletes under /athletes");
}
export const athleteNames = Object.fromEntries(slugs.map((s) => [s, athletes[s].config.athlete.name]));
/** Dashboard languages (es/en) the athletes use; the picker at "/" speaks theirs when they agree. */
export const athleteUiLangs = [...new Set(slugs.map((s) => stringsFor(athletes[s].config.locale.lang).htmlLang))];

const [, urlSlug = "", urlCycle = ""] = location.pathname.split("/").map(decodeURIComponent);
/** The athlete in the URL, or null when the URL doesn't name one (main.tsx routes that). */
export const slug: string | null = slugs.includes(urlSlug) ? urlSlug : null;

// Module-level data for the athlete and cycle in the URL. Switching either is a full
// navigation, so nothing below needs to be reactive. Falls back to the first athlete so that
// module evaluation never throws on the picker page.
const A = athletes[slug ?? slugs[0]];
export const config = A.config;
export const t = stringsFor(config.locale.lang);
/** Data written before cycles existed: the app can't read it until it's migrated. */
export const needsUpgrade = (config.schemaVersion ?? 1) < 2 || !A.cycles[config.activeCycle];

/** Every cycle of this athlete, oldest first. */
export const cycles: Cycle[] = Object.values(A.cycles)
  .map((c) => c.cycle)
  .sort((x, y) => x.from.localeCompare(y.from));
/** The cycle on screen: the one in the URL, or the active one. */
export const cycle: Cycle = A.cycles[urlCycle]?.cycle ?? A.cycles[config.activeCycle]?.cycle ?? cycles[0];
export const isActiveCycle = cycle?.id === config.activeCycle;
/** URL of a cycle: the active one lives at /<slug>. */
export const cycleUrl = (id: string) => (id === config.activeCycle ? `/${slug}` : `/${slug}/${id}`);
export const plan: Plan = A.cycles[cycle?.id]?.plan ?? { phases: [], notes: [], weeks: [] };
export const goal: Goal = cycle?.goal ?? { type: "habit" };
/** Every activity ever logged, across cycles. The History tab reads these. */
export const allSessions = A.sessions.sessions;
/** Activities of the cycle on screen. Everything plan-related reads these. */
export const sessions = allSessions.filter((s) => s.cycle === cycle?.id);
export const context = A.context;

// ------------------------------------------------- the plan detail, structured

/**
 * `detail` in plan.json is hand-written plain text with a fairly regular grammar:
 * blank-line separated blocks, UPPERCASE labels followed by a colon, dash lists, and
 * "Name: 3x15" steps. This classifies blocks so they render with hierarchy instead of a
 * monospace dump. Anything that fits no pattern becomes `para`: no text is ever lost.
 */
export type DetailBlock =
  | { kind: "para"; text: string }
  | { kind: "note"; title: string; text: string; items: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { what: string; amount: string }[] }
  | { kind: "watch"; text: string };

/** Uppercase label at the start of a block: "CADENCE:", "LO QUE HICISTE:". */
const LABEL = /^([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ0-9 ,'"()/·-]{3,}):\s*(.*)$/;
/** Step or exercise: "Calf raises: 3x15". */
const STEP = /^(.{2,64}?):\s+(.+)$/;
/** The watch workout block. Spanish marker kept for plans written before the migration. */
export const WATCH_BLOCK = /^(WATCH WORKOUT|WORKOUT DEL RELOJ)/;

/** Joins indented continuation lines to the previous one. */
function joinContinuations(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (/^\s{2,}\S/.test(l) && out.length > 0) out[out.length - 1] += " " + l.trim();
    else out.push(l.trim());
  }
  return out;
}

export function parseDetail(detail: string): DetailBlock[] {
  return detail
    .split(/\n\s*\n/)
    .map((b) => b.trimEnd())
    .filter(Boolean)
    .map((block): DetailBlock => {
      // The watch setup is long and already loaded on the watch: folded separately.
      if (WATCH_BLOCK.test(block)) return { kind: "watch", text: block };

      const lines = joinContinuations(block.split("\n")).filter(Boolean);
      const label = lines[0].match(LABEL);
      if (label) {
        const rest = lines.slice(1);
        const items = rest.filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
        const text = [label[2], ...rest.filter((l) => !l.startsWith("- "))].filter(Boolean).join(" ");
        return { kind: "note", title: label[1], text, items };
      }

      if (lines.every((l) => l.startsWith("- "))) {
        return { kind: "list", items: lines.map((l) => l.slice(2)) };
      }

      // "Name: amount" on most lines is a list of steps. Under half is prose that happens
      // to contain colons.
      const steps = lines.map((l) => l.match(STEP));
      if (steps.filter(Boolean).length > lines.length / 2) {
        return {
          kind: "steps",
          items: lines.map((l, i) => {
            const m = steps[i];
            return m ? { what: m[1], amount: m[2] } : { what: "", amount: l };
          }),
        };
      }

      return { kind: "para", text: lines.join(" ") };
    });
}

// ------------------------------------------------------------ plan notes, structured

/**
 * Plan notes are prose written for the athlete, with a loose grammar: an all-caps opening
 * sentence as a headline, "LABEL: text" sections, "HYPOTHESIS 1 - text", "TERM = meaning ->
 * action" rows, and indented lines as sub-points. This turns them into blocks so the Notes tab
 * reads like an article instead of a code dump. Unmatched text becomes a paragraph: nothing lost.
 */
export type NoteBlock =
  | { kind: "lead"; text: string }
  | { kind: "para"; text: string; items: string[] }
  | { kind: "section"; title: string; text: string; items: string[] }
  | { kind: "defs"; items: { term: string; text: string; action?: string }[] };

const NOTE_LABEL = /^([A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9 ,'"()/·]{2,}):\s*(.*)$/s;
const NOTE_NUMBERED = /^([A-ZÁÉÍÓÚÜÑ]{3,} \d+)\s+-\s+(.*)$/s;
const NOTE_DEF = /^([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ ]{1,24}?)\s*=\s*(.+?)(?:\s*->\s*(.+))?$/;
const hasLower = (x: string) => /[a-záéíóúüñ]/.test(x);

/** "COMO SE DISTINGUEN, GRATIS" → "Como se distinguen, gratis". */
export function sentenceCase(x: string): string {
  const l = x.toLocaleLowerCase(config.locale.lang);
  return l.charAt(0).toLocaleUpperCase(config.locale.lang) + l.slice(1);
}

export function parseNote(body: string): NoteBlock[] {
  const out: NoteBlock[] = [];
  for (const block of body.split(/\n\s*\n/).map((b) => b.replace(/\s+$/, "")).filter(Boolean)) {
    const lines = block.split("\n");
    const main = lines.filter((l) => !/^\s{2,}\S/.test(l)).map((l) => l.trim());
    const items = lines.filter((l) => /^\s{2,}\S/.test(l)).map((l) => l.trim());
    const text = main.join(" ");

    const defs = main.map((l) => l.match(NOTE_DEF));
    if (main.length > 1 && defs.every(Boolean) || (main.length === 1 && defs[0] && defs[0][3])) {
      out.push({ kind: "defs", items: defs.map((m) => ({ term: m![1].trim(), text: m![2], action: m![3] })) });
      continue;
    }
    const label = text.match(NOTE_LABEL) ?? text.match(NOTE_NUMBERED);
    if (label && !hasLower(label[1])) {
      out.push({ kind: "section", title: sentenceCase(label[1]), text: label[2], items });
      continue;
    }
    // An all-caps first sentence is a headline; the rest of the paragraph follows it.
    const first = text.match(/^([^a-záéíóúüñ]+?[.!?])(\s+|$)(.*)$/s);
    if (first && /[A-ZÁÉÍÓÚÜÑ]{3}/.test(first[1]) && first[1].length > 12) {
      out.push({ kind: "lead", text: sentenceCase(first[1]) });
      if (first[3] || items.length) out.push({ kind: "para", text: first[3], items });
      continue;
    }
    out.push({ kind: "para", text, items });
  }
  return out;
}

/** A running session (excludes recovery walks). */
export function isRun(s: DoneSession): boolean {
  return (s.type ?? "run") === "run";
}

/** Done runs across every cycle, for the History tab. */
export const allRuns = allSessions.filter((s) => s.done && isRun(s));

/** Done runs only. The base for charts and volume. */
export const runs = sessions.filter((s) => s.done && isRun(s));

// ---------------------------------------------------------------- helpers

/**
 * Today in the athlete's time zone, NOT UTC. `toISOString()` is UTC: at UTC-3 it moved
 * the day forward between 21:00 and midnight, and with it the current week, the countdown,
 * the next session and the "today" highlight. `en-CA` formats as YYYY-MM-DD like the data.
 */
export const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: config.locale.tz });

export function daysUntil(date: string): number {
  const ms = new Date(date + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime();
  return Math.round(ms / 86400000);
}

export function fmtDate(f: string): string {
  const [, m, d] = f.split("-");
  return `${d}/${m}`;
}

/** Capitalized weekday in the dashboard's language (es or en): "Lunes", "Monday". */
export function weekday(date: string): string {
  const w = new Date(date + "T12:00:00").toLocaleDateString(t.htmlLang, { weekday: "long" });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Pace as min:sec per km. */
export function pace(km: number, minutes: number): string {
  if (!km || !minutes) return "—";
  const x = minutes / km;
  const m = Math.floor(x);
  const s = Math.round((x - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function paceNum(km: number, minutes: number): number | null {
  return km && minutes ? minutes / km : null;
}

/** The date the countdown points at: the race, or the end of the plan. */
export const goalDate = goal.date ?? plan.weeks[plan.weeks.length - 1]?.to ?? TODAY;

export const currentWeek: Week =
  plan.weeks.find((s) => TODAY >= s.from && TODAY <= s.to) ??
  // Optional access: data waiting for /strata:upgrade has no plan, and must reach the notice.
  (TODAY < plan.weeks[0]?.from ? plan.weeks[0] : plan.weeks[plan.weeks.length - 1]);

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Week by week: plan vs actual, plus the weekly mean of every tracked key metric. */
export function weeklySummary() {
  return plan.weeks.map((w) => {
    const done = runs.filter((x) => x.week === w.n);
    const walks = sessions.filter((x) => x.week === w.n && x.done && !isRun(x));
    const cad = done.filter((x) => x.cadence);
    const tracked: Record<string, number | null> = {};
    for (const ti of config.tracked) {
      if (!ti.keyMetric) continue;
      const v = done
        .map((x) => x.tracked?.[ti.id]?.[ti.keyMetric!.field])
        .filter((x): x is number => typeof x === "number");
      tracked[ti.id] = v.length ? +mean(v).toFixed(1) : null;
    }
    return {
      week: w.n,
      label: t.weekShort(w.n),
      phase: w.phase,
      deload: w.deload,
      from: w.from,
      plannedKm: w.plannedKm,
      actualKm: +done.reduce((a, b) => a + b.km, 0).toFixed(1),
      plannedSessions: w.sessions.filter((x) => x.km > 0).length,
      doneSessions: done.length,
      walks: walks.length,
      tracked,
      cadence: cad.length ? Math.round(mean(cad.map((x) => x.cadence!))) : null,
      past: w.to < TODAY,
    };
  });
}

export function totals() {
  const plannedKm = plan.weeks.reduce((a, b) => a + b.plannedKm, 0);
  return {
    kmDone: +runs.reduce((a, b) => a + b.km, 0).toFixed(1),
    kmPlanned: +plannedKm.toFixed(1),
    sessionsDone: runs.length,
    sessionsTotal: plan.weeks.reduce((a, b) => a + b.sessions.filter((s) => s.km > 0).length, 0),
    minutes: runs.reduce((a, b) => a + b.minutes, 0),
  };
}

/** Last N days with a non-null value for a context metric. */
export function series(field: keyof ContextDay, n = 31) {
  return context.days
    .filter((d) => d[field] != null)
    .slice(-n)
    .map((d) => ({ date: fmtDate(d.date), value: d[field] as number, iso: d.date }));
}

export function average(field: keyof ContextDay): number | null {
  const v = context.days.map((d) => d[field]).filter((x): x is number => x != null);
  return v.length ? +mean(v).toFixed(2) : null;
}

/** Next pending session in the plan. */
export function nextSession(): { s: PlanSession; week: number } | null {
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      if (s.date >= TODAY && !sessions.some((h) => h.date === s.date && h.done)) {
        return { s, week: w.n };
      }
    }
  }
  return null;
}
