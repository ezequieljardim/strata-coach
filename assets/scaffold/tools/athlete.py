"""Shared by the tools: which athlete, and where their files are.

    from athlete import resolve, load, load_plan
    a = resolve(args.athlete)          # slug may be None when there is exactly one athlete
    plan = load_plan(a)                # the active cycle's plan

A repo holds one folder per athlete under athletes/. Guessing is never done when there
is more than one: loading a run into the wrong athlete is the easiest mistake to make.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Athlete:
    def __init__(self, root, slug):
        self.root, self.slug = root, slug
        self.dir = os.path.join(root, "athletes", slug)

    def path(self, name):
        return os.path.join(self.dir, name if "." in name else name + ".json")


def slugs(root=ROOT):
    base = os.path.join(root, "athletes")
    if not os.path.isdir(base):
        return []
    return sorted(d for d in os.listdir(base)
                  if os.path.isfile(os.path.join(base, d, "config.json")))


def resolve(slug=None, root=ROOT):
    found = slugs(root)
    if slug:
        if slug not in found:
            sys.exit(f"unknown athlete '{slug}'. Available: {', '.join(found) or 'none'}")
        return Athlete(root, slug)
    if len(found) == 1:
        return Athlete(root, found[0])
    sys.exit(f"more than one athlete, pass --athlete <slug>: {', '.join(found)}"
             if found else "no athletes/ folder with a config.json")


def load(a, name):
    with open(a.path(name)) as f:
        return json.load(f)


def save(a, name, data):
    with open(a.path(name), "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------- cycles (schema 2)
#
# A cycle is one goal with its plan: athletes/<slug>/cycles/<id>/{cycle.json, plan.json,
# retro.md}. sessions.json and context.json stay at the athlete level and span every cycle;
# each session says which cycle it belongs to (or null, between cycles).

SCHEMA = 2


def require_schema(a):
    v = load(a, "config").get("schemaVersion", 1)
    if v < SCHEMA:
        sys.exit(f"athletes/{a.slug} is on data schema {v}, tools expect {SCHEMA}: "
                 f"run `python3 tools/migrate.py` (or /strata:upgrade)")


def cycle_ids(a):
    base = os.path.join(a.dir, "cycles")
    if not os.path.isdir(base):
        return []
    ids = [d for d in os.listdir(base) if os.path.isfile(os.path.join(base, d, "cycle.json"))]
    return sorted(ids, key=lambda c: load_cycle(a, c).get("from", ""))


def active_cycle(a):
    return load(a, "config")["activeCycle"]


def cycle_file(a, cid, name):
    return os.path.join(a.dir, "cycles", cid, name if "." in name else name + ".json")


def load_cycle(a, cid):
    with open(cycle_file(a, cid, "cycle")) as f:
        return json.load(f)


def load_plan(a, cid=None):
    with open(cycle_file(a, cid or active_cycle(a), "plan")) as f:
        return json.load(f)


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def cycle_of(a, date):
    """(cycle id, week n) of the plan week that contains `date`, or (None, None)."""
    for cid in cycle_ids(a):
        for w in load_plan(a, cid)["weeks"]:
            if w["from"] <= date <= w["to"]:
                return cid, w["n"]
    return None, None
