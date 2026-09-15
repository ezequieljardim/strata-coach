import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  allRuns,
  allSessions,
  average,
  config,
  cycles,
  cycleUrl,
  context,
  currentWeek,
  fmtDate,
  pace,
  paceNum,
  plan,
  runs,
  series,
  sessions,
  slug,
  t,
  totals,
  weeklySummary,
} from "./lib";
import type { TrackedIssue } from "./lib";
import { Detail } from "./calendar";
import { css } from "./theme";

const planDay = (date: string) => plan.weeks.flatMap((w) => w.days).find((d) => d.date === date);

// Chart colors come from the CSS theme tokens. They're read at module evaluation for the
// first theme and again on every theme switch, because App remounts <main> with the theme as key.
let BLUE = "", ORANGE = "", RED = "", GREEN = "", GREY = "", GRID = "";
let axisProps = { stroke: "", fontSize: 11, tickLine: false, axisLine: { stroke: "" } };
let tooltipColors = { bg: "", line: "", ink: "" };
function readColors() {
  [BLUE, ORANGE, RED, GREEN, GREY, GRID] = ["--blue", "--orange", "--chart-red", "--green", "--chart-grey", "--line"].map(css);
  axisProps = { stroke: css("--axis"), fontSize: 11, tickLine: false, axisLine: { stroke: css("--axis-line") } };
  tooltipColors = { bg: css("--card"), line: css("--axis-line"), ink: css("--ink") };
}

const MARGIN = { top: 8, right: 14, left: 6, bottom: 0 };

function tooltipStyle() {
  return {
    contentStyle: {
      background: tooltipColors.bg,
      border: `1px solid ${tooltipColors.line}`,
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: tooltipColors.ink },
  };
}

/** Y axis with reserved width so labels never get clipped.
 *  The unit goes in the tooltip, not on every tick: saves width and reads better. */
function yAxis(extra: Record<string, unknown> = {}) {
  return {
    ...axisProps,
    width: 44,
    tickFormatter: (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
    ...extra,
  };
}

/** Tooltip that appends the unit to the value. */
function tip(unit: string) {
  return {
    ...tooltipStyle(),
    formatter: (v: number, n: string) => [`${v} ${unit}`, n] as [string, string],
  };
}

function Card({
  title,
  sub,
  children,
  wide,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={"card" + (wide ? " full" : "")}>
      <h2>{title}</h2>
      {sub && <p className="sub">{sub}</p>}
      {children}
    </section>
  );
}

function Stat({ v, l, hint }: { v: React.ReactNode; l: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="v">{v}</span>
      <span className="l">{l}</span>
      {hint && <span className="h">{hint}</span>}
    </div>
  );
}

// ------------------------------------------------------------ progress

export function ProgressPanel() {
  readColors();
  const r = weeklySummary();
  const tot = totals();
  const pct = Math.round((tot.kmDone / tot.kmPlanned) * 100);

  return (
    <>
      <Card title={t.planProgress} sub={`${currentWeek.phase} · ${currentWeek.focus}`} wide>
        <div className="stats">
          <Stat v={`${tot.sessionsDone}/${tot.sessionsTotal}`} l={t.sessions} />
          <Stat v={`${tot.kmDone}`} l={t.kmRun} hint={t.ofPlanned(tot.kmPlanned)} />
          <Stat v={`${pct}%`} l={t.ofTotalVolume} />
          <Stat v={`${Math.round(tot.minutes / 60)}h ${tot.minutes % 60}m`} l={t.moving} />
        </div>
        <div className="bar">
          <div style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </Card>

      <Card title={t.weeklyVolume} sub={t.weeklyVolumeSub} wide>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={r} margin={MARGIN}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...yAxis()} />
            <Tooltip {...tip(t.units.km)} />
            <Bar dataKey="plannedKm" name={t.plan} fill={GREY} radius={[3, 3, 0, 0]} />
            <Bar dataKey="actualKm" name={t.actual} fill={BLUE} radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title={t.weeks} wide>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t.cols.wk}</th>
                <th>{t.cols.from}</th>
                <th>{t.cols.phase}</th>
                <th className="n">{t.cols.kmPlan}</th>
                <th className="n">{t.cols.kmActual}</th>
                <th className="n">{t.cols.sessions}</th>
                <th className="n">{t.cols.cadence}</th>
              </tr>
            </thead>
            <tbody>
              {r.map((s) => (
                <tr
                  key={s.week}
                  className={(s.week === currentWeek.n ? "current " : "") + (s.deload ? "deload" : "")}
                >
                  <td>{s.week}</td>
                  <td>{fmtDate(s.from)}</td>
                  <td>
                    {s.phase}
                    {s.deload && <span className="tag">{t.deload}</span>}
                  </td>
                  <td className="n">{s.plannedKm}</td>
                  <td className="n">{s.actualKm || "—"}</td>
                  <td className="n">
                    {s.doneSessions}/{s.plannedSessions}
                  </td>
                  <td className="n">{s.cadence ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ------------------------------------------------------------ tracked issues

/** One tab per entry in `config.tracked`. Knows nothing about any specific symptom. */
export function TrackedPanel({ issue }: { issue: TrackedIssue }) {
  readColors();
  const km = issue.keyMetric;
  const r = weeklySummary()
    .map((s) => ({ ...s, value: s.tracked[issue.id] }))
    .filter((s) => s.value != null || s.doneSessions > 0);
  const reported = sessions.filter((s) => s.tracked?.[issue.id]?.present);
  const numeric = (type: string) => type === "number" || type === "scale";
  const [emptyText, emptyCode] = t.trackedEmpty(km?.field ?? "");

  return (
    <>
      {km && (
        <Card title={issue.chart?.title ?? issue.label} sub={issue.chart?.subtitle} wide>
          {r.some((s) => s.value != null) ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={r} margin={MARGIN}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...yAxis()} />
                <Tooltip {...tip(km.unit)} />
                {km.baseline && (
                  <ReferenceLine
                    y={km.baseline.value}
                    stroke={RED}
                    strokeDasharray="4 4"
                    label={{ value: km.baseline.label, fill: RED, fontSize: 10, position: "insideTopLeft" }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  name={km.label}
                  stroke={ORANGE}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty">
              {emptyText} <code>athletes/{slug}/sessions.json</code>, <code>{emptyCode}</code>.
            </p>
          )}
        </Card>
      )}

      <Card title={t.trackedLog} wide>
        {reported.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t.date}</th>
                  <th className="n">{t.cols.wk}</th>
                  {issue.fields.map((f) => (
                    <th key={f.id} className={numeric(f.type) ? "n" : undefined}>
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reported.map((s) => (
                  <tr key={s.date}>
                    <td>{fmtDate(s.date)}</td>
                    <td className="n">{s.week}</td>
                    {issue.fields.map((f) => (
                      <td key={f.id} className={numeric(f.type) ? "n" : undefined}>
                        {String(s.tracked![issue.id][f.id] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{t.trackedNone}</p>
        )}
      </Card>

      {issue.trafficLight && (
        <Card title={t.trafficLight} wide>
          <ul className="lights">
            <li>
              <b style={{ color: GREEN }}>{t.lights.green}</b> — {issue.trafficLight.green}
            </li>
            <li>
              <b style={{ color: ORANGE }}>{t.lights.yellow}</b> — {issue.trafficLight.yellow}
            </li>
            <li>
              <b style={{ color: RED }}>{t.lights.red}</b> — {issue.trafficLight.red}
            </li>
          </ul>
        </Card>
      )}
    </>
  );
}

// ------------------------------------------------------------ runs

export function RunsPanel() {
  readColors();
  const [open, setOpen] = useState<string | null>(null);
  const data = runs.map((s) => ({
    date: fmtDate(s.date),
    pace: paceNum(s.km, s.minutes),
    avgHr: s.avgHr,
    maxHr: s.maxHr,
    cadence: s.cadence,
    km: s.km,
  }));
  const cad = config.cadence;
  const zones = config.zones;
  const easy = zones?.hr.find((z) => z.zone === (zones.easyZone ?? 2));

  return (
    <>
      {cad && (
        <Card title={t.cadence} sub={t.cadenceSub(cad.base, cad.target, cad.reference)} wide>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={MARGIN}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...yAxis({ domain: [140, 185] })} />
              <Tooltip {...tip(t.units.spm)} />
              <ReferenceLine y={cad.target} stroke={GREEN} strokeDasharray="4 4"
                label={{ value: t.target, fill: GREEN, fontSize: 10, position: "insideTopLeft" }} />
              <Line type="monotone" dataKey="cadence" name={t.cadence} stroke={BLUE} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card
        title={t.heartRate}
        sub={easy && zones?.lthr ? t.hrSub(easy.zone, easy.hrLow, easy.hrHigh, zones.lthr, config.rules.easyDayHrCap) : undefined}
        wide
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={MARGIN}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...yAxis({ domain: [90, 190] })} />
            <Tooltip {...tip(t.units.bpm)} />
            {easy && (
              <ReferenceLine y={easy.hrHigh} stroke={GREEN} strokeDasharray="4 4"
                label={{ value: t.zoneCeiling(easy.zone), fill: GREEN, fontSize: 10, position: "insideTopLeft" }} />
            )}
            {zones?.lthr && (
              <ReferenceLine y={zones.lthr} stroke={RED} strokeDasharray="4 4"
                label={{ value: "LTHR", fill: RED, fontSize: 10, position: "insideTopLeft" }} />
            )}
            <Line type="monotone" dataKey="avgHr" name={t.avgHr} stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="maxHr" name={t.maxHr} stroke={RED} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title={t.allRuns} wide>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t.date}</th>
                <th className="n">{t.cols.wk}</th>
                <th className="n">{t.runCols.km}</th>
                <th className="n">{t.runCols.min}</th>
                <th className="n">{t.runCols.pace}</th>
                <th className="n">{t.runCols.avgHr}</th>
                <th className="n">{t.runCols.maxHr}</th>
                <th className="n">{t.runCols.cad}</th>
                <th>{t.runCols.shoes}</th>
                <th className="n">{t.runCols.rpe}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((s) => (
                <tr key={s.date}>
                  <td>{fmtDate(s.date)}</td>
                  <td className="n">{s.week}</td>
                  <td className="n">{s.km}</td>
                  <td className="n">{s.minutes}</td>
                  <td className="n">{pace(s.km, s.minutes)}</td>
                  <td className="n">{s.avgHr ?? "—"}</td>
                  <td className="n">{s.maxHr ?? "—"}</td>
                  <td className="n">{s.cadence ?? "—"}</td>
                  <td>{s.shoes ?? "—"}</td>
                  <td className="n">{s.rpe ?? "—"}</td>
                  <td>
                    {planDay(s.date) && (
                      <button className="more" onClick={() => setOpen(s.date)}>{t.seeMore}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && planDay(open) && <Detail day={planDay(open)!} onClose={() => setOpen(null)} />}
    </>
  );
}

// ------------------------------------------------------------ context

export function ContextPanel() {
  readColors();
  const sleep = series("sleep");
  const weight = series("weight");
  const rhr = series("restingHr");
  const mSleep = average("sleep");
  const mRhr = average("restingHr");
  const target = context.sleepTarget;
  const under = sleep.filter((d) => d.value < target).length;

  return (
    <>
      <Card title={t.sleep} sub={t.sleepSub} wide>
        <div className="stats">
          <Stat v={`${mSleep ?? "—"} h`} l={t.mean} hint={t.targetH(target)} />
          <Stat v={`${under}/${sleep.length}`} l={t.nightsUnder(target)} />
          <Stat v={`${mRhr ?? "—"}`} l={t.restingHrMean} hint={t.units.bpm} />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sleep} margin={MARGIN}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" {...axisProps} interval={2} />
            <YAxis {...yAxis({ domain: [0, 10] })} />
            <Tooltip {...tip(t.units.h)} />
            <ReferenceLine y={target} stroke={GREEN} strokeDasharray="4 4"
              label={{ value: t.targetH(target), fill: GREEN, fontSize: 10, position: "insideTopLeft" }} />
            <Bar dataKey="value" name={t.hours} fill={BLUE} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title={t.weight} sub={t.weightSub}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weight} margin={MARGIN}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" {...axisProps} interval={3} />
            <YAxis {...yAxis({ domain: ["dataMin - 0.5", "dataMax + 0.5"] })} />
            <Tooltip {...tip(t.units.kg)} />
            <Line type="monotone" dataKey="value" name={t.weight} stroke={ORANGE} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title={t.restingHr} sub={t.restingHrSub}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rhr} margin={MARGIN}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" {...axisProps} interval={3} />
            <YAxis {...yAxis({ domain: ["dataMin - 3", "dataMax + 3"] })} />
            <Tooltip {...tip(t.units.bpm)} />
            <Line type="monotone" dataKey="value" name={t.restingHrShort} stroke={GREEN} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

// ------------------------------------------------------------ history

const month = (date: string) => date.slice(0, 7);
const monthLabel = (m: string) => `${m.slice(5)}/${m.slice(2, 4)}`;

/** Across every cycle and between them: what a single plan's tabs can't show. */
export function HistoryPanel() {
  readColors();
  const km = new Map<string, number>();
  for (const r of allRuns) km.set(month(r.date), (km.get(month(r.date)) ?? 0) + r.km);
  const volume = [...km].sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ label: monthLabel(m), km: +v.toFixed(1) }));

  const rhr = new Map<string, number[]>();
  for (const d of context.days) {
    if (d.restingHr == null) continue;
    rhr.set(month(d.date), [...(rhr.get(month(d.date)) ?? []), d.restingHr]);
  }
  const rhrMonthly = [...rhr].sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ label: monthLabel(m), value: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }));

  return (
    <>
      <Card title={t.cycles} wide>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t.cycleCols.goal}</th>
                <th>{t.cycleCols.dates}</th>
                <th>{t.cycleCols.status}</th>
                <th>{t.cycleCols.result}</th>
                <th className="n">{t.cycleCols.runs}</th>
                <th className="n">{t.cycleCols.km}</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => {
                const rs = allRuns.filter((r) => r.cycle === c.id);
                return (
                  <tr key={c.id} className={c.id === config.activeCycle ? "current" : ""}>
                    <td><a className="cycleLink" href={cycleUrl(c.id)}>{c.goal.name ?? c.goal.target ?? c.id}</a></td>
                    <td>{fmtDate(c.from)}/{c.from.slice(2, 4)} – {fmtDate(c.to)}/{c.to.slice(2, 4)}</td>
                    <td>{t.cycleStatus[c.status]}</td>
                    <td className="wrap">{c.result ? [c.result.time, c.result.summary].filter(Boolean).join(" · ") : "—"}</td>
                    <td className="n">{rs.length}</td>
                    <td className="n">{+rs.reduce((a, b) => a + b.km, 0).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t.monthlyVolume} sub={t.monthlyVolumeSub} wide>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={volume} margin={MARGIN}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...yAxis()} />
            <Tooltip {...tip(t.units.km)} />
            <Bar dataKey="km" name={t.kmRun} fill={BLUE} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {config.tracked.filter((ti) => ti.keyMetric).map((ti) => {
        const km = ti.keyMetric!;
        const data = allSessions
          .map((s) => ({ date: fmtDate(s.date), value: s.tracked?.[ti.id]?.[km.field] }))
          .filter((d): d is { date: string; value: number } => typeof d.value === "number");
        return (
          <Card key={ti.id} title={t.allTime(ti.label)} sub={t.allTimeSub} wide>
            {data.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={MARGIN}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" {...axisProps} />
                  <YAxis {...yAxis()} />
                  <Tooltip {...tip(km.unit)} />
                  <Line type="monotone" dataKey="value" name={km.label} stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty">{t.trackedNone}</p>
            )}
          </Card>
        );
      })}

      {rhrMonthly.length > 0 && (
        <Card title={t.restingHrMonthly} sub={t.restingHrMonthlySub} wide>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rhrMonthly} margin={MARGIN}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...yAxis({ domain: ["dataMin - 3", "dataMax + 3"] })} />
              <Tooltip {...tip(t.units.bpm)} />
              <Line type="monotone" dataKey="value" name={t.restingHrShort} stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </>
  );
}
