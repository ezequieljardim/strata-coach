#!/usr/bin/env python3
"""Builds and keeps a plan.json consistent.

    python3 tools/plan.py skeleton --athlete <slug> --start 2027-01-04 --weeks 16
    python3 tools/plan.py derive   --athlete <slug> [--check]

skeleton  Writes empty weeks (Monday to Sunday, every day present, no workouts) from a start
          Monday and a number of weeks, ending the week that contains config.goal.date when
          --weeks is omitted. The coach then fills `days[].workouts`, phase and focus, week by
          week — never the whole plan in one go.

derive    Recomputes what is duplicated from `days[].workouts`: `weeks[].sessions` (one per
          run workout), `plannedKm` (sum of run km) and `hours` (sum of every workout's min).
          Those numbers used to be hand-written in three places and drifted on their own.
          --check only reports differences (exit 1), for verification.
"""
import argparse, datetime as dt, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from athlete import load, resolve, save


def iso(d):
    return d.strftime("%Y-%m-%d")


def skeleton(a, start, weeks):
    cfg = load(a, "config")
    s = dt.date.fromisoformat(start)
    if s.weekday() != 0:
        sys.exit(f"--start must be a Monday, {start} is not")
    if weeks is None:
        goal = cfg["goal"].get("date")
        if not goal:
            sys.exit("--weeks is required when the goal has no date")
        g = dt.date.fromisoformat(goal)
        weeks = (g - s).days // 7 + 1
    if os.path.exists(a.path("plan")) and load(a, "plan").get("weeks"):
        sys.exit("plan.json already has weeks: refusing to overwrite a plan")
    plan = {"phases": [], "notes": [], "weeks": []}
    for n in range(weeks):
        w0 = s + dt.timedelta(weeks=n)
        plan["weeks"].append({
            "n": n + 1, "from": iso(w0), "to": iso(w0 + dt.timedelta(days=6)),
            "phase": "", "focus": "", "deload": False, "plannedKm": 0, "hours": 0,
            "sessions": [],
            "days": [{"date": iso(w0 + dt.timedelta(days=i)), "workouts": []} for i in range(7)],
        })
    save(a, "plan", plan)
    print(f"athletes/{a.slug}/plan.json: {weeks} empty weeks from {start}")


def derived(w):
    runs = [(d["date"], x) for d in w["days"] for x in d["workouts"] if x["sport"] == "run"]
    return {
        "sessions": [{"date": date, "name": x["name"], "type": x["type"], "km": x["km"], "min": x["min"]}
                     for date, x in runs],
        "plannedKm": round(sum(x["km"] for _, x in runs), 1),
        "hours": round(sum(x["min"] for d in w["days"] for x in d["workouts"]) / 60, 1),
    }


def derive(a, check):
    plan = load(a, "plan")
    diffs = []
    for w in plan["weeks"]:
        for k, v in derived(w).items():
            if w.get(k) != v:
                diffs.append(f"week {w['n']} {k}: {w.get(k)!r} → {v!r}" if k != "sessions"
                             else f"week {w['n']} sessions differ from its run workouts")
                w[k] = v
    for x in diffs:
        print(x)
    if check:
        print("OK: sessions, plannedKm and hours match the workouts." if not diffs else f"{len(diffs)} difference(s).")
        return 1 if diffs else 0
    save(a, "plan", plan)
    print(f"athletes/{a.slug}/plan.json: {len(diffs)} field(s) updated")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("skeleton"); s.add_argument("--athlete"); s.add_argument("--start", required=True)
    s.add_argument("--weeks", type=int)
    d = sub.add_parser("derive"); d.add_argument("--athlete"); d.add_argument("--check", action="store_true")
    args = ap.parse_args()
    a = resolve(args.athlete)
    if args.cmd == "skeleton":
        skeleton(a, args.start, args.weeks)
        return 0
    return derive(a, args.check)


if __name__ == "__main__":
    sys.exit(main())
