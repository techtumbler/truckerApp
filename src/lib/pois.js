// src/lib/pois.js
// POI-APIs passend zu Map.jsx: addPOI, listPOIs, removePOI, humanPOI
import { dbp } from './db'

function uid() {
  return (globalThis.crypto?.randomUUID?.()) || (Date.now().toString(36) + Math.random().toString(36).slice(2))
}

/**
 * POI speichern
 * @param {{name?:string, lat:number, lon:number, kosten?:string|null, wc?:boolean, dusche?:boolean}} data
 */
export async function addPOI({ name = 'LKW-Parkplatz', lat, lon, kosten = null, wc = false, dusche = false }) {
  if (typeof lat !== 'number' || typeof lon !== 'number') throw new Error('addPOI: lat/lon erforderlich')
  const db = await dbp
  const poi = {
    id: uid(),
    name,
    lat,
    lon,        // wichtig: Map.jsx benutzt "lon" (nicht "lng")
    kosten,     // frei wählbar: '', 'kostenlos', 'bezahlt', etc.
    wc: !!wc,
    dusche: !!dusche,
    created: Date.now()
  }
  await db.put('pois', poi)
  return poi
}

/** POIs absteigend nach Erstellzeit */
export async function listPOIs() {
  const db = await dbp
  const all = await db.getAll('pois')
  all.sort((a, b) => (b?.created || 0) - (a?.created || 0))
  return all
}

/** POI löschen */
export async function removePOI(id) {
  const db = await dbp
  await db.delete('pois', id)
}

/** Optional: POI aktualisieren (wird derzeit nicht importiert, aber nützlich) */
export async function updatePOI(id, patch = {}) {
  const db = await dbp
  const poi = await db.get('pois', id)
  if (!poi) return null
  Object.assign(poi, patch)
  await db.put('pois', poi)
  return poi
}

/** Menschlich lesbare Kurzbeschreibung für die Liste/Popup */
export function humanPOI(p) {
  const parts = []
  if (p?.kosten) parts.push(String(p.kosten))
  if (p?.wc) parts.push('WC')
  if (p?.dusche) parts.push('Dusche')
  return parts.length ? parts.join(' · ') : '—'
}
