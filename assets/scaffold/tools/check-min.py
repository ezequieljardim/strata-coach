#!/usr/bin/env python3
"""Checks that the plan's minutes add up with the watch workout.

    python3 tools/check-min.py [--athlete <slug>]

`min` is hand-written and duplicated in three places (`days[].workouts[].min`,
`weeks[].sessions[].min` and `weeks[].hours`), so it drifts every time the plan is
touched. This recomputes the duration from the WATCH WORKOUT block, the only version of
the detail written in a parseable format. Run it after any change to plan.json.

Sessions with distance-based segments (tests, 1000 m repeats, the race) can't be computed
without assuming a pace: they are skipped and listed separately.

The block may be written in Spanish (plans from before the migration) or English.
"""
import argparse, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from athlete import load, resolve

WATCH = re.compile(r'^(WATCH WORKOUT|WORKOUT DEL RELOJ)')
DUR = re.compile(r'(\d+)\s*min|(\d+):(\d\d)\b|(\d+)\s*(?:seg|sec)')
SEGMENT = re.compile(r'(Calentamiento|Enfriamiento|Trabajo|Recuperacion|Warm-?up|Cool-?down|Work|Recovery)\s*\d*\s*:', re.I)
REPEAT = re.compile(r'(?:Repetir|Repeat) (\d+) (?:veces|times):')
DISTANCE = re.compile(r'Distancia|Distance')


def minutes(line):
    """Minutes of a watch segment. None if the target is a distance."""
    if DISTANCE.search(line):
        return None
    m = DUR.search(line)
    if not m:
        return 0.0
    if m.group(1):
        return float(m.group(1))
    if m.group(2):  # "2:30"
        return int(m.group(2)) + int(m.group(3)) / 60
    return float(m.group(4)) / 60


def duration(block):
    """Workout duration. None if any segment is distance-based."""
    total, reps, in_repeat = 0.0, 0, False
    for line in block.split('\n')[1:]:
        rep = REPEAT.match(line.strip())
        if rep:
            reps, in_repeat = int(rep.group(1)), True
            continue
        if not SEGMENT.match(line.strip()):
            in_repeat = False
            continue
        m = minutes(line)
        if m is None:
            return None
        indented = line.startswith(' ')
        total += m * (reps if (in_repeat and indented) else 1)
        if not indented:
            in_repeat = False
    return round(total)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--athlete")
    plan = load(resolve(ap.parse_args().athlete), "plan")

    errors, unverified = [], []
    for week in plan['weeks']:
        by_date = {}
        for day in week['days']:
            for w in day['workouts']:
                if w['sport'] != 'run':
                    continue
                by_date[day['date']] = w['min']
                block = [b for b in w['detail'].split('\n\n') if WATCH.match(b)]
                computed = duration(block[0]) if block else None
                if not computed:
                    unverified.append(day['date'])
                elif computed != w['min']:
                    errors.append('%s  min=%d  watch=%d' % (day['date'], w['min'], computed))

        for s in week['sessions']:
            if s['min'] != by_date.get(s['date'], s['min']):
                errors.append('%s  weeks[].sessions[].min=%d does not match days[].workouts[].min=%d'
                              % (s['date'], s['min'], by_date[s['date']]))

        hours = round(sum(w['min'] for d in week['days'] for w in d['workouts']) / 60, 1)
        if hours != week['hours']:
            errors.append('week %d  hours=%.1f  sum of min=%.1f' % (week['n'], week['hours'], hours))

    if unverified:
        print('not verified (distance-based or no watch block): %s' % ', '.join(unverified))
    if errors:
        print('\n'.join(errors))
        print('\n%d mismatch(es).' % len(errors))
        return 1
    print('OK: the plan minutes add up.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
