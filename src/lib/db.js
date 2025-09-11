// src/lib/db.js
// Einheitliches, iOS/WebKit-sicheres IndexedDB-Setup (idb) mit robustem Upgrade
import { openDB } from 'idb'

export const DB_NAME = 'trucker-db'
export const DB_VERSION = 6 // <- bump: erzwingt einmaliges Upgrade (additiv, non-destruktiv)

// ---- ensureStores: sorgt dafür, dass alle Stores/Indizes existieren (egal von welcher Altversion)
function ensureStores(db) {
  // --- Key-Value ---
  if (!db.objectStoreNames.contains('kv')) {
    db.createObjectStore('kv')
  }

  // --- LSVA (aus deinem Projektstand v1) ---
  if (!db.objectStoreNames.contains('lsvaPeriods')) {
    db.createObjectStore('lsvaPeriods', { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains('lsvaDocs')) {
    db.createObjectStore('lsvaDocs', { keyPath: 'id' })
  }

  // --- POIs (v2) ---
  if (!db.objectStoreNames.contains('pois')) {
    const s = db.createObjectStore('pois', { keyPath: 'id' })
    // Index nach Datum (für Sortierung/Filter)
    s.createIndex('byDate', 'created', { unique: false })
  } else {
    const s = db.transaction.objectStore('pois')
    if (!s.indexNames.contains('byDate')) s.createIndex('byDate', 'created', { unique: false })
  }

  // --- DOCS (v3) ---
  if (!db.objectStoreNames.contains('docs')) {
    const s = db.createObjectStore('docs', { keyPath: 'id' })
    s.createIndex('byFolder', 'folderId', { unique: false })
    s.createIndex('byMonth', 'monthKey', { unique: false })
  } else {
    const s = db.transaction.objectStore('docs')
    if (!s.indexNames.contains('byFolder')) s.createIndex('byFolder', 'folderId', { unique: false })
    if (!s.indexNames.contains('byMonth')) s.createIndex('byMonth', 'monthKey', { unique: false })
  }

  // --- FOLDERS (v4) ---
  if (!db.objectStoreNames.contains('folders')) {
    const s = db.createObjectStore('folders', { keyPath: 'id' })
    s.createIndex('byParent', 'parentId', { unique: false })
  } else {
    const s = db.transaction.objectStore('folders')
    if (!s.indexNames.contains('byParent')) s.createIndex('byParent', 'parentId', { unique: false })
  }
}

// Eine (lazy) DB-Instanz, die beim ersten Zugriff geöffnet wird
export const dbp = (async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db /*, oldVersion, newVersion, tx*/) {
      // Wichtig: Wir migrieren minimal-invasiv und stellen am Ende alles sicher
      ensureStores(db)
    }
  })
  return db
})()

// ---- KV-Helpers (Kompatibilität zu import { kv } from '../lib/db')
export async function kvGet(key) {
  const db = await dbp
  return db.get('kv', key)
}
export async function kvSet(key, value) {
  const db = await dbp
  return db.put('kv', value, key)
}
export async function kvDel(key) {
  const db = await dbp
  return db.delete('kv', key)
}

// Optionaler kompatibler Namespace-Export (wie in deinem Projekt verwendet)
export const kv = {
  async get(k)  { return kvGet(k) },
  async set(k,v){ return kvSet(k, v) },
  async del(k)  { return kvDel(k) }
}
