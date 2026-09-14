#!/usr/bin/env python3
"""Picks which exports to download from Google Drive when names are duplicated.

Drive indexes by ID, not by name: one folder can hold two files called
`Health_Data-2026-08-16.json`. It happens because Health Auto Export re-uploads a day when
it completes it instead of replacing the previous one. Faced with that, `rclone copy` warns
"Duplicate object found in source - ignoring" and keeps one **with no guarantee of which**,
so it may download the old, incomplete version.

Reads `rclone lsjson` output, keeps the newest of each name within the date window, and
prints "ID destination" pairs for `rclone backend copyid`.

    DATES="2026-08-19 2026-08-18" DEST=~/.hae/raw python3 pick-exports.py lsjson.json

Discards go to stderr so they end up in the sync log.
"""
import json
import os
import sys

PREFIXES = ("Health_Data", "Workouts_Data")


def pick(files, dates):
    """Returns {name: file}, keeping the highest ModTime of each name."""
    wanted = {f"{pre}-{d}.json" for d in dates for pre in PREFIXES}
    best = {}
    for f in files:
        if f.get("IsDir") or f["Name"] not in wanted:
            continue
        prev = best.get(f["Name"])
        if prev is None:
            best[f["Name"]] = f
            continue
        # ModTime is ISO-8601 in UTC: comparing as text sorts correctly.
        win, lose = (f, prev) if f["ModTime"] > prev["ModTime"] else (prev, f)
        print(f"DUP {f['Name']}: keeping {win['ModTime']} ({win['Size']} B), "
              f"discarding {lose['ModTime']} ({lose['Size']} B)", file=sys.stderr)
        best[f["Name"]] = win
    return best


def main():
    dates = os.environ["DATES"].split()
    dest = os.environ["DEST"]
    files = json.load(open(sys.argv[1]))
    for name, f in sorted(pick(files, dates).items()):
        print(f["ID"], f"{dest}/{name}")


def demo():
    """Self-check: the newest wins regardless of listing order."""
    old = {"Name": "Health_Data-2026-08-16.json", "ID": "old",
           "Size": 667003, "ModTime": "2026-08-17T01:41:50.799Z", "IsDir": False}
    new = {"Name": "Health_Data-2026-08-16.json", "ID": "new",
           "Size": 703796, "ModTime": "2026-08-18T13:25:06.927Z", "IsDir": False}
    outside = {"Name": "Health_Data-2026-08-01.json", "ID": "outside",
               "Size": 1, "ModTime": "2026-08-01T00:00:00.000Z", "IsDir": False}
    other = {"Name": "anything.json", "ID": "other",
             "Size": 1, "ModTime": "2026-08-18T00:00:00.000Z", "IsDir": False}
    d = ["2026-08-16"]
    assert pick([old, new], d)["Health_Data-2026-08-16.json"]["ID"] == "new"
    assert pick([new, old], d)["Health_Data-2026-08-16.json"]["ID"] == "new"
    assert pick([old, new, outside, other], d).keys() == {"Health_Data-2026-08-16.json"}
    assert pick([], d) == {}
    print("ok")


if __name__ == "__main__":
    demo() if "--demo" in sys.argv else main()
