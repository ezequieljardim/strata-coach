#!/usr/bin/env python3
"""Checks an athlete's JSON against what the dashboard assumes.

    python3 tools/validate.py [--athlete <slug>]     # every athlete when omitted

`tsc` can't see the data: lib.ts casts it. A bare string where an array was expected
compiled fine and blanked the whole app on 09-14/09/2026. This catches that class of error
before a push, including in plans and configs written by an agent.
"""
import argparse, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from athlete import Athlete, ROOT, load, slugs

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def check(a):
    errs = []
    err = errs.append
    cfg, plan = load(a, "config"), load(a, "plan")
    ses, ctx = load(a, "sessions"), load(a, "context")

    # ---------------------------------------------------------------- config
    for k in ("athlete", "goal", "schedule", "rules", "tracked", "locale"):
        if k not in cfg:
            err(f"config: missing '{k}'")
    g = cfg.get("goal", {})
    if g.get("type") not in ("race", "distance", "habit"):
        err(f"config.goal.type must be race | distance | habit, got {g.get('type')!r}")
    if g.get("type") == "race" and not (g.get("date") and g.get("name")):
        err("config.goal: a race needs name and date")
    if g.get("date") and not DATE.match(g["date"]):
        err(f"config.goal.date not YYYY-MM-DD: {g['date']!r}")
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

    # ---------------------------------------------------------------- plan
    weeks = plan.get("weeks", [])
    if not weeks:
        err("plan: no weeks")
    prev_to = None
    for w in weeks:
        where = f"plan week {w.get('n')}"
        for k in ("n", "from", "to", "phase", "focus", "deload", "plannedKm", "hours", "sessions", "days"):
            if k not in w:
                err(f"{where}: missing '{k}'")
        if prev_to and w.get("from", "") <= prev_to:
            err(f"{where}: starts before the previous week ends")
        prev_to = w.get("to")
        for d in w.get("days", []):
            if not (w.get("from", "") <= d.get("date", "") <= w.get("to", "")):
                err(f"{where}: day {d.get('date')} outside the week")
            for x in d.get("workouts", []):
                for k in ("sport", "type", "name", "desc", "detail", "km", "min", "zone"):
                    if k not in x:
                        err(f"{where} {d.get('date')}: workout missing '{k}'")
    if not all(isinstance(n.get("body"), str) and n.get("title") for n in plan.get("notes", [])):
        err("plan.notes: each note needs title and body (string)")

    # ---------------------------------------------------------------- sessions
    def week_of(date):
        return next((w["n"] for w in weeks if w["from"] <= date <= w["to"]), None)

    dates = []
    for s in ses.get("sessions", []):
        where = f"session {s.get('date')}"
        dates.append(s.get("date", ""))
        if not DATE.match(s.get("date", "")):
            err(f"{where}: bad date")
        if s.get("type", "run") not in ("run", "walk"):
            err(f"{where}: type must be run | walk")
        for k in ("week", "done", "km", "minutes"):
            if k not in s:
                err(f"{where}: missing '{k}'")
        wk = week_of(s.get("date", ""))
        if wk is not None and s.get("week") != wk:
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
