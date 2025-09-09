// src/lib/db.js
import { openDB } from 'idb'

// DB v5: Indizes für Folder-Hierarchie & Docs-Filter
export const dbp = openDB('trucker-db', 5, {
  upgrade(db, oldVersion, _newVersion, tx) {
    // v1: KV
    if (oldVersion < 1) {
      db.createObjectStore('kv')
    }
    // v2: POIs
    if (oldVersion < 2) {
      const s = db.createObjectStore('pois', { keyPath: 'id', autoIncrement: true })
      s.createIndex('byCreated', 'created')
    }
    // v3: Docs
    if (oldVersion < 3) {
      const d = db.createObjectStore('docs', { keyPath: 'id', autoIncrement: true })
      d.createIndex('byCreated', 'created')
      d.createIndex('byMonth', 'monthKey') // Monatsfilter
    }
    // v4: Folders (string IDs/uuid)
    if (oldVersion < 4) {
      db.createObjectStore('folders', { keyPath: 'id' })
    }

    // v5: fehlende Indizes ergänzen (ohne Datenverlust)
    if (db.objectStoreNames.contains('folders')) {
      const f = tx.objectStore('folders')
      if (!f.indexNames.contains('byParent')) {
        f.createIndex('byParent', 'parentId') // parentId kann null sein
      }
    }
    if (db.objectStoreNames.contains('docs')) {
      const d = tx.objectStore('docs')
      if (!d.indexNames.contains('byFolder')) {
        d.createIndex('byFolder', 'folderId')
      }
      if (!d.indexNames.contains('byMonth')) {
        d.createIndex('byMonth', 'monthKey')
      }
    }
  }
})

// Kompakte KV-API (erwartet von: import { kv } from '../lib/db')
export const kv = {
  async get(key) {
    const db = await dbp
    return db.get('kv', key)
  },
  async set(key, value) {
    const db = await dbp
    return db.put('kv', value, key)
  },
  async del(key) {
    const db = await dbp
    return db.delete('kv', key)
  },
  async keys() {
    const db = await dbp
    const tx = db.transaction('kv')
    const out = []
    let cur = await tx.store.openCursor()
    while (cur) {
      out.push(cur.key)
      cur = await cur.continue()
    }
    return out
  }
}
