import { openDB } from 'idb'

// DB-Version erhöhen → Upgrade-Callback legt fehlende Stores an
export const dbp = openDB('trucker-db', 2, {
  upgrade(db, oldVersion) {
    // v0 → v1
    if (oldVersion < 1) {
      db.createObjectStore('kv');
      db.createObjectStore('lsvaPeriods', { keyPath: 'id' });
      db.createObjectStore('lsvaDocs', { keyPath: 'id' });
    }
    // v1 → v2  (NEU: pois)
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains('pois')) {
        db.createObjectStore('pois', { keyPath: 'id' });
      }
    }
  }
});

export const kv = {
  async get(k){ return (await dbp).get('kv', k) },
  async set(k,v){ return (await dbp).put('kv', v, k) }
};
