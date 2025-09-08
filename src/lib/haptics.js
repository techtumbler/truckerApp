// Einfacher Haptik-Wrapper (fällt geräuschlos zurück, wenn nicht verfügbar)
export function vibrate(ms = 30) {
  try { navigator.vibrate?.(ms) } catch {}
}
export function vibratePattern(pattern = [18, 30, 18]) {
  try { navigator.vibrate?.(pattern) } catch {}
}
