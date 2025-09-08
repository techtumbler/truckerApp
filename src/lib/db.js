import { openDB } from 'idb'

// DB-Version erhöhen: v3 bringt den 'docs'-Store
export const dbp = openDB('trucker-db', 3, {
  upgrade(db, oldVersion) {
    // v0 -> v1
    if (oldVersion < 1) {
      db.createObjectStore('kv');
      db.createObjectStore('lsvaPeriods', { keyPath: 'id' });
      db.createObjectStore('lsvaDocs', { keyPath: 'id' });
    }
    // v1 -> v2
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains('pois')) {
        db.createObjectStore('pois', { keyPath: 'id' });
      }
    }
    // v2 -> v3  (NEU: docs)
    if (oldVersion < 3) {
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' });
      }
    }
  }
});

export const kv = {
  async get(k){ return (await dbp).get('kv', k) },
  async set(k,v){ return (await dbp).put('kv', v, k) }
}
