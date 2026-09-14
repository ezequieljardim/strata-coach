# Instrumentation: how a session is written so it gets executed as intended

## The rule behind everything

**If a session shows one number, that number gets chased.** A runner told "cadence 168" with
cadence as the watch target will speed up until the watch is happy, and the easy run ends 25 bpm
over the cap. The number the athlete sees while running must be the guardrail that protects them —
almost always heart rate on easy days.

## Every `detail` states

1. **What to do**, with durations or distances.
2. **The guardrail as a number**: "HR peak ≤ 150; if it goes over, walk until 140".
3. **What each ambiguous word means for this athlete**: "jog = 8:00-8:30/km for you today",
   "strides = 20 s fast and relaxed at ~5:00/km, not a sprint, full walk recovery".
4. **How to check it** without guessing: "cadence 168 = 42 right-foot contacts in 30 s".
5. **The focus**: the one thing to pay attention to today.
6. The **watch block**, last.

Plan texts are in the athlete's language. Uppercase labels followed by a colon (`CADENCE:`,
`FOCUS:`) render as titled notes; `- ` lines as lists; `Name: amount` lines as a steps table.

## The watch block

The last block of a run's `detail`, starting with `WATCH WORKOUT`. `tools/check-min.py` parses it to
verify `min`, so the grammar matters:

```
WATCH WORKOUT (Workout > Outdoor Run > Custom):
Suggested name: "Base 6x3-2"
Warmup: 10 min - Time - no target (walking)
Repeat 6 times:
   Work: 3 min - Time - HR alert: max 150 bpm
   Recovery: 2 min - Time - no target (walking)
Cooldown: 5 min - Time - no target (walking)
```

- Segment lines start with `Warmup`, `Work`, `Recovery` or `Cooldown` (a number is allowed:
  `Work 2:`), followed by `:` and a duration (`N min`, `M:SS`, `N sec`).
- `Repeat N times:` applies to the **indented** lines under it.
- A segment with `Distance` makes the session unverifiable (listed, not failed).
- Spanish equivalents are accepted: `WORKOUT DEL RELOJ`, `Calentamiento`, `Trabajo`,
  `Recuperacion`, `Enfriamiento`, `Repetir N veces:`, `Distancia`, `seg`.
- Target is HR. Never cadence (see the rule above). Cadence goes by metronome audio.

## When the athlete moves a session

Moving a day often comes with a silent second change: another watch target, other shoes, a
different surface, the strength work dropped. Ask, and write down what changed in the moved
workout's `desc`.
