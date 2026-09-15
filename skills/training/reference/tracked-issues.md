# Tracked issues: following a symptom without diagnosing it

A tracked issue is anything the athlete wants watched session by session because it has stopped
them before or might: a knee that starts hurting mid-run, numbness in the legs, an Achilles that's
stiff the next morning. Zero is the normal number. They live in `config.tracked[]`; each gets a
dashboard tab, a question in `/session`, and a traffic light.

## Designing one, with the athlete

1. **Describe it in their words**: where, what it feels like, when it appears, what makes it go
   away, since when, what happened on previous attempts.
2. **Pick the key metric.** The one number that, tracked week over week, would move differently
   under the plausible explanations. Usually *when* it appears:
   - numbness or pain that appears at some distance → `onsetKm`;
   - pain that appears after some minutes → `onsetMin`;
   - stiffness the morning after → `morningStiffness` on a 0-10 scale, reported the next day.

   `goodDirection` says which way is improvement (`up` for onset distance, `down` for severity).
   A `baseline` draws the starting point on the chart.
   Name things so they read well on the dashboard: `label` is the tab (the body part or symptom:
   "Rodilla", "Tibias"), `chart.title` says what's measured ("Dolor de rodilla: cuándo aparece",
   not a question like "¿Aparece la rodilla?"), and `keyMetric.label` is the series name
   ("Minuto de aparición").
3. **Pick the few fields worth recording** every time: severity 0-10, side, exact location,
   minutes until it clears. Fewer is better; each field is a question after every run.
4. **Write the traffic light** in plain words:
   - green: mild, goes away easing off, nothing the next day → continue;
   - yellow: appears earlier than last week, or lingers the next day → repeat the week;
   - red: the red flags → stop running and see a professional.
5. **Write the red flags.** Generic ones that always apply: pain that changes the way they run,
   pain at rest or at night, a localized spot on a bone that hurts to press, swelling, numbness or
   weakness that doesn't go away when stopping, loss of strength.
6. **Write the hypotheses as questions for a doctor**, in `HANDOFF.md`, with what would tell them
   apart. You don't diagnose; you help the athlete arrive at a consultation with a clear record.

## Measuring well

- **Time until it clears is measured standing or sitting still**, not walking: walking speeds
  recovery and ruins the number.
- The key metric is compared **week over week under similar load**, not session to session.
- `present: false` is only written when the athlete said it didn't happen. An unreported session
  stays with `pendingReport: true`.

## Reading it

- Metric improving while load rises → adaptation; the plan is working.
- Metric stuck while fitness improves → something the plan won't fix; the consultation becomes a
  priority, with the log in hand.
- Metric worsening → repeat the week (`repeatWeekIfSymptomEarlier`); two in a row → stop
  progressing and consult.

## Example

```jsonc
{
  "id": "knee",
  "label": "Rodilla",
  "keyMetric": {
    "field": "onsetMin", "unit": "min", "label": "Minuto de aparición",
    "goodDirection": "up", "baseline": { "value": 20, "label": "punto de partida (20 min)" }
  },
  "chart": {
    "title": "Dolor de rodilla: cuándo aparece",
    "subtitle": "Si aparece cada vez más tarde con más carga, es adaptación. Si queda fija, hay que consultar."
  },
  "fields": [
    { "id": "onsetMin", "label": "Aparece", "type": "number", "prompt": "¿Apareció el dolor de rodilla? ¿A qué minuto?" },
    { "id": "side", "label": "Lado", "type": "enum", "options": ["Derecha", "Izquierda", "Ambas"] },
    { "id": "severity", "label": "Intensidad", "type": "scale", "min": 0, "max": 10 },
    { "id": "nextDay", "label": "Al día siguiente", "type": "scale", "min": 0, "max": 10,
      "prompt": "¿Cuánto molestaba al levantarte hoy?" }
  ],
  "trafficLight": {
    "green": "Molestia leve que se va al bajar el ritmo, nada al día siguiente. Seguí.",
    "yellow": "Aparece antes que la semana pasada o queda al día siguiente. Repetí la semana.",
    "red": "Cambia tu forma de correr, duele en reposo o hay hinchazón. Pará y consultá."
  },
  "redFlags": ["Dolor que cambia la pisada", "Dolor en reposo o de noche", "Hinchazón"]
}
```
