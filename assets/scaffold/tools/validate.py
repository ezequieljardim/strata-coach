#!/usr/bin/env python3
"""Checks an athlete's JSON against what the dashboard assumes.

    python3 tools/validate.py [--athlete <slug>]     # every athlete when omitted

`tsc` can't see the data: lib.ts casts it. A bare string where an array was expected
compiled fine and blanked the whole app on 09-14/09/2026. This catches that class of error
before a push, including in plans and configs written by an agent.
"""
import argparse, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from athlete import SCHEMA, Athlete, ROOT, cycle_ids, load, load_cycle, load_plan, slugs

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def check_goal(g, where, err):
    if g.get("type") not in ("race", "distance", "habit"):
        err(f"{where}.type must be race | distance | habit, got {g.get('type')!r}")
    if g.get("type") == "race" and not (g.get("date") and g.get("name")):
        err(f"{where}: a race needs name and date")
    if g.get("date") and not DATE.match(g["date"]):
        err(f"{where}.date not YYYY-MM-DD: {g['date']!r}")


def check_plan(plan, where, err):
    weeks = plan.get("weeks", [])
    if not weeks:
        err(f"{where}: no weeks")
    prev_to = None
    for w in weeks:
        wk = f"{where} week {w.get('n')}"
        for k in ("n", "from", "to", "phase", "focus", "deload", "plannedKm", "hours", "sessions", "days"):
            if k not in w:
                err(f"{wk}: missing '{k}'")
        if prev_to and w.get("from", "") <= prev_to:
            err(f"{wk}: starts before the previous week ends")
        prev_to = w.get("to")
        for d in w.get("days", []):
            if not (w.get("from", "") <= d.get("date", "") <= w.get("to", "")):
                err(f"{wk}: day {d.get('date')} outside the week")
            for x in d.get("workouts", []):
                for k in ("sport", "type", "name", "desc", "detail", "km", "min", "zone"):
                    if k not in x:
                        err(f"{wk} {d.get('date')}: workout missing '{k}'")
    if not all(isinstance(n.get("body"), str) and n.get("title") for n in plan.get("notes", [])):
        err(f"{where}.notes: each note needs title and body (string)")


def check(a):
    errs = []
    err = errs.append
    cfg = load(a, "config")
    ses, ctx = load(a, "sessions"), load(a, "context")

    # ---------------------------------------------------------------- config
    if cfg.get("schemaVersion", 1) < SCHEMA:
        return [f"data schema {cfg.get('schemaVersion', 1)} < {SCHEMA}: run python3 tools/migrate.py"]
    for k in ("athlete", "activeCycle", "schedule", "rules", "tracked", "locale"):
        if k not in cfg:
            err(f"config: missing '{k}'")
    if "goal" in cfg:
        err("config.goal belongs in cycles/<id>/cycle.json now")
    DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    sch = cfg.get("schedule", {})
    bad = [d for d in sch.get("days", []) + list(sch.get("available", {})) + sch.get("preferred", []) if d not in DAYS]
    if bad:
        err(f"config.schedule: unknown day names {bad} (use mon..sun)")
    if sch.get("available") and not set(sch.get("days", [])) <= set(sch["available"]):
        err(f"config.schedule.days {sch.get('days')} includes days not in schedule.available")
    if sch.get("longRunDay") and sch["longRunDay"] not in sch.get("days", []):
        err(f"config.schedule.longRunDay {sch['longRunDay']!r} is not one of schedule.days")
    loc = cfg.get("locale", {})
    if not loc.get("tz") or not loc.get("lang"):
        err("config.locale needs tz and lang")
    tracked = {}
    for i, t in enumerate(cfg.get("tracked", [])):
        where = f"config.tracked[{i}]"
        if not t.get("id") or not t.get("label"):
            err(f"{where}: needs id and label")
        fields = {f.get("id") for f in t.get("fields", [])}
        km = t.get("keyMetric")
        if km and km.get("field") not in fields:
            err(f"{where}.keyMetric.field {km.get('field')!r} is not one of its fields")
        tl = t.get("trafficLight")
        if tl and set(tl) != {"green", "yellow", "red"}:
            err(f"{where}.trafficLight needs exactly green, yellow, red")
        tracked[t.get("id")] = fields

    # ---------------------------------------------------------------- cycles
    ids = cycle_ids(a)
    if cfg.get("activeCycle") not in ids:
        err(f"config.activeCycle {cfg.get('activeCycle')!r} has no cycles/<id>/cycle.json")
    plans = {}
    for cid in ids:
        where = f"cycles/{cid}"
        c = load_cycle(a, cid)
        if c.get("id") != cid:
            err(f"{where}/cycle.json: id {c.get('id')!r} doesn't match its folder")
        if c.get("status") not in ("active", "completed", "abandoned"):
            err(f"{where}: status must be active | completed | abandoned")
        if (c.get("status") == "active") != (cid == cfg.get("activeCycle")):
            err(f"{where}: status {c.get('status')!r} disagrees with config.activeCycle")
        check_goal(c.get("goal", {}), f"{where}.goal", err)
        try:
            plans[cid] = load_plan(a, cid)
        except FileNotFoundError:
            err(f"{where}: missing plan.json")
            continue
        check_plan(plans[cid], f"{where}/plan", err)
        weeks = plans[cid].get("weeks") or [{}]
        if c.get("from") != weeks[0].get("from") or c.get("to") != weeks[-1].get("to"):
            err(f"{where}: from/to must match its plan's first and last week")
    spans = sorted((load_cycle(a, cid).get("from", ""), load_cycle(a, cid).get("to", ""), cid) for cid in ids)
    for (f1, t1, c1), (f2, _, c2) in zip(spans, spans[1:]):
        if f2 <= t1:
            err(f"cycles {c1} and {c2} overlap")

    # ---------------------------------------------------------------- sessions
    def cycle_of(date):
        for cid, p in plans.items():
            for w in p.get("weeks", []):
                if w["from"] <= date <= w["to"]:
                    return cid, w["n"]
        return None, None

    dates = []
    for s in ses.get("sessions", []):
        where = f"session {s.get('date')}"
        dates.append(s.get("date", ""))
        if not DATE.match(s.get("date", "")):
            err(f"{where}: bad date")
        if s.get("type", "run") not in ("run", "walk"):
            err(f"{where}: type must be run | walk")
        for k in ("cycle", "week", "done", "km", "minutes"):
            if k not in s:
                err(f"{where}: missing '{k}'")
        cid, wk = cycle_of(s.get("date", ""))
        if s.get("cycle") != cid:
            err(f"{where}: cycle={s.get('cycle')!r} but the date falls in {cid!r}")
        elif s.get("week") != wk:
            err(f"{where}: week={s.get('week')} but the date falls in week {wk}")
        for tid, rep in (s.get("tracked") or {}).items():
            if tid not in tracked:
                err(f"{where}: tracked '{tid}' is not in config.tracked")
            elif not isinstance(rep.get("present"), bool):
                err(f"{where}: tracked.{tid}.present must be true/false")
        fb = s.get("feedback")
        if fb:
            for k in ("matters", "whereYouAre", "table"):
                if not isinstance(fb.get(k), list):
                    err(f"{where}: feedback.{k} must be an array (a bare string blanks the app)")
            if fb.get("light") not in ("ok", "warn", "stop"):
                err(f"{where}: feedback.light must be ok | warn | stop")
            if (fb.get("next") or {}).get("level") not in ("good", "tight", "bad"):
                err(f"{where}: feedback.next.level must be good | tight | bad")
    if dates != sorted(dates):
        err("sessions: not sorted by date")

    # ---------------------------------------------------------------- context
    days = [d.get("date", "") for d in ctx.get("days", [])]
    if days != sorted(days) or len(days) != len(set(days)):
        err("context.days: must be sorted by date without duplicates")
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--athlete")
    ap.add_argument("--root", default=ROOT)
    args = ap.parse_args()
    targets = [args.athlete] if args.athlete else slugs(args.root)
    if not targets:
        sys.exit("no athletes found")
    bad = 0
    for slug in targets:
        errs = check(Athlete(args.root, slug))
        print(f"athletes/{slug}: " + ("OK" if not errs else f"{len(errs)} problem(s)"))
        for e in errs:
            print("  ·", e)
        bad += len(errs)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
