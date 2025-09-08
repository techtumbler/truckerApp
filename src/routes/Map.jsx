import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { addPOI, listPOIs, removePOI, humanPOI } from '../lib/pois'

// Leaflet Default Icon fix (Vite)
const DefaultIcon = L.icon({
  iconUrl, iconRetinaUrl, shadowUrl,
  iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowSize:[41,41]
})
L.Marker.prototype.options.icon = DefaultIcon

export default function Map(){
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const [status, setStatus] = useState('initial')  // initial | ready | locating | error
  const [loc, setLoc] = useState(null)            // {lat, lon}
  const [pois, setPois] = useState([])
  const [showPanel, setShowPanel] = useState(() => {
    // Phones: Panel zu, Tablet/Desktop: Panel auf
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 600px)').matches
    }
    return true
  })

  // Map init
  useEffect(()=>{
    if(leafletRef.current) return
    leafletRef.current = L.map(mapRef.current, { zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(leafletRef.current)
    setStatus('ready')
    locate()
    leafletRef.current.on('click', async (e)=>{
      const { lat, lng } = e.latlng
      await quickAddAt(lat, lng)
    })
    refreshPOIs()

    // Reagiere auf Resize: Panel automatisch öffnen/schließen bei BP-Wechsel
    const mq = window.matchMedia('(min-width: 600px)')
    const onChange = () => setShowPanel(mq.matches)
    mq.addEventListener?.('change', onChange)
    return ()=> mq.removeEventListener?.('change', onChange)
  }, [])

  async function locate(){
    try{
      setStatus('locating')
      const pos = await new Promise((resolve, reject)=>{
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      })
      const lat = pos.coords.latitude
      const lon = pos.coords.longitude
      setLoc({ lat, lon })
      const m = leafletRef.current
      m.setView([lat, lon], 14)
      L.circleMarker([lat, lon], { radius: 6 }).addTo(m).bindTooltip('Dein Standort')
    }catch(err){
      console.warn('Geoloc failed', err)
      setStatus('error')
    }finally{
      if(status!=='ready') setStatus('ready')
    }
  }

  async function refreshPOIs(){
    const data = await listPOIs()
    setPois(data)
    const m = leafletRef.current
    if(!m) return
    // existierende POI-Layer (unsere) entfernen
    m.eachLayer(layer=>{
      if(layer._poi) m.removeLayer(layer)
    })
    data.forEach(p=>{
      const mk = L.marker([p.lat, p.lon]).addTo(m)
      mk._poi = true
      mk.bindPopup(`
        <div style="min-width:200px">
          <strong>${escapeHtml(p.name||'LKW-Parkplatz')}</strong><br/>
          <small>${humanPOI(p)}</small><br/>
          <small>${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}</small>
        </div>
      `)
    })
  }

  async function quickAddAt(lat, lon){
    try{
      const name = window.prompt('Name für Parkplatz/POI:', 'LKW-Parkplatz')
      if(name===null) return
      const kosten = window.prompt('Kosten (leer/kostenlos/bezahlt):', '')
      const wc = window.confirm('WC vorhanden? OK = Ja / Abbrechen = Nein')
      const dusche = window.confirm('Dusche vorhanden? OK = Ja / Abbrechen = Nein')

      // Sofort Marker
      const mk = L.marker([lat, lon]).addTo(leafletRef.current)
      mk._poi = true
      mk.bindPopup(`<div style="min-width:200px"><strong>${escapeHtml(name||'LKW-Parkplatz')}</strong><br/><small>${escapeHtml(kosten||'')}</small><br/><small>${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}</small></div>`)

      await addPOI({ name, lat, lon, kosten: kosten||null, wc, dusche })
      toast('✅ Parkplatz gespeichert')
      refreshPOIs()
      if (!showPanel) setShowPanel(true) // Panel auf, damit der Nutzer den Eintrag sieht
    }catch(err){
      console.error('POI speichern fehlgeschlagen', err)
      toast('❌ Konnte Parkplatz nicht speichern (siehe Konsole)')
    }
  }

  function toast(msg){
    const el = document.createElement('div')
    el.textContent = msg
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:20px;background:#19c37d;color:#0b0f1a;padding:10px 14px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.3);z-index:9999;font-weight:700'
    document.body.appendChild(el)
    setTimeout(()=> el.remove(), 2500)
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c])) }

  return (
    <section className="card">
      <h1>Parkplätze</h1>
      <p style={{color:'var(--muted)'}}>Smartphone: Panel kann ein-/ausgeklappt werden. Tippe in die Karte, um schnell einen POI anzulegen.</p>

      {/* Toggle nur auf Phones sichtbar (via CSS), sonst egal */}
      <div className="panel-toggle">
        <button className="btn" onClick={()=>setShowPanel(s=>!s)}>
          {showPanel ? '⬇️ Panel einklappen' : '⬆️ Panel anzeigen'}
        </button>
      </div>

      <div className="map-layout">
        <div className="map-view">
          <div ref={mapRef} className="leaflet-container-custom" />
        </div>

        {/* Panel – auf Phone via Toggle ein-/ausblendbar */}
        <aside className={`map-panel ${showPanel ? '' : 'hidden'}`}>
          <div className="btn-row">
            <button className="btn" onClick={locate}>📍 Standort</button>
            <button className="btn" onClick={refreshPOIs}>🔄 Aktualisieren</button>
          </div>

          <h2 style={{marginTop:10}}>Gespeicherte Parkplätze</h2>
          <ul className="poi-list">
            {pois.map(p=>(
              <li key={p.id}>
                <div className="poi-head">
                  <strong>{p.name||'LKW-Parkplatz'}</strong>
                  <button className="btn" onClick={async()=>{ await removePOI(p.id); refreshPOIs() }}>🗑️</button>
                </div>
                <div className="poi-meta">{humanPOI(p)}</div>
                <div className="poi-geo">{Number(p.lat).toFixed(5)}, {Number(p.lon).toFixed(5)}</div>
              </li>
            ))}
            {pois.length===0 && <li><em>Noch keine Einträge.</em></li>}
          </ul>
        </aside>
      </div>
    </section>
  )
}
