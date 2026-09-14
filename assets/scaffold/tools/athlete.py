"""Shared by the tools: which athlete, and where their files are.

    from athlete import resolve, load, save
    a = resolve(args.athlete)          # slug may be None when there is exactly one athlete
    plan = load(a, "plan")

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
