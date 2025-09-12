// src/lib/db.js
// Einheitliches, iOS/WebKit-sicheres IndexedDB-Setup (idb) mit robustem Upgrade
import { openDB } from 'idb'

export const DB_NAME = 'trucker-db'
export const DB_VERSION = 6 // additiv, non-destruktiv

// ---- ensureStores: alle Stores/Indizes anlegen oder nachziehen
function ensureStores(db, tx) {
  // --- Key-Value ---
  if (!db.objectStoreNames.contains('kv')) {
    db.createObjectStore('kv')
  }

  // --- LSVA (aus deinem Projektstand v1) ---
  if (!db.objectStoreNames.contains('lsvaPeriods')) {
    db.createObjectStore('lsvaPeriods', { keyPath: 'id' })
  }

  // --- POIs (v2) ---
  if (!db.objectStoreNames.contains('pois')) {
    const s = db.createObjectStore('pois', { keyPath: 'id' })
    s.createIndex('byDate', 'created', { unique: false })
  } else {
    const s = tx.objectStore('pois')
    if (!s.indexNames.contains('byDate')) s.createIndex('byDate', 'created', { unique: false })
  }

  // --- DOCS (v3) ---
  if (!db.objectStoreNames.contains('docs')) {
    const s = db.createObjectStore('docs', { keyPath: 'id' })
    s.createIndex('byFolder', 'folderId', { unique: false })
    s.createIndex('byMonth', 'monthKey', { unique: false })
  } else {
    const s = tx.objectStore('docs')
    if (!s.indexNames.contains('byFolder')) s.createIndex('byFolder', 'folderId', { unique: false })
    if (!s.indexNames.contains('byMonth')) s.createIndex('byMonth', 'monthKey', { unique: false })
  }

  // --- FOLDERS (v4) ---
  if (!db.objectStoreNames.contains('folders')) {
    const s = db.createObjectStore('folders', { keyPath: 'id' })
    s.createIndex('byParent', 'parentId', { unique: false })
  } else {
    const s = tx.objectStore('folders')
    if (!s.indexNames.contains('byParent')) s.createIndex('byParent', 'parentId', { unique: false })
  }
}

export const dbp = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, _oldVersion, _newVersion, tx) {
    ensureStores(db, tx)
  }
})

// ---- KV kompatibler Export (für Lsva.jsx & Co.)
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
export const kv = { get: kvGet, set: kvSet, del: kvDel }
