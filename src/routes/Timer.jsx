import React, { useEffect, useRef, useState } from 'react'
import { loadTimer, saveTimer, defaultState, formatHMS } from '../lib/timer'

export default function Timer(){
  const [st, setSt] = useState(loadTimer())
  const tickRef = useRef(null)
  const lastWarnRef = useRef({ m15:false, m5:false })

  // persist on every state change
  useEffect(()=>{ saveTimer(st) }, [st])

  // ticker
  useEffect(()=>{
    clearInterval(tickRef.current)
    tickRef.current = setInterval(()=>{
      setSt(s => {
        if(s.mode === 'driving' || s.mode === 'break'){
          const base = s.startedAt ? Date.now() - new Date(s.startedAt).getTime() : 0
          const elapsed = base
          // warn logic (foreground banners)
          if(s.mode === 'driving') {
            const left = s.drivingLimitMs - elapsed
            if (left <= 15*60*1000 && !lastWarnRef.current.m15) {
              lastWarnRef.current.m15 = true
              toast('⚠️ Noch ~15 Min bis empfohlener Pause')
            }
            if (left <= 5*60*1000 && !lastWarnRef.current.m5) {
              lastWarnRef.current.m5 = true
              toast('⏰ Noch ~5 Min bis empfohlener Pause')
            }
          }
          return { ...s, elapsedMs: elapsed }
        }
        return s
      })
    }, 1000)
    return ()=> clearInterval(tickRef.current)
  }, [])

  function toast(msg){
    // einfache In-App-Meldung
    const el = document.createElement('div')
    el.textContent = msg
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:20px;background:#ff7a00;color:#111;padding:10px 14px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.3);z-index:9999;font-weight:600'
    document.body.appendChild(el)
    setTimeout(()=> el.remove(), 3000)
  }

  function startDriving(){
    if(st.mode === 'driving') return
    lastWarnRef.current = { m15:false, m5:false }
    setSt(s => ({ ...s, mode:'driving', startedAt:new Date().toISOString(), elapsedMs:0 }))
  }
  function startBreak(){
    if(st.mode === 'break') return
    setSt(s => ({ ...s, mode:'break', startedAt:new Date().toISOString(), elapsedMs:0 }))
  }
  function stopCurrent(){
    if(st.mode === 'idle') return
    const end = new Date()
    const start = new Date(st.startedAt)
    const dur = Math.max(0, end - start)
    setSt(s => ({
      ...s,
      history: [{ mode:s.mode, start:s.startedAt, end:end.toISOString(), durationMs:dur }, ...s.history].slice(0,50),
      mode:'idle', startedAt:null, elapsedMs:0
    }))
  }
  function resetAll(){
    if(!confirm('Timer wirklich zurücksetzen?')) return
    setSt(defaultState())
  }

  const drivingElapsed = st.mode==='driving' ? st.elapsedMs : 0
  const drivingLeft = Math.max(0, st.drivingLimitMs - drivingElapsed)
  const breakElapsed = st.mode==='break' ? st.elapsedMs : 0

  return (
    <section className="card">
      <h1>Pausen-Timer</h1>
      <p style={{color:'var(--muted)'}}>Hinweis: Richtwerte (kein Rechtsersatz). 4 h 30 min Fahren ⇒ 45 min Pause.</p>

      <div className="card" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
        <div>
          <h2 style={{marginTop:0}}>Fahrt</h2>
          <div style={{fontSize:'38px',fontWeight:800}}>{formatHMS(drivingElapsed)}</div>
          <div style={{opacity:.8, margin:'6px 0'}}>Rest bis Empfehlung: <strong>{formatHMS(drivingLeft)}</strong></div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button className="btn primary" onClick={startDriving}>▶️ Start Fahrt</button>
            <button className="btn" onClick={stopCurrent} disabled={st.mode!=='driving'}>⏹️ Stopp</button>
          </div>
        </div>
        <div>
          <h2 style={{marginTop:0}}>Pause</h2>
          <div style={{fontSize:'38px',fontWeight:800}}>{formatHMS(breakElapsed)}</div>
          <div style={{opacity:.8, margin:'6px 0'}}>Empfehlung: <strong>00:45:00</strong></div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button className="btn" onClick={startBreak}>☕ Start Pause</button>
            <button className="btn" onClick={stopCurrent} disabled={st.mode!=='break'}>⏹️ Stopp</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{marginTop:0}}>Protokoll (letzte 50)</h2>
        <ul style={{margin:'8px 0', paddingLeft:'18px'}}>
          {st.history.map((h,i)=>(
            <li key={i}>
              <code>{h.mode.toUpperCase()}</code> • {new Date(h.start).toLocaleString()} → {new Date(h.end).toLocaleString()} • {formatHMS(h.durationMs)}
            </li>
          ))}
          {st.history.length===0 && <li>Kein Verlauf vorhanden.</li>}
        </ul>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <button className="btn" onClick={resetAll}>♻️ Zurücksetzen</button>
        </div>
      </div>
    </section>
  )
}
