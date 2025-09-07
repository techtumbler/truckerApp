export function periodIdFrom(date=new Date()){
  const y = date.getFullYear(), m = (date.getMonth()+1).toString().padStart(2,'0')
  return `${y}-${m}`
}
export function nextMonth(date=new Date()){
  const d = new Date(date); d.setMonth(d.getMonth()+1); return d
}
export function dueDateFor(periodId){
  const [y,m] = periodId.split('-').map(Number)
  const next = new Date(y, m, 0) // letzter Tag Monat `m`
  // Fälligkeit: 20. des Folgemonats (vereinfachte Regel)
  const d = new Date(y, m, 20)
  return d.toISOString()
}
