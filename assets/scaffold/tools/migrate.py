#!/usr/bin/env python3
"""Brings athletes' data to the schema the app and tools expect.

    python3 tools/migrate.py [--athlete <slug>] [--dry] [--cycle-id <id>]

Every migration is idempotent and only runs when `config.schemaVersion` is below its number
(missing means 1). Run it after updating the app (/strata:upgrade does), then validate.

  2 · cycles   goal + plan.json become athletes/<slug>/cycles/<id>/{cycle.json, plan.json};
               config gets activeCycle; every session gets `cycle` (null outside any plan).
               --cycle-id names that first cycle (default: <year>-<goal name>).
"""
import argparse, os, re, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from athlete import ROOT, Athlete, SCHEMA, load, save, save_json, slugs


def slugify(x):
    x = unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", x.lower()).strip("-")[:40].strip("-")


def to_v2(a, cfg, dry, cycle_id=None):
    plan = load(a, "plan")
    goal = cfg.get("goal", {"type": "habit"})
    weeks = plan["weeks"]
    start, end = weeks[0]["from"], weeks[-1]["to"]
    cid = cycle_id or f"{(goal.get('date') or start)[:4]}-{slugify(goal.get('name') or goal['type'])}"
    changes = [f"goal + plan.json → cycles/{cid}/", f"activeCycle = {cid}"]

    ses = load(a, "sessions")
    tagged = 0
    for i, s in enumerate(ses["sessions"]):
        inside = start <= s["date"] <= end
        tagged += inside
        # `cycle` right after `date` keeps entries readable
        ses["sessions"][i] = {"date": s["date"], "cycle": cid if inside else None,
                              **{k: v for k, v in s.items() if k not in ("date", "cycle")}}
    changes.append(f"{tagged}/{len(ses['sessions'])} sessions tagged with the cycle")
    if dry:
        return changes

    save_json(os.path.join(a.dir, "cycles", cid, "cycle.json"),
              {"id": cid, "status": "active", "from": start, "to": end, "goal": goal})
    save_json(os.path.join(a.dir, "cycles", cid, "plan.json"), plan)
    os.remove(a.path("plan"))
    save(a, "sessions", ses)
    new_cfg = {"schemaVersion": 2, "activeCycle": cid}
    new_cfg.update({k: v for k, v in cfg.items() if k not in ("goal", "schemaVersion", "activeCycle")})
    save(a, "config", new_cfg)
    return changes


MIGRATIONS = [(2, "cycles", to_v2)]
assert MIGRATIONS[-1][0] == SCHEMA


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--athlete")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--cycle-id")
    ap.add_argument("--root", default=ROOT)
    args = ap.parse_args()
    targets = [args.athlete] if args.athlete else slugs(args.root)
    if args.cycle_id and len(targets) != 1:
        sys.exit("--cycle-id needs a single athlete (--athlete <slug>)")
    for slug in targets:
        a = Athlete(args.root, slug)
        cfg = load(a, "config")
        v = cfg.get("schemaVersion", 1)
        if v >= SCHEMA:
            print(f"athletes/{slug}: schema {v}, up to date")
            continue
        for n, name, fn in MIGRATIONS:
            if v >= n:
                continue
            changes = fn(a, cfg, args.dry, args.cycle_id)
            print(f"athletes/{slug}: {'[dry] ' if args.dry else ''}schema {v} → {n} ({name})")
            for c in changes:
                print("  ·", c)
            v = n
            cfg = load(a, "config") if not args.dry else cfg


if __name__ == "__main__":
    main()
