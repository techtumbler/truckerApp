// Simple Timer State in localStorage + helpers
const LS_KEY = 'trucker.timer.v1';

export function loadTimer() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || defaultState(); }
  catch { return defaultState(); }
}
export function saveTimer(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
export function defaultState() {
  return {
    mode: 'idle',              // 'idle' | 'driving' | 'break'
    startedAt: null,           // ISO string
    elapsedMs: 0,              // computed live
    history: [],               // [{mode,start,end,durationMs}]
    // Richtwerte (kein Rechtsersatz)
    drivingLimitMs: 4.5 * 60 * 60 * 1000, // 4h30
    breakMinMs: 45 * 60 * 1000,           // 45m
    warn15: true,
    warn5: true
  };
}

export function formatHMS(ms) {
  const sec = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(sec/3600).toString().padStart(2,'0');
  const m = Math.floor((sec%3600)/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${h}:${m}:${s}`;
}

export function clamp01(x){ return Math.max(0, Math.min(1, x)); }

export function computeElapsed(startedAt){
  return startedAt ? Math.max(0, Date.now() - new Date(startedAt).getTime()) : 0;
}

/** Liefert Status + Level für dynamisches UI */
export function status(st){
  if(st.mode === 'driving'){
    const elapsed = st.elapsedMs;
    const left = st.drivingLimitMs - elapsed;
    let level = 'ok';
    if (left <= 5*60*1000) level = 'critical';
    else if (left <= 15*60*1000) level = 'warn';
    return {
      kind: 'driving',
      level, elapsed, left,
      targetMs: st.drivingLimitMs,
      pct: clamp01(elapsed / st.drivingLimitMs)
    };
  }
  if(st.mode === 'break'){
    const elapsed = st.elapsedMs;
    const done = elapsed >= st.breakMinMs;
    return {
      kind: 'break',
      level: done ? 'ok' : 'warn',
      elapsed,
      left: Math.max(0, st.breakMinMs - elapsed),
      targetMs: st.breakMinMs,
      pct: clamp01(elapsed / st.breakMinMs),
      done
    };
  }
  return { kind: 'idle', level: 'ok' };
}
