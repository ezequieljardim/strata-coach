#!/usr/bin/env python3
"""
hae.py — Health Auto Export → dashboard sync

Full chain:

    Drive (MCP connector)         the agent calls download_file_content by fileId.
      ↓                           The result exceeds the token limit and the harness
      ↓                           writes it to disk instead of into context.
    hae.py decode                 base64-decodes those tool results → raw/*.json
      ↓
    hae.py extract                raw/*.json → out/summary.json (compact, readable)
      ↓
    hae.py merge --athlete <slug> summary.json → athletes/<slug>/{context,sessions}.json
      ↓
    git commit && git push        Vercel republishes

Every step is idempotent and can run on its own. `hae.py all` chains them.

WHY THIS FILE LIVES IN THE REPO AND IS NOT REWRITTEN EACH DAY
------------------------------------------------------------
A scheduled task starts a fresh session with no memory. If the parser were rewritten every
morning, each run would use different criteria (what a jogging minute is, how HRV is
averaged) and the history would stop being comparable with itself. Here it is fixed and
versioned: if a criterion changes, it changes in a commit that can be seen and reverted.

MEASUREMENT CRITERIA (don't change without recomputing the history)
-------------------------------------------------------------------
· Jogging minute  = 1-min bucket faster than `jogPaceMaxMinPerKm`, grouped by rounded
  minute (HAE series are not aligned with each other).
· Jogging block   = contiguous jogging minutes, DISCARDING blocks whose mean cadence is
  below `jogMinCadence`: pace alone can't tell a brisk walk from a slow jog. The filter
  applies to the block, not the minute, because a single low-cadence minute is usually the
  walk→jog transition.
  Validated 19/08/2026 against the manual analysis of 11, 14 and 16/08: reproduces
  2.54 / 2.37 / 3.71 km of jogging and 149.8 / 149.9 / 162.0 spm Apple cadence.
· Apple cadence   = mean stepCount over jogging minutes. It reads ~10 spm below a manual
  count because 1-min buckets straddle jog/walk transitions. Stored + `cadenceOffset` so
  the series is on the same scale as the cadence target.
· Partial day     = the current day. steps, restingHr and hrv are null: mid-morning the
  count is incomplete and HRV averages few readings. The next day's run fills them in
  (which is why at least 2 days are always fetched).

Every threshold comes from the athlete's config.json (`ingest.hae` and
`rules.easyDayHrCap`) — they are one person's calibration, not constants.
"""
import argparse, base64, glob, json, os, statistics as st, sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from athlete import ROOT, cycle_of, load, require_schema, resolve, save  # noqa: E402

WORK = os.environ.get("HAE_WORK", "/home/claude/hae")
RAW, OUT = f"{WORK}/raw", f"{WORK}/out"
TOOLRES = "/root/.claude/projects/*/tool-results/mcp-Google_Drive-download_file_content-*.txt"

# Defaults for an athlete whose config doesn't calibrate them. From the first athlete's history (19/08/2026):
# two blocks at 7:42-8:02/km with cadence 129-130 counted as jogging and inflated volume by
# 0.50 km (+18%), exactly the metric the 10%-weekly rule watches — hence jogMinCadence.
# hrTolerance: peaks of 148-152 against a 150 cap were measurement noise, not execution
# errors; 174 and 179 were.
DEFAULTS = {"cadenceOffset": 10, "jogPaceMaxMinPerKm": 9.0, "jogMinCadence": 140, "hrTolerance": 5}


def P(s):  return datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z")
def r(x, n=2): return None if x is None else round(x, n)


def settings(a):
    cfg = load(a, "config")
    hae = {**DEFAULTS, **(cfg.get("ingest", {}).get("hae") or {})}
    hae["easyDayHrCap"] = cfg.get("rules", {}).get("easyDayHrCap")
    return cfg, hae


# ══════════════════════════════════════════════════════════════════ decode
def cmd_decode(args):
    os.makedirs(RAW, exist_ok=True)
    n = 0
    for p in sorted(glob.glob(TOOLRES), key=os.path.getmtime):
        try:
            d = json.load(open(p))
            raw = base64.b64decode(d["content"])
            json.loads(raw)
        except Exception as e:
            print(f"ERR {os.path.basename(p)}: {e}", file=sys.stderr)
            continue
        dest = f"{RAW}/{d['title']}"
        # newest wins: Health Auto Export sometimes uploads the same day twice
        if os.path.exists(dest) and os.path.getmtime(dest) >= os.path.getmtime(p):
            continue
        open(dest, "wb").write(raw)
        os.utime(dest, (os.path.getmtime(p), os.path.getmtime(p)))
        n += 1
        print(f"  {d['title']:34s} {len(raw):>9,} bytes")
    print(f"{n} files decoded into {RAW}")


# ═════════════════════════════════════════════════════════════════ extract
def _metrics(path):
    return {m["name"]: m for m in json.load(open(path))["data"]["metrics"]}


def _qty(m, agg="last"):
    if not m or not m.get("data"):
        return None
    v = [d["qty"] for d in m["data"] if d.get("qty") is not None]
    if not v:
        return None
    return {"last": v[-1], "sum": sum(v), "mean": st.mean(v)}[agg]


def _per_minute(series, field):
    """Groups a series by rounded minute.

    Health Auto Export does NOT align series: HR is stamped at second :00 while distance
    and steps are stamped at the second the workout started (:25 on 19/08/2026). Joining
    by exact timestamp splits every minute in two halves — one with HR and no km, one with
    km and no HR — producing fake one-minute blocks and None HR peaks. It happened on
    19/08 and it is why this function exists.
    """
    out = {}
    for d in series or []:
        t = P(d["date"]).replace(second=0, microsecond=0)
        v = d.get(field)
        if v is not None:
            out.setdefault(t, []).append(v)
    return out


def analyze_run(w, hae):
    """Splits the run into jogging blocks and returns the plan's metrics."""
    dist  = _per_minute(w.get("walkingAndRunningDistance"), "qty")
    steps = _per_minute(w.get("stepCount"), "qty")
    hrAvg = _per_minute(w.get("heartRateData"), "Avg")
    hrMax = _per_minute(w.get("heartRateData"), "Max")

    mins = []
    for t in sorted(set(dist) | set(steps) | set(hrAvg)):
        km = sum(dist.get(t, [0.0]))
        mins.append({"t": t, "km": km,
                     "cad": sum(steps[t]) if t in steps else None,
                     "pace": (1 / km) if km > 0 else None,
                     "hr": r(st.mean(hrAvg[t]), 0) if t in hrAvg else None,
                     "maxHr": max(hrMax[t]) if t in hrMax else None,
                     "jog": bool(km > 0 and (1 / km) < hae["jogPaceMaxMinPerKm"])})

    blocks, current = [], []
    for m in mins:
        if m["jog"]:
            current.append(m)
        elif current:
            blocks.append(current); current = []
    if current:
        blocks.append(current)

    # The cadence filter applies to the BLOCK, not the minute. A single low-cadence minute
    # is usually the walk→jog transition and belongs to the block (on 11/08/2026 the first
    # minute of block 1 read 139.7 spm at 7:12/km: that is jogging). A WHOLE block under
    # the threshold is a brisk walk.
    def _block_cad(b):
        v = [m["cad"] for m in b if m["cad"]]
        return st.mean(v) if v else None
    blocks = [b for b in blocks if (_block_cad(b) is None or _block_cad(b) >= hae["jogMinCadence"])]
    jog = [m for b in blocks for m in b]

    cad = [m["cad"] for m in jog if m["cad"]]
    peaks = [max([m["maxHr"] for m in b if m["maxHr"]], default=None) for b in blocks]
    return {
        "jogKm": r(sum(m["km"] for m in jog)),
        "jogMin": len(jog),
        "jogPace": r(st.mean([m["pace"] for m in jog]), 2) if jog else None,
        "cadenceApple": r(st.mean(cad), 1) if cad else None,
        "cadence": round(st.mean(cad) + hae["cadenceOffset"]) if cad else None,
        "hasHrSeries": any(p is not None for p in peaks),
        "blocks": [{
            "n": i + 1, "min": len(b),
            "km": r(sum(m["km"] for m in b)),
            "pace": r(st.mean([m["pace"] for m in b]), 2),
            "maxHr": peaks[i],
            "cad": round(st.mean([m["cad"] for m in b if m["cad"]])) if any(m["cad"] for m in b) else None,
        } for i, b in enumerate(blocks)],
    }


def cmd_extract(args):
    _, hae = settings(resolve(args.athlete, args.root))
    os.makedirs(OUT, exist_ok=True)
    context = {}
    for p in sorted(glob.glob(f"{RAW}/Health_Data-*.json")):
        day = os.path.basename(p)[12:22]
        M = _metrics(p)
        sl = (M.get("sleep_analysis", {}).get("data") or [{}])[0]
        context[day] = {
            "date": day,
            "sleep": r(sl.get("totalSleep")),
            "deepSleep": r(sl.get("deep")),
            "remSleep": r(sl.get("rem")),
            "weight": r(_qty(M.get("weight_body_mass"))),
            "restingHr": r(_qty(M.get("resting_heart_rate")), 0),
            "hrv": r(_qty(M.get("heart_rate_variability"), "mean")),
            "steps": r(_qty(M.get("step_count"), "sum"), 0),
            "vo2max": r(_qty(M.get("vo2_max"))),
            "_hrvCount": len(M.get("heart_rate_variability", {}).get("data", [])),
            "_inBed": (sl.get("sleepStart", "")[11:16] or None,
                       sl.get("sleepEnd", "")[11:16] or None),
            "_groundContact": r(_qty(M.get("running_ground_contact_time"), "mean"), 0),
            "_stride": r(_qty(M.get("running_stride_length"), "mean"), 3),
            "_vertOsc": r(_qty(M.get("running_vertical_oscillation"), "mean"), 2),
            "_power": r(_qty(M.get("running_power"), "mean"), 0),
        }

    workouts = []
    for p in sorted(glob.glob(f"{RAW}/Workouts_Data-*.json")):
        for w in json.load(open(p))["data"]["workouts"]:
            start, end = P(w["start"]), P(w["end"])
            is_run = "Run" in (w.get("name") or "")
            d = {
                "date": start.strftime("%Y-%m-%d"),
                "name": w.get("name"),
                "type": "run" if is_run else "walk",
                "start": start.strftime("%H:%M"), "end": end.strftime("%H:%M"),
                "minutes": round(w["duration"] / 60),
                "km": r(w.get("distance", {}).get("qty")),
                "avgHr": int(w["avgHeartRate"]["qty"]) if w.get("avgHeartRate") else None,
                "maxHr": int(w["maxHeartRate"]["qty"]) if w.get("maxHeartRate") else None,
                "elevationUp": r(w.get("elevationUp", {}).get("qty"), 1),
                "temperature": r(w.get("temperature", {}).get("qty"), 1),
                "humidity": r(w.get("humidity", {}).get("qty"), 0),
            }
            if is_run:
                d.update(analyze_run(w, hae))
            workouts.append(d)
    workouts.sort(key=lambda x: (x["date"], x["start"]))

    json.dump({"context": context, "workouts": workouts},
              open(f"{OUT}/summary.json", "w"), ensure_ascii=False, indent=1)
    print(f"summary.json: {len(context)} context days, {len(workouts)} workouts")
    if not args.quiet:
        _report(context, workouts, hae)


def _report(context, workouts, hae):
    cap = hae["easyDayHrCap"]
    print("\n=== DAILY CONTEXT ===")
    print(f"{'date':11s} {'sleep':>6s} {'deep':>5s} {'rem':>5s} {'kg':>6s} "
          f"{'rHR':>5s} {'hrv':>6s} {'n':>2s} {'steps':>6s} {'vo2':>5s}  in bed")
    for d in context.values():
        print(f"{d['date']:11s} {str(d['sleep']):>6s} {str(d['deepSleep']):>5s} "
              f"{str(d['remSleep']):>5s} {str(d['weight']):>6s} {str(d['restingHr']):>5s} "
              f"{str(d['hrv']):>6s} {d['_hrvCount']:>2d} {str(d['steps']):>6s} "
              f"{str(d['vo2max']):>5s}  {d['_inBed'][0]}→{d['_inBed'][1]}")

    print("\n=== WORKOUTS ===")
    for w in workouts:
        base = (f"{w['date']} {w['start']} {w['name']:13s} {w['minutes']:>3} min "
                f"{str(w['km']):>5} km  HR {w['avgHr']}/{w['maxHr']}")
        if w["type"] == "walk":
            print(base); continue
        print(f"{base}\n    jog {w['jogKm']} km in {w['jogMin']} min · "
              f"pace {_mmss(w['jogPace'])}/km · cadence {w['cadence']} "
              f"(Apple {w['cadenceApple']})")
        peaks = [b["maxHr"] for b in w["blocks"]]
        over = [p for p in peaks if cap and p and p > cap + hae["hrTolerance"]]
        print(f"    blocks: {len(w['blocks'])} · HR peaks {peaks} "
              f"{'⚠ CAP ' + str(cap) if over else '✓'}")
        print(f"    pace per block: {[_mmss(b['pace']) for b in w['blocks']]}")
        print(f"    cadence per block: {[b['cad'] for b in w['blocks']]}")
    print("\n=== RUNNING DYNAMICS ===")
    for f, x in {x["date"]: x for x in context.values()}.items():
        if x["_groundContact"]:
            print(f"{f}  contact {x['_groundContact']} ms · stride {x['_stride']} m · "
                  f"osc {x['_vertOsc']} cm · power {x['_power']} W")


def _mmss(x):
    if x is None: return "—"
    m = int(x); return f"{m}:{round((x - m) * 60):02d}"


# ═══════════════════════════════════════════════════════════════════ merge
CTX_FIELDS = ["sleep", "deepSleep", "remSleep", "weight", "restingHr", "hrv", "steps", "vo2max"]
PARTIAL = ["steps", "restingHr", "hrv"]   # incomplete in a mid-morning export


def cmd_merge(args):
    a = resolve(args.athlete, args.root)
    require_schema(a)
    cfg, hae = settings(a)
    cap = hae["easyDayHrCap"]
    res = json.load(open(f"{OUT}/summary.json"))
    today = args.today or datetime.now().strftime("%Y-%m-%d")
    changes = []

    # ---------------------------------------------------------- context
    ctx = load(a, "context")
    idx = {d["date"]: d for d in ctx["days"]}
    for date, new in sorted(res["context"].items()):
        old = idx.get(date)
        row = old if old else {"date": date, **{c: None for c in CTX_FIELDS}}
        for c in CTX_FIELDS:
            v = new[c]
            if date >= today and c in PARTIAL:
                v = None                      # current day: incomplete data
            if v is None:
                continue                      # never overwrite a value with null
            if row.get(c) is None or abs(float(row[c]) - float(v)) > 0.02:
                changes.append(f"context {date} {c}: {row.get(c)} → {v}")
                row[c] = v
        if not old:
            ctx["days"].append(row)
            changes.append(f"context {date}: new day")
    ctx["days"].sort(key=lambda d: d["date"])
    if not args.dry:
        save(a, "context", ctx)

    # ---------------------------------------------------------- sessions
    ses = load(a, "sessions")
    new_entries = []
    for w in res["workouts"]:
        # An entry that still has pendingReport was written by this script and nobody
        # reviewed it: it can be regenerated without losing anything. That is what lets
        # a parser fix correct already-loaded sessions, without ever overwriting what the
        # athlete filled in by hand.
        prev = next((x for x in ses["sessions"]
                     if x["date"] == w["date"] and abs(x["minutes"] - w["minutes"]) <= 3), None)
        if prev is not None:
            if not prev.get("pendingReport"):
                continue                      # already reviewed by the athlete: untouched
            ses["sessions"].remove(prev)
            changes.append(f"session REGENERATED {w['date']} (still pending report)")
        cycle, week = cycle_of(a, w["date"])   # both None for a run between cycles
        e = {
            "date": w["date"], "cycle": cycle, "week": week, "done": True,
            "type": w["type"], "km": w["km"], "minutes": w["minutes"],
            "avgHr": w["avgHr"], "maxHr": w["maxHr"],
            "cadence": w.get("cadence"),
            "surface": None, "rpe": None,
            "tracked": {ti["id"]: {"present": False, **{f["id"]: None for f in ti["fields"]}}
                        for ti in cfg.get("tracked", [])},
            "pendingReport": True,
            "notes": _auto_note(w, cfg, hae),
        }
        new_entries.append(e)
        changes.append(f"session NEW {w['date']} {w['type']} {w['km']} km — subjective report missing")
    if new_entries:
        ses["sessions"].extend(new_entries)
        ses["sessions"].sort(key=lambda s: s["date"])
        if not args.dry:
            save(a, "sessions", ses)

    # ---------------------------------------------------------- alerts
    alerts = []
    runs = sorted([w for w in res["workouts"] if w["type"] == "run"], key=lambda x: x["date"])
    for w in runs:
        peaks = [b["maxHr"] for b in w.get("blocks", []) if b["maxHr"]]
        over = [p for p in peaks if cap and p > cap + hae["hrTolerance"]]
        if over:
            alerts.append(f"{w['date']}: HR over the {cap} cap in "
                          f"{len(over)}/{len(peaks)} blocks (peaks {peaks})")
    if cfg.get("rules", {}).get("noBackToBackRunDays", True):
        for x, y in zip(runs, runs[1:]):
            if (datetime.strptime(y["date"], "%Y-%m-%d") -
                    datetime.strptime(x["date"], "%Y-%m-%d")).days == 1:
                alerts.append(f"RULE BROKEN: runs on consecutive days, {x['date']} and {y['date']}")
    for x, y in zip(runs, runs[1:]):
        if x.get("jogKm") and y.get("jogKm"):
            d = (y["jogKm"] - x["jogKm"]) / x["jogKm"]
            if d > 0.15:
                alerts.append(f"{y['date']}: jogging volume +{d*100:.0f}% "
                              f"({x['jogKm']} → {y['jogKm']} km), ~10% weekly rule")

    print(("[DRY RUN] " if args.dry else "") + f"athletes/{a.slug}: {len(changes)} changes")
    for c in changes:
        print("  ·", c)
    if alerts:
        print(f"\n⚠ {len(alerts)} alerts:")
        for x in alerts:
            print("  ·", x)
    else:
        print("\n✓ no plan-rule alerts")
    json.dump({"athlete": a.slug, "changes": changes, "alerts": alerts},
              open(f"{OUT}/changes.json", "w"), ensure_ascii=False, indent=1)


NOTE = {
    "es": dict(
        walk="[AUTO] Caminata {start}-{end}, {km} km en {minutes} min, FC {avgHr}/{maxHr}. "
             "Falta clasificar: recuperación o traslado.",
        run="[AUTO] {start}-{end} · {km} km ({jogKm} de trote en {jogMin} min a {pace}/km) · "
            "FC {avgHr}/{maxHr} · cadencia {cadence} · {temperature}C {humidity}%\n"
            "Picos por bloque ({nblocks}): {hr} — {verdict}.\n"
            "PENDIENTE DE REPORTE: {pending}esfuerzo percibido, zapatillas.",
        no_hr="sin serie de FC", over="{n}/{m} bloques sobre el techo de {cap}",
        under="bajo el techo de {cap}", no_cap="sin techo configurado"),
    "en": dict(
        walk="[AUTO] Walk {start}-{end}, {km} km in {minutes} min, HR {avgHr}/{maxHr}. "
             "To classify: recovery or commute.",
        run="[AUTO] {start}-{end} · {km} km ({jogKm} jogging in {jogMin} min at {pace}/km) · "
            "HR {avgHr}/{maxHr} · cadence {cadence} · {temperature}C {humidity}%\n"
            "Peaks per block ({nblocks}): {hr} — {verdict}.\n"
            "PENDING REPORT: {pending}perceived effort, shoes.",
        no_hr="no HR series", over="{n}/{m} blocks over the {cap} cap",
        under="under the {cap} cap", no_cap="no cap configured"),
}


def _auto_note(w, cfg, hae):
    T = NOTE.get(cfg["locale"]["lang"][:2], NOTE["en"])
    if w["type"] == "walk":
        return T["walk"].format(**w)
    cap = hae["easyDayHrCap"]
    peaks = [b["maxHr"] for b in w.get("blocks", []) if b["maxHr"] is not None]
    over = [p for p in peaks if cap and p > cap + hae["hrTolerance"]]
    verdict = (T["no_cap"] if not cap else
               T["over"].format(n=len(over), m=len(peaks), cap=cap) if over else
               T["under"].format(cap=cap))
    pending = "".join(f"{ti['label'].lower()}, " for ti in cfg.get("tracked", []))
    return T["run"].format(**w, pace=_mmss(w["jogPace"]), nblocks=len(w.get("blocks", [])),
                           hr="·".join(str(p) for p in peaks) if peaks else T["no_hr"],
                           verdict=verdict, pending=pending)


# ════════════════════════════════════════════════════════════════════ cli
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--athlete", help="slug under athletes/ (optional with one athlete)")
    common.add_argument("--root", default=ROOT, help="repo root, for tests")
    sub.add_parser("decode").set_defaults(func=cmd_decode)
    e = sub.add_parser("extract", parents=[common]); e.add_argument("--quiet", action="store_true")
    e.set_defaults(func=cmd_extract)
    m = sub.add_parser("merge", parents=[common])
    m.add_argument("--dry", action="store_true")
    m.add_argument("--today", help="YYYY-MM-DD, for tests")
    m.set_defaults(func=cmd_merge)
    x = sub.add_parser("all", parents=[common])
    x.add_argument("--dry", action="store_true")
    x.add_argument("--today")
    x.add_argument("--quiet", action="store_true")
    x.set_defaults(func=lambda y: (cmd_decode(y), cmd_extract(y), cmd_merge(y)))
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
