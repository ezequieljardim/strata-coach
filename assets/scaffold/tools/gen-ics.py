#!/usr/bin/env python3
"""Builds an athlete's .ics calendar from their plan.

    python3 tools/gen-ics.py [--athlete <slug>] [--out file.ics]

One VEVENT per workout with sport == "run", numbered by date. Strength work on the same
day is appended to the description as "AFTER — ...". Strength-only days get their own
event. Text is in the athlete's language (config.locale.lang).

UIDs ARE STABLE on purpose: <uidPrefix>-NNN-YYYY-MM-DD@claudecoach. Re-importing UPDATES
the calendar's events instead of duplicating them. Don't change the numbering scheme or
config.calendar.uidPrefix of an existing athlete unless you want every event duplicated.
"""
import argparse, datetime, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from athlete import load, resolve

TEXT = {
    "es": dict(prodid="Claude Coach", race="CARRERA", duration="Duracion estimada: %d min",
               distance="Distancia: %s km", zone="Zona: %s", after="AL TERMINAR", week="Semana",
               tomorrow="Mañana: ", plan_of="Plan de %d semanas para la %s del %s"),
    "en": dict(prodid="Claude Coach", race="RACE", duration="Estimated duration: %d min",
               distance="Distance: %s km", zone="Zone: %s", after="AFTER", week="Week",
               tomorrow="Tomorrow: ", plan_of="%d-week plan for %s on %s"),
}


def esc(s):
    return s.replace('\\', '\\\\').replace(';', r'\;').replace(',', '\\,').replace('\n', '\\n')


def d2(f):  # 2026-08-11 -> 20260811
    return f.replace('-', '')


def plus1(f):
    y, m, dd = map(int, f.split('-'))
    return (datetime.date(y, m, dd) + datetime.timedelta(days=1)).strftime('%Y%m%d')


def num(x):
    return '%g' % x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--athlete")
    ap.add_argument("--out")
    args = ap.parse_args()
    a = resolve(args.athlete)
    cfg, plan = load(a, "config"), load(a, "plan")
    cal = cfg.get("calendar", {})
    T = TEXT.get(cfg["locale"]["lang"][:2], TEXT["en"])
    goal = cfg["goal"]
    title = goal.get("name") or cfg["athlete"]["name"]
    prefix = cal.get("uidPrefix", a.slug)
    stamp = cal.get("stamp", "20260101T120000Z")
    out_file = args.out or os.path.join(a.root, cal.get("file") or f"athletes/{a.slug}/calendar.ics")
    lang = cfg["locale"]["lang"][:2].upper()

    out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//%s//%s//%s' % (T["prodid"], title, lang),
           'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Running - %s' % title,
           'X-WR-TIMEZONE:%s' % cfg["locale"]["tz"]]
    if goal.get("date"):
        y, m, d = goal["date"].split("-")
        out.append('X-WR-CALDESC:' + T["plan_of"] % (len(plan["weeks"]), title, f"{d}/{m}/{y}"))

    def vevent(uid, f, summary, body):
        return ['BEGIN:VEVENT',
                'UID:%s@claudecoach' % uid,
                'DTSTAMP:%s' % stamp,
                'DTSTART;VALUE=DATE:%s' % d2(f),
                'DTEND;VALUE=DATE:%s' % plus1(f),
                'SUMMARY:%s' % esc(summary),
                'DESCRIPTION:%s' % esc(body),
                'TRANSP:TRANSPARENT', 'STATUS:CONFIRMED', 'CATEGORIES:Running',
                'BEGIN:VALARM', 'ACTION:DISPLAY',
                'DESCRIPTION:%s' % esc(T["tomorrow"] + summary),
                'TRIGGER:-PT4H', 'END:VALARM', 'END:VEVENT']

    n = nf = 0
    for w in plan['weeks']:
        foot = '— %s %d (%s): %s' % (T["week"], w['n'], w['phase'], w['focus'])
        for day in w['days']:
            runs = [x for x in day['workouts'] if x['sport'] == 'run']
            extra = [x for x in day['workouts'] if x['sport'] == 'strength']
            if not runs:
                # Strength-only day: its own event. UID by date, NOT by the counter n, so the
                # run numbering doesn't shift and duplicate the calendar.
                for x in extra:
                    nf += 1
                    body = ('%s\n\n%s\n\n%s\n\n%s'
                            % (x['desc'], T["duration"] % x['min'], x['detail'].strip(), foot))
                    out += vevent('%s-fza-%s' % (prefix, d2(day['date'])), day['date'],
                                  '💪 %s · %s' % (week_short(T, w['n']), x['name']), body)
                continue
            r = runs[0]
            n += 1
            f = day['date']
            is_race = r['type'] == 'race'
            emoji = '🏆' if is_race else ('🚶' if not r['km'] else '🏃')
            if is_race:
                summary = '%s %s: %s' % (emoji, T["race"], title)
                if goal.get("time"):
                    summary += ' — %s' % goal["time"]
            else:
                summary = '%s %s · %s' % (emoji, week_short(T, w['n']), r['name'])
                if r['km']:
                    summary += ' · %s km' % num(r['km'])

            head = [r['desc'], '', T["duration"] % r['min']]
            if r['km']:
                head.append(T["distance"] % num(r['km']))
            if r['zone']:
                head.append(T["zone"] % r['zone'])
            body = '\n'.join(head) + '\n\n' + r['detail'].strip()
            for x in extra:
                body += ('\n\n─────────────\n%s — %s\n%s\n\n%s'
                         % (T["after"], x['name'], x['desc'], x['detail'].strip()))
            body += '\n\n' + foot
            out += vevent('%s-%03d-%s' % (prefix, n, f), f, summary, body)
    out.append('END:VCALENDAR')
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    open(out_file, 'w', newline='').write('\r\n'.join(out) + '\r\n')
    print('%d events (%d runs + %d strength) -> %s' % (n + nf, n, nf, os.path.relpath(out_file, a.root)))


def week_short(T, n):
    return ('S%d' if T is TEXT["es"] else 'W%d') % n


if __name__ == '__main__':
    main()
