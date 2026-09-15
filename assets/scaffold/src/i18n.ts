/**
 * Every string the dashboard shows. Code, keys and data are English; what the athlete
 * reads is in their language (`config.locale.lang`). Prose that belongs to one athlete —
 * plan notes, tracked-issue texts, feedback — lives in their JSON, not here.
 */

const es = {
  htmlLang: "es",
  roadTo: "Camino a la",
  goal: "Objetivo",
  day: (n: number): string => (n === 1 ? "día" : "días"),
  week: "Semana",
  weekShort: (n: number) => `S${n}`,
  of: "de",
  phase: "Fase",
  nextSession: "Próxima sesión",
  tabs: { progress: "Progreso", calendar: "Calendario", runs: "Corridas", context: "Contexto", notes: "Notas" },
  footer: (slug: string) => ["Los datos se editan en", `athletes/${slug}/`, "y se publican con un commit."],
  units: { km: "km", spm: "ppm", bpm: "lpm", h: "h", kg: "kg" },

  // progress
  planProgress: "Progreso del plan",
  sessions: "sesiones",
  kmRun: "km corridos",
  ofPlanned: (km: number) => `de ${km} planificados`,
  ofTotalVolume: "del volumen total",
  moving: "en movimiento",
  weeklyVolume: "Volumen semanal",
  weeklyVolumeSub: "Planificado vs real. Las semanas de descarga están marcadas.",
  plan: "Plan",
  actual: "Real",
  weeks: "Semanas",
  cols: { wk: "Sem", from: "Desde", phase: "Fase", kmPlan: "Km plan", kmActual: "Km real", sessions: "Sesiones", cadence: "Cadencia" },
  deload: "descarga",

  // tracked
  trackedEmpty: (field: string) => [
    "Todavía no hay ninguna sesión con este dato registrado. Se completa en",
    `tracked.${field}`,
  ],
  trackedLog: "Registro de síntomas",
  trackedNone: "Sin síntomas registrados.",
  trafficLight: "Semáforo",
  lights: { green: "VERDE", yellow: "AMARILLO", red: "ROJO" },
  date: "Fecha",

  // runs
  cadence: "Cadencia",
  cadenceSub: (b: number, t: number, r?: number) =>
    `Base ${b} · objetivo ${t}` + (r ? ` · referencia final ${r}` : ""),
  target: "objetivo",
  heartRate: "Frecuencia cardíaca",
  hrSub: (zone: number, lo: number, hi: number, lthr: number, cap?: number) =>
    `Zona ${zone} = ${lo}-${hi} · LTHR estimada ${lthr}.` +
    (cap ? ` En los días fáciles el pico no debería pasar de ${cap}.` : ""),
  zoneCeiling: (zone: number) => `techo Zona ${zone}`,
  avgHr: "FC media",
  maxHr: "FC máxima",
  allRuns: "Todas las corridas",
  runCols: { km: "Km", min: "Min", pace: "Ritmo", avgHr: "FC med", maxHr: "FC máx", cad: "Cad", shoes: "Zapas", rpe: "RPE" },
  seeMore: "Ver más",

  // context
  sleep: "Sueño",
  sleepSub: "El remodelado de hueso y tendón ocurre mientras dormís. Es el tejido que estamos tratando de adaptar.",
  mean: "media",
  targetH: (h: number) => `objetivo ${h} h`,
  nightsUnder: (h: number) => `noches bajo ${h} h`,
  restingHrMean: "FC reposo media",
  hours: "Horas",
  weight: "Peso",
  weightSub: "Cada pisada al correr genera entre 2,5 y 3 veces el peso corporal.",
  restingHr: "FC en reposo",
  restingHrSub: "Baja a medida que mejora la base aeróbica. Si sube varios días seguidos, suele indicar fatiga o algo incubándose.",
  restingHrShort: "FC reposo",

  // calendar
  calendarSub: (w: number, s: number) =>
    `${w} semanas, ${s} sesiones. Tocá cualquier día para ver el detalle completo del entrenamiento.`,
  openAll: "Abrir todas",
  closeAll: "Cerrar todas",
  currentWeek: "Semana actual",
  rest: "Descanso",
  watchWorkout: "Workout del reloj",
  whatYouDid: "Lo que hiciste",
  hr: "FC",
  techNotes: "Notas técnicas",
  alsoThatDay: "También ese día",
  walk: "Caminata",
  run: "Corrida",
  close: "Cerrar",
  whatMatters: "Lo que importa",
  whereYouAre: "Dónde estás parado",
  next: { good: "Vamos bien", tight: "Vamos justo", bad: "Vamos mal" },
  workoutTypes: {
    endurance: "Suave", long: "Larga", recovery: "Recuperación", threshold: "Umbral",
    vo2max: "VO2max", "race-pace": "Ritmo meta", test: "Test", race: "Carrera",
    strength: "Fuerza", rest: "Descanso",
  } as Record<string, string>,

  // notes
  zones: "Zonas",
  zoneCols: { zone: "Zona", pace: "Ritmo", hr: "Pulso", feel: "Sensación" },

  // picker
  pickAthlete: "Elegí de quién es el plan",
  theme: { label: "Tema", system: "Automático", light: "Claro", dark: "Oscuro" },
};

export type Strings = typeof es;

const en: Strings = {
  htmlLang: "en",
  roadTo: "Road to",
  goal: "Goal",
  day: (n) => (n === 1 ? "day" : "days"),
  week: "Week",
  weekShort: (n) => `W${n}`,
  of: "of",
  phase: "Phase",
  nextSession: "Next session",
  tabs: { progress: "Progress", calendar: "Calendar", runs: "Runs", context: "Context", notes: "Notes" },
  footer: (slug) => ["Data is edited in", `athletes/${slug}/`, "and published with a commit."],
  units: { km: "km", spm: "spm", bpm: "bpm", h: "h", kg: "kg" },

  planProgress: "Plan progress",
  sessions: "sessions",
  kmRun: "km run",
  ofPlanned: (km) => `of ${km} planned`,
  ofTotalVolume: "of total volume",
  moving: "moving",
  weeklyVolume: "Weekly volume",
  weeklyVolumeSub: "Planned vs actual. Deload weeks are marked.",
  plan: "Plan",
  actual: "Actual",
  weeks: "Weeks",
  cols: { wk: "Wk", from: "From", phase: "Phase", kmPlan: "Km plan", kmActual: "Km actual", sessions: "Sessions", cadence: "Cadence" },
  deload: "deload",

  trackedEmpty: (field) => ["No session has this recorded yet. It is filled in", `tracked.${field}`],
  trackedLog: "Symptom log",
  trackedNone: "No symptoms recorded.",
  trafficLight: "Traffic light",
  lights: { green: "GREEN", yellow: "YELLOW", red: "RED" },
  date: "Date",

  cadence: "Cadence",
  cadenceSub: (b, t, r) => `Base ${b} · target ${t}` + (r ? ` · final reference ${r}` : ""),
  target: "target",
  heartRate: "Heart rate",
  hrSub: (zone, lo, hi, lthr, cap) =>
    `Zone ${zone} = ${lo}-${hi} · estimated LTHR ${lthr}.` +
    (cap ? ` On easy days the peak should stay under ${cap}.` : ""),
  zoneCeiling: (zone) => `Zone ${zone} ceiling`,
  avgHr: "Avg HR",
  maxHr: "Max HR",
  allRuns: "All runs",
  runCols: { km: "Km", min: "Min", pace: "Pace", avgHr: "Avg HR", maxHr: "Max HR", cad: "Cad", shoes: "Shoes", rpe: "RPE" },
  seeMore: "More",

  sleep: "Sleep",
  sleepSub: "Bone and tendon remodeling happens while you sleep.",
  mean: "average",
  targetH: (h) => `target ${h} h`,
  nightsUnder: (h) => `nights under ${h} h`,
  restingHrMean: "Avg resting HR",
  hours: "Hours",
  weight: "Weight",
  weightSub: "Each running stride loads 2.5 to 3 times body weight.",
  restingHr: "Resting HR",
  restingHrSub: "Drops as the aerobic base improves. Rising several days in a row usually means fatigue or something brewing.",
  restingHrShort: "Resting HR",

  calendarSub: (w, s) => `${w} weeks, ${s} sessions. Tap any day for the full workout.`,
  openAll: "Open all",
  closeAll: "Close all",
  currentWeek: "This week",
  rest: "Rest",
  watchWorkout: "Watch workout",
  whatYouDid: "What you did",
  hr: "HR",
  techNotes: "Technical notes",
  alsoThatDay: "Also that day",
  walk: "Walk",
  run: "Run",
  close: "Close",
  whatMatters: "What matters",
  whereYouAre: "Where you stand",
  next: { good: "On track", tight: "Tight", bad: "Off track" },
  workoutTypes: {
    endurance: "Easy", long: "Long", recovery: "Recovery", threshold: "Threshold",
    vo2max: "VO2max", "race-pace": "Race pace", test: "Test", race: "Race",
    strength: "Strength", rest: "Rest",
  },

  zones: "Zones",
  zoneCols: { zone: "Zone", pace: "Pace", hr: "HR", feel: "Feel" },

  pickAthlete: "Whose plan?",
  theme: { label: "Theme", system: "Auto", light: "Light", dark: "Dark" },
};

const DICTS: Record<string, Strings> = { es, en };

/** The dashboard speaks Spanish or English: "es-UY" → es, "en-GB" → en, anything else → en. */
export function stringsFor(lang: string | undefined): Strings {
  return DICTS[(lang ?? "en").slice(0, 2).toLowerCase()] ?? en;
}
