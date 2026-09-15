"""Synthetic demo athlete for README screenshots. No real person's data."""
import json, os, random, datetime as dt
random.seed(7)
B = "athletes/alex"; C = f"{B}/cycles/2026-city-10k"; os.makedirs(C, exist_ok=True)
today = dt.date(2026, 9, 16)
start = today - dt.timedelta(days=today.weekday()) - dt.timedelta(weeks=6)   # week 7 now
W = 12
goal_date = start + dt.timedelta(weeks=W - 1, days=6)
iso = lambda d: d.isoformat()
phases = [("Base", 1, 4, "Easy volume and strides"), ("Build", 5, 8, "Threshold work, long run grows"),
          ("Specific", 9, 10, "10K pace and a 5K test"), ("Taper", 11, 12, "Less volume, stay sharp")]
def phase(n): return next(p for p in phases if p[1] <= n <= p[2])
def watch(warm, reps, work, rec, cool):
    return (f"WATCH WORKOUT (Workout > Outdoor Run > Custom):\nWarmup: {warm} min - Time\n"
            f"Repeat {reps} times:\n   Work: {work} min - Time - HR alert: max 152 bpm\n"
            f"   Recovery: {rec} min - Time\nCooldown: {cool} min - Time")
weeks = []
for n in range(1, W + 1):
    w0 = start + dt.timedelta(weeks=n - 1)
    deload = n in (4, 8)
    f = 0.8 if deload else 1.0
    days = [{"date": iso(w0 + dt.timedelta(days=i)), "workouts": []} for i in range(7)]
    def run(i, typ, name, desc, km, detail, mins):
        days[i]["workouts"].append({"sport": "run", "type": typ, "name": name, "desc": desc, "detail": detail,
                                    "km": round(km, 1), "min": mins, "zone": "Zone 2" if typ in ("endurance", "long") else "Zone 3-4"})
    e = int((30 + n * 2) * f)
    run(1, "endurance", "Easy run", "Conversational pace all the way.", e / 6.5,
        f"MAIN: {e} min easy, HR peak under 152.\n\nFOCUS: relaxed shoulders, quick light steps.\n\n" + watch(5, 1, e - 10, 0, 5), e)
    q = int((40 + n) * f)
    reps = 3 + n // 3
    run(3, "threshold" if n > 4 else "endurance", f"Threshold {reps}×5′" if n > 4 else "Easy + strides",
        "Comfortably hard, never all-out." if n > 4 else "Easy run with 6 relaxed strides.", q / 6,
        f"Warm-up: 10 min easy\nMain: {reps} × 5 min at threshold, 2 min jog\nCool-down: 10 min easy\n\n" + watch(10, reps, 5, 2, 10), 10 + reps * 7 + 10)
    L = int((55 + n * 5) * f)
    if n == W:
        days[5]["workouts"].append({"sport": "run", "type": "race", "name": "CITY 10K", "desc": "Race day.",
                                    "detail": "Start controlled, build after 5 km.", "km": 10, "min": 55, "zone": ""})
    else:
        run(5, "long", "Long run", "Slow and steady; time on feet.", L / 7,
            f"MAIN: {L} min easy.\n\nFUEL: water every 20 min.\n\n" + watch(5, 1, L - 10, 0, 5), L)
    days[6]["workouts"].append({"sport": "strength", "type": "strength", "name": "Strength (20 min)", "desc": "Hips, calves, core.",
                                "detail": "Calf raises: 3x15\nGlute bridge: 3x12\nSide plank: 3x30 s", "km": 0, "min": 20, "zone": ""})
    p = phase(n)
    runs = [(d["date"], x) for d in days for x in d["workouts"] if x["sport"] == "run"]
    weeks.append({"n": n, "from": iso(w0), "to": iso(w0 + dt.timedelta(days=6)), "phase": p[0],
                  "focus": ("Deload: absorb the work" if deload else p[3]), "deload": deload,
                  "plannedKm": round(sum(x["km"] for _, x in runs), 1),
                  "hours": round(sum(x["min"] for d in days for x in d["workouts"]) / 60, 1),
                  "sessions": [{"date": d, "name": x["name"], "type": x["type"], "km": x["km"], "min": x["min"]} for d, x in runs],
                  "days": days})
plan = {"phases": [{"name": a, "from": b, "to": c, "focus": d} for a, b, c, d in phases],
        "notes": [
          {"id": "easy", "title": "Why easy days are easy", "body": "EASY IS WHERE THE BASE IS BUILT. Most of your running happens below the HR cap, and that is on purpose.\n\nTHE RULE: if you can't say a full sentence, slow down.\n\nThe quality session is once a week. Everything else supports it."},
          {"id": "light", "title": "Knee traffic light", "body": "GREEN = mild, goes away walking, nothing next day -> keep going.\nYELLOW = shows up earlier than last week or lingers -> repeat the week.\nRED = swelling, locking or pain that changes your stride -> stop and see a doctor."}],
        "weeks": weeks}
json.dump(plan, open(f"{C}/plan.json", "w"), indent=1)
json.dump({"id": "2026-city-10k", "status": "active", "from": weeks[0]["from"], "to": weeks[-1]["to"],
           "goal": {"type": "race", "name": "City 10K", "date": iso(goal_date), "time": "08:00", "place": "Riverside Park",
                    "distanceKm": 10, "target": "Sub 55:00"}}, open(f"{C}/cycle.json", "w"), indent=1)
cfg = {"schemaVersion": 2, "activeCycle": "2026-city-10k",
       "athlete": {"name": "Alex (demo)", "age": 33, "heightCm": 175},
       "schedule": {"days": ["tue", "thu", "sat"]},
       "rules": {"noBackToBackRunDays": True, "hoursBetweenQualityAndLong": 48, "easyDayHrCap": 152, "weeklyVolumeIncreasePct": 10, "repeatWeekIfSymptomEarlier": True},
       "zones": {"lthr": 170, "note": "Estimated; recalibrated with the week 10 5K test.", "easyZone": 2,
                 "hr": [{"zone": 1, "name": "Recovery", "hrLow": 0, "hrHigh": 137}, {"zone": 2, "name": "Aerobic", "hrLow": 138, "hrHigh": 151},
                        {"zone": 3, "name": "Tempo", "hrLow": 152, "hrHigh": 159}, {"zone": 4, "name": "Threshold", "hrLow": 160, "hrHigh": 172}],
                 "pace": [{"zone": 1, "name": "Recovery", "pace": "6:45+/km", "feel": "Could sing"}, {"zone": 2, "name": "Aerobic", "pace": "6:05-6:45/km", "feel": "Full sentences"},
                          {"zone": 3, "name": "Tempo", "pace": "5:40-6:00/km", "feel": "Short sentences"}, {"zone": 4, "name": "Threshold", "pace": "5:15-5:35/km", "feel": "A few words"}]},
       "cadence": {"base": 162, "target": 170},
       "gear": {"trackShoes": True, "shoes": ["Pegasus 41", "Novablast 5"]},
       "tracked": [{"id": "knee", "label": "Knee", "keyMetric": {"field": "onsetMin", "unit": "min", "label": "Onset minute", "goodDirection": "up", "baseline": {"value": 20, "label": "starting point (20 min)"}},
                    "chart": {"title": "Knee pain: when it shows up", "subtitle": "Later and later with more load means adaptation. Stuck while fitness improves means see a specialist."},
                    "fields": [{"id": "onsetMin", "label": "Onset", "type": "number"}, {"id": "severity", "label": "Severity", "type": "scale", "min": 0, "max": 10}],
                    "trafficLight": {"green": "Mild, fades walking, nothing next day. Keep going.", "yellow": "Earlier than last week or lingers next day. Repeat the week.", "red": "Swelling, locking, or pain that changes your stride. Stop and see a doctor."}}],
       "locale": {"tz": "America/New_York", "lang": "en-US"}, "ingest": {"mode": "manual"}, "calendar": {"uidPrefix": "alex"}}
json.dump(cfg, open(f"{B}/config.json", "w"), indent=1)
sessions = []
fbk = {"title": "Easy run", "light": "ok", "verdict": "Easy stayed easy: HR peak 149, cadence up again.",
       "table": [{"what": "HR peak", "plan": "≤152", "actual": "149", "ok": True}, {"what": "Cadence", "plan": "170", "actual": "169", "ok": True},
                 {"what": "Knee", "plan": "—", "actual": "at minute 34, 1/10", "ok": True}],
       "matters": ["The knee showed up 6 minutes later than last week with more load: that's adaptation.", "Cadence held without chasing it."],
       "whereYouAre": ["You're halfway through build and the base is holding.", "What we don't know yet: how threshold pace feels after the week 8 deload."],
       "next": {"level": "good", "action": "progress", "why": "every signal points the same way"}}
for w in weeks:
    for s in w["sessions"]:
        d = dt.date.fromisoformat(s["date"])
        if d >= today: continue
        k = w["n"]
        km = round(s["km"] * random.uniform(0.95, 1.08), 2)
        onset = 18 + k * 2 + random.randint(-2, 2)
        present = k < 7 and random.random() < 0.7
        e = {"date": s["date"], "cycle": "2026-city-10k", "week": k, "done": True, "type": "run", "km": km, "minutes": round(s["min"] * random.uniform(0.97, 1.03)),
             "avgHr": 138 + random.randint(-5, 6) + (6 if s["type"] == "threshold" else 0), "maxHr": 150 + random.randint(-4, 6) + (12 if s["type"] == "threshold" else 0),
             "cadence": min(174, 160 + k + random.randint(-2, 2)), "shoes": random.choice(cfg["gear"]["shoes"]), "rpe": random.randint(3, 6),
             "tracked": {"knee": {"present": present, "onsetMin": onset if present else None, "severity": (random.randint(1, 2) if present else None)}}}
        if d == max(dt.date.fromisoformat(x["date"]) for x in w["sessions"] if dt.date.fromisoformat(x["date"]) < today) and k == 6:
            e["feedback"] = fbk; e["notes"] = "Demo notes."
        sessions.append(e)
sessions.sort(key=lambda x: x["date"])
for x in sessions: x.pop("feedback", None)
sessions[-1]["feedback"] = fbk; sessions[-1]["notes"] = "Demo notes."
sessions[-1]["tracked"]["knee"] = {"present": True, "onsetMin": 34, "severity": 1}
json.dump({"sessions": sessions}, open(f"{B}/sessions.json", "w"), indent=1)
days = []
d = start - dt.timedelta(days=14); wkg = 76.5; rhr = 60
while d < today:
    wkg -= random.uniform(-0.05, 0.12); rhr += random.uniform(-0.6, 0.45)
    days.append({"date": iso(d), "sleep": round(random.uniform(6.1, 8.2), 2), "deepSleep": None, "remSleep": None, "weight": round(wkg, 1),
                 "restingHr": round(rhr), "hrv": None, "steps": random.randint(6000, 13000), "vo2max": None})
    d += dt.timedelta(days=1)
json.dump({"sleepTarget": 7, "days": days}, open(f"{B}/context.json", "w"), indent=1)
print("demo:", len(sessions), "sessions", len(days), "days", "goal", goal_date)
