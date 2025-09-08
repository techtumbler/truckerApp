import React, { useEffect, useRef, useState } from 'react'
import { loadTimer, saveTimer, defaultState, formatHMS, computeElapsed, status } from '../lib/timer'

export default function Timer(){
  const [st, setSt] = useState(loadTimer())
  const tickRef = useRef(null)
  const lastWarnRef = useRef({ m15:false, m5:false })

  // Persist jede Änderung
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

  // Warnungen (Foreground)
  useEffect(()=>{
    const stat = status(st)
    if (stat.kind === 'driving') {
      if (st.warn15 && stat.left <= 15*60*1000 && !lastWarnRef.current.m15) {
        lastWarnRef.current.m15 = true; toast('⚠️ Noch ~15 Min bis empfohlener Pause')
      }
      if (st.warn5 && stat.left <= 5*60*1000 && !lastWarnRef.current.m5) {
        lastWarnRef.current.m5 = true; toast('⏰ Noch ~5 Min bis empfohlener Pause')
      }
    }
  }, [st])

  function toast(msg){
    const el = document.createElement('div')
    el.textContent = msg
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:20px;background:#ff7a00;color:#111;padding:10px 14px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.3);z-index:9999;font-weight:600'
    document.body.appendChild(el)
    setTimeout(()=> el.remove(), 3200)
  }

  // Aktionen
  function startDriving(){
    if(st.mode === 'driving') return
    lastWarnRef.current = { m15:false, m5:false }
    setSt(s => ({ ...s, mode:'driving', startedAt:new Date().toISOString(), elapsedMs:0 }))
  }
  function startBreak(){
    if(st.mode === 'break') return
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
    if(st.mode==='idle'){ newMode==='driving' ? startDriving() : startBreak(); return }
    // aktuellen Block abschließen → neuen starten
    closeCurrentToHistory(newMode)
    if(newMode==='driving'){ lastWarnRef.current = { m15:false, m5:false } }
  }
  function stopCurrent(){ closeCurrentToHistory('idle') }
  function resetAll(){
    if(!confirm('Timer wirklich zurücksetzen?')) return
    setSt(defaultState())
  }

  const s = status(st)
  const barClass = lvl => `progress ${lvl}`
  const primaryClass = lvl => `btn dynamic ${lvl}`

  let primaryAction = null
  if (s.kind === 'idle') {
    primaryAction = (
      <div className="btn-row">
        <button className="btn primary" onClick={()=>startDriving()}>▶️ Fahrt starten</button>
        <button className="btn" onClick={()=>startBreak()}>☕ Pause starten</button>
      </div>
    )
  } else if (s.kind === 'driving') {
    primaryAction = (
      <div className="btn-row">
        <button className={primaryClass(s.level)} onClick={()=>switchTo('break')}>☕ Pause jetzt</button>
        <button className="btn" onClick={stopCurrent}>⏹️ Stopp</button>
      </div>
    )
  } else if (s.kind === 'break') {
    primaryAction = (
      <div className="btn-row">
        <button className={primaryClass(s.level === 'ok' ? 'ok' : 'warn')} onClick={()=>switchTo('driving')}>▶️ Weiterfahren</button>
        <button className="btn" onClick={stopCurrent}>⏹️ Stopp</button>
      </div>
    )
  }

  return (
    <section className="card">
      <h1>Pausen-Timer</h1>
      <p style={{color:'var(--muted)'}}>Hinweis: Richtwerte (kein Rechtsersatz). 4 h 30 min Fahren ⇒ 45 min Pause.</p>

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

      {/* Protokoll / Fahrten-Log */}
      <div className="card">
        <h2>Protokoll (letzte 50)</h2>
        <ul style={{margin:'8px 0', paddingLeft:'18px'}}>
          {st.history.map((h,i)=>(
            <li key={i}>
              <code>{h.mode.toUpperCase()}</code> • {new Date(h.start).toLocaleString()} → {new Date(h.end).toLocaleString()} • {formatHMS(h.durationMs)}
            </li>
          ))}
          {st.history.length===0 && <li><em>Noch kein Verlauf – Eintrag entsteht, wenn du „Stopp“ drückst oder zwischen Fahrt↔Pause wechselst.</em></li>}
        </ul>
      </div>
    </section>
  )
}
