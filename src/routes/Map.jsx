// src/routes/Map.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { addPOI, listPOIs, removePOI, humanPOI } from '../lib/pois.js'

const FALLBACK_CENTER = [50.1109, 8.6821] // Frankfurt
const FALLBACK_ZOOM = 6

export default function MapRoute() {
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const resizeTimer = useRef(null)
  const locationMarkerRef = useRef(null)

  const [pois, setPOIs] = useState([])
  const [showPanel, setShowPanel] = useState(true)

  useEffect(()=>{
    if (leafletRef.current) return
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true })
    leafletRef.current = map

    map.setView(FALLBACK_CENTER, FALLBACK_ZOOM)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map)

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && navigator.geolocation?.getCurrentPosition) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          map.setView([latitude, longitude], 12)
          replaceLocationMarker([latitude, longitude])
        },
        () => {/* stiller Fallback */}
      )
    }

    map.on('click', async (e)=>{
      const { lat, lng } = e.latlng
      await quickAddAt(Number(lat), Number(lng))
    })

    refreshPOIs()

    const onWinResize = () => {
      clearTimeout(resizeTimer.current)
      resizeTimer.current = setTimeout(() => map.invalidateSize(), 120)
    }
    window.addEventListener('resize', onWinResize)

    return () => {
      window.removeEventListener('resize', onWinResize)
      try { map.remove() } catch {}
      leafletRef.current = null
    }
  }, [])

  useEffect(()=>{
    const map = leafletRef.current
    if (!map) return
    const t = setTimeout(()=> map.invalidateSize(), 150)
    return ()=> clearTimeout(t)
  }, [showPanel])

  async function refreshPOIs() {
    const list = await listPOIs()
    setPOIs(list)
    drawPOIs(list)
  }

  function drawPOIs(list) {
    const map = leafletRef.current
    if (!map) return
    map.eachLayer((layer) => {
      if (layer && layer._poi) {
        try { map.removeLayer(layer) } catch {}
      }
    })

    list.forEach(p => {
      const mk = L.marker([Number(p.lat), Number(p.lon)]).addTo(map)
      mk._poi = true
      mk.bindPopup(`
        <div style="min-width:220px">
          <strong>${escapeHtml(p.name || 'POI')}</strong>
          <div style="margin:.25rem 0 .5rem 0;color:#9aa">${escapeHtml(humanPOI(p))}</div>
          <div style="font-size:.9em;color:#9aa">${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}</div>
          <div style="margin-top:.5rem;display:flex;gap:.5rem">
            <button data-action="del" data-id="${p.id}" className="btn btn-mini btn-crit">Löschen</button>
          </div>
        </div>
      `)
      mk.on('popupopen', () => {
        const btn = document.querySelector('button[data-action="del"][data-id="'+p.id+'"]')
        if (btn) {
          btn.addEventListener('click', async () => {
            if (!confirm('POI löschen?')) return
            await removePOI(p.id)
            await refreshPOIs()
          }, { once: true })
        }
      })
    })
  }

  function replaceLocationMarker(latlng) {
    const map = leafletRef.current
    if (!map) return
    if (locationMarkerRef.current) {
      try { map.removeLayer(locationMarkerRef.current) } catch {}
      locationMarkerRef.current = null
    }
    const mk = L.circleMarker(latlng, { radius: 6, color: '#2ecc71', fillColor: '#2ecc71', fillOpacity: 0.9 })
    mk.addTo(map)
    locationMarkerRef.current = mk
  }

  async function quickAddAt(lat, lon) {
    try {
      const name = window.prompt('Name für Parkplatz/POI:', 'LKW-Parkplatz')
      if (name === null) return
      const kosten = window.prompt('Kosten (leer/kostenlos/bezahlt):', '')
      const wc = window.confirm('WC vorhanden? OK = Ja / Abbrechen = Nein')
      const dusche = window.confirm('Dusche vorhanden? OK = Ja / Abbrechen = Nein')

      const mk = L.marker([lat, lon]).addTo(leafletRef.current)
      mk._poi = true
      mk.bindPopup(`<div style="min-width:200px"><strong>${escapeHtml(name)}</strong><br/><small>${escapeHtml(kosten||'')}</small><br/><small>${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}</small></div>`)

      await addPOI({ name, lat, lon, kosten: kosten||null, wc, dusche })
      refreshPOIs()
      if (!showPanel) setShowPanel(true)
    } catch (err) {
      console.error('POI speichern fehlgeschlagen', err)
      const msg = String(err?.message || '')
      if (/indexeddb|not allowed|invalidstate/i.test(msg)) {
        alert('Speichern fehlgeschlagen.\nHinweis: In Safari im privaten Fenster (oder bei deaktivierter Speicherung) ist IndexedDB nicht verfügbar. Bitte in einem normalen Fenster öffnen.')
      } else {
        alert('Speichern fehlgeschlagen: ' + msg)
      }
    }
  }

  const inlineHeight = useMemo(()=> 'min(70vh, calc(100dvh - 200px))', [])

  return (
    <div className="map-page">
      <header className="map-header">
        <button className="btn outline sm show-mobile" onClick={()=>setShowPanel(s=>!s)} aria-expanded={showPanel}>☰ Liste</button>
        <div className="spacer" />
        <small style={{opacity:.7}}>HTTP-Modus: Geolocation evtl. deaktiviert – Fallback-Center aktiv.</small>
      </header>

      <div className="map-layout" style={{ display:'grid', gridTemplateColumns: showPanel ? 'minmax(220px, 340px) 1fr' : '0 1fr', gap: '1rem' }}>
        <aside className={`map-panel ${showPanel?'open':''}`} style={{ overflow:'auto' }}>
          <h3 className="mt0">POIs</h3>
          <ul className="poi-list">
            {pois.map(p => (
              <li key={p.id} className="poi-item">
                <div className="poi-name">{p.name || 'POI'}</div>
                <div className="poi-sub">{humanPOI(p)}</div>
                <div className="poi-geo">{Number(p.lat).toFixed(5)}, {Number(p.lon).toFixed(5)}</div>
                <div className="poi-actions">
                  <button className="btn sm" onClick={async ()=>{
                    if (!confirm('POI löschen?')) return
                    await removePOI(p.id)
                    await refreshPOIs()
                  }}>Löschen</button>
                </div>
              </li>
            ))}
            {pois.length===0 && <li><em>Noch keine Einträge.</em></li>}
          </ul>
        </aside>

        <div
          ref={mapRef}
          className="map"
          style={{ width:'100%', height: inlineHeight, borderRadius: '12px', overflow:'hidden', border:'1px solid #2a2f45' }}
        />
      </div>
    </div>
  )
}

function escapeHtml(s='') {
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;')
}
