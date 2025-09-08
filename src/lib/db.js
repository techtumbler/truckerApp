import { openDB } from 'idb'

// DB v4: adds 'docs' (v3) + 'folders' (v4)
export const dbp = openDB('trucker-db', 4, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('kv');
      db.createObjectStore('lsvaPeriods', { keyPath: 'id' });
      db.createObjectStore('lsvaDocs', { keyPath: 'id' });
    }
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains('pois')) {
        db.createObjectStore('pois', { keyPath: 'id' });
      }
    }
    if (oldVersion < 3) {
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' });
      }
    }
    if (oldVersion < 4) {
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
    }
  }
});

export const kv = {
  async get(k){ return (await dbp).get('kv', k) },
  async set(k,v){ return (await dbp).put('kv', v, k) }
}
