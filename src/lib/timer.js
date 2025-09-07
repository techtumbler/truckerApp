// Simple Timer State in localStorage + in-memory ticker
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
    // driving or break
    mode: 'idle',             // 'idle' | 'driving' | 'break'
    startedAt: null,          // ISO string
    elapsedMs: 0,             // accumulated time of current mode
    history: [],              // [{mode:'driving'|'break', start, end, durationMs}]
    // thresholds (safe defaults; keine Rechtsberatung)
    drivingLimitMs: 4.5 * 60 * 60 * 1000,  // 4.5 h
    breakMinMs: 45 * 60 * 1000,           // 45 min
    warn15: true,
    warn5: true
  };
}
export function formatHMS(ms) {
  const sec = Math.floor(ms/1000);
  const h = Math.floor(sec/3600).toString().padStart(2,'0');
  const m = Math.floor((sec%3600)/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${h}:${m}:${s}`;
}
