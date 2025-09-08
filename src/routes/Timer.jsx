import React, { useEffect, useRef, useState, useMemo } from 'react'
import { loadTimer, saveTimer, defaultState, formatHMS, computeElapsed, status } from '../lib/timer'
import { vibrate, vibratePattern } from '../lib/haptics'

export default function Timer(){
  const [st, setSt] = useState(loadTimer())
  const [filter, setFilter] = useState('all') // 'all' | 'today' | '24h' | '7d'
  const tickRef = useRef(null)
  const lastWarnRef = useRef({ m15:false, m5:false })
  const liveRef = useRef(null) // aria-live

  // Persist
  useEffect(()=>{ saveTimer(st) }, [st])

  // 1s-Ticker
  useEffect(()=>{
    clearInterval(tickRef.current)
    tickRef.current = setInterval(()=>{
      setSt(s => (s.mode==='driving' || s.mode==='break')
        ? { ...s, elapsedMs: computeElapsed(s.startedAt) }
        : s)
    }, 1000)
    return ()=> clearInterval(tickRef.current)
  }, [])

  // Warnungen (Foreground + Haptik)
  useEffect(()=>{
    const stat = status(st)
    if (stat.kind === 'driving') {
      if (st.warn15 && stat.left <= 15*60*1000 && !lastWarnRef.current.m15) {
        lastWarnRef.current.m15 = true; notify('⚠️ Noch ~15 Min bis empfohlener Pause'); vibrate(40)
      }
      if (st.warn5 && stat.left <= 5*60*1000 && !lastWarnRef.current.m5) {
        lastWarnRef.current.m5 = true; notify('⏰ Noch ~5 Min bis empfohlener Pause'); vibratePattern([30, 60, 30])
      }
    }
  }, [st])

  // Tastatur-Shortcuts: D/P/S
  useEffect(()=>{
    const onKey = (e)=>{
      if (e.target && /input|textarea|select/.test(e.target.tagName.toLowerCase())) return
      if (e.key.toLowerCase() === 'd') { e.preventDefault(); s.kind==='break' ? switchTo('driving') : startDriving() }
      if (e.key.toLowerCase() === 'p') { e.preventDefault(); s.kind==='driving' ? switchTo('break') : startBreak() }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); stopCurrent() }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  })

  function notify(msg){
    // visuelles Toast
    const el = document.createElement('div')
    el.textContent = msg
    el.className = 'toast'
    document.body.appendChild(el)
    // aria-live
    if (liveRef.current) liveRef.current.textContent = msg
    setTimeout(()=> el.remove(), 3200)
  }

  // Aktionen
  function startDriving(){
    if(st.mode === 'driving') return
    vibrate(20)
    lastWarnRef.current = { m15:false, m5:false }
    setSt(s => ({ ...s, mode:'driving', startedAt:new Date().toISOString(), elapsedMs:0 }))
  }
  function startBreak(){
    if(st.mode === 'break') return
    vibrate(20)
    setSt(s => ({ ...s, mode:'break', startedAt:new Date().toISOString(), elapsedMs:0 }))
  }
  function closeCurrentToHistory(nextMode='idle'){
    if(st.mode === 'idle') return
    const end = new Date()
    const dur = Math.max(0, end - new Date(st.startedAt))
    setSt(s => ({
      ...s,
      history: [{ mode:s.mode, start:s.startedAt, end:end.toISOString(), durationMs:dur }, ...s.history].slice(0,50),
      mode: nextMode==='idle' ? 'idle' : nextMode,
      startedAt: nextMode==='idle' ? null : new Date().toISOString(),
      elapsedMs: 0
    }))
  }
  function switchTo(newMode){
    vibrate(15)
    if(st.mode==='idle'){ newMode==='driving' ? startDriving() : startBreak(); return }
    closeCurrentToHistory(newMode)
    if(newMode==='driving'){ lastWarnRef.current = { m15:false, m5:false } }
  }
  function stopCurrent(){ vibrate(10); closeCurrentToHistory('idle') }
  function resetAll(){
    if(!confirm('Timer wirklich zurücksetzen?')) return
    vibrate(10)
    setSt(defaultState())
  }

  // Filter (Log)
  function inFilter(entry, kind){
    const end = new Date(entry.end)
    const now = new Date()
    if(kind === 'today'){
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0)
      return end >= startOfDay
    }
    if(kind === '24h'){ return (now - end) <= 24*60*60*1000 }
    if(kind === '7d'){ return (now - end) <= 7*24*60*60*1000 }
    return true
  }
  const filteredHistory = useMemo(()=> (st.history || []).filter(h => inFilter(h, filter)), [st.history, filter])

  const s = status(st)
  const barClass = lvl => `progress ${lvl}`
  const primaryClass = lvl => `btn dynamic ${lvl}`

  let primaryAction = null
  if (s.kind === 'idle') {
    primaryAction = (
      <div className="btn-row">
        <button className="btn primary" onClick={()=>startDriving()} aria-label="Fahrt starten (Taste D)">▶️ Fahrt starten</button>
        <button className="btn" onClick={()=>startBreak()} aria-label="Pause starten (Taste P)">☕ Pause starten</button>
      </div>
    )
  } else if (s.kind === 'driving') {
    primaryAction = (
      <div className="btn-row">
        <button className={primaryClass(s.level)} onClick={()=>switchTo('break')} aria-label="Jetzt Pause (Taste P)">☕ Pause jetzt</button>
        <button className="btn" onClick={stopCurrent} aria-label="Stopp (Taste S)">⏹️ Stopp</button>
      </div>
    )
  } else if (s.kind === 'break') {
    primaryAction = (
      <div className="btn-row">
        <button className={primaryClass(s.level === 'ok' ? 'ok' : 'warn')} onClick={()=>switchTo('driving')} aria-label="Weiterfahren (Taste D)">▶️ Weiterfahren</button>
        <button className="btn" onClick={stopCurrent} aria-label="Stopp (Taste S)">⏹️ Stopp</button>
      </div>
    )
  }

  const fmtDT = (iso)=> new Date(iso).toLocaleString()
  const modeBadge = (m)=> <span className={`chip ${m==='driving'?'chip-drive':'chip-break'}`}>{m==='driving'?'FAHRT':'PAUSE'}</span>

  return (
    <section className="card">
      {/* aria-live Region für Screenreader + ruhige Anzeige */}
      <div aria-live="polite" aria-atomic="true" className="sr-live" ref={liveRef} />

      <h1>Pausen-Timer</h1>
      <p style={{color:'var(--muted)'}}>Tasten: <kbd>D</kbd> fahren • <kbd>P</kbd> Pause • <kbd>S</kbd> Stopp</p>

      {/* Fahr- und Pausenblock */}
      <div className="card grid-2">
        <div>
          <h2>Fahrt</h2>
          <div className={`badge ${s.kind==='driving' ? s.level : 'muted'}`}>
            {s.kind==='driving' ? (s.level==='critical' ? 'Kritisch' : s.level==='warn' ? 'Bald Pause' : 'OK') : 'Bereit'}
          </div>
          <div className="time">{formatHMS(st.mode==='driving' ? st.elapsedMs : 0)}</div>
          <div className="meta">
            Rest bis Empfehlung: <strong>{s.kind==='driving' ? formatHMS(s.left) : formatHMS(st.drivingLimitMs)}</strong>
          </div>
          <div className={barClass(s.kind==='driving'?s.level:'ok')}>
            <span style={{width: `${(s.kind==='driving'? s.pct : 0)*100}%`}} />
          </div>
        </div>

        <div>
          <h2>Pause</h2>
          <div className={`badge ${s.kind==='break' ? (s.done ? 'ok' : 'warn') : 'muted'}`}>
            {s.kind==='break' ? (s.done ? 'OK' : 'Noch') : 'Bereit'}
          </div>
          <div className="time">{formatHMS(st.mode==='break' ? st.elapsedMs : 0)}</div>
          <div className="meta">
            Ziel: <strong>00:45:00</strong>{s.kind==='break' && !s.done ? <> • Rest: <strong>{formatHMS(s.left)}</strong></> : null}
          </div>
          <div className={barClass(s.kind==='break'?(s.done?'ok':'warn'):'ok')}>
            <span style={{width: `${(s.kind==='break'? s.pct : 0)*100}%`}} />
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div className="card">
        <h2>Aktionen</h2>
        {primaryAction}
        <div className="btn-row">
          <button className="btn" onClick={resetAll}>♻️ Zurücksetzen</button>
        </div>
      </div>

      {/* Protokoll / Fahrten-Log mit Filter */}
      <div className="card">
        <div className="log-head">
          <h2>Protokoll</h2>
          <div className="log-filters" role="tablist" aria-label="Protokoll filtern">
            <button className={`btn ${filter==='all'?'primary':''}`} onClick={()=>setFilter('all')} role="tab" aria-selected={filter==='all'}>Alle</button>
            <button className={`btn ${filter==='today'?'primary':''}`} onClick={()=>setFilter('today')} role="tab" aria-selected={filter==='today'}>Heute</button>
            <button className={`btn ${filter==='24h'?'primary':''}`} onClick={()=>setFilter('24h')} role="tab" aria-selected={filter==='24h'}>24 h</button>
            <button className={`btn ${filter==='7d'?'primary':''}`} onClick={()=>setFilter('7d')} role="tab" aria-selected={filter==='7d'}>7 Tage</button>
          </div>
        </div>

        <div className="table">
          <div className="table-head">
            <div>Modus</div>
            <div>Start</div>
            <div>Ende</div>
            <div>Dauer</div>
          </div>

          {filteredHistory.length === 0 && (
            <div className="table-empty">Keine Einträge im gewählten Zeitraum.</div>
          )}

          {filteredHistory.map((h,i)=>(
            <div className="table-row" key={i}>
              <div className="col-mode">{modeBadge(h.mode)}</div>
              <div className="col-dt">{new Date(h.start).toLocaleString()}</div>
              <div className="col-dt">{new Date(h.end).toLocaleString()}</div>
              <div className="col-dur"><code>{formatHMS(h.durationMs)}</code></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
