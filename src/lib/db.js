import { openDB } from 'idb'

export const dbp = openDB('trucker-db', 1, {
  upgrade(db){
    db.createObjectStore('kv')
    const lsva = db.createObjectStore('lsvaPeriods', { keyPath: 'id' }) // "YYYY-MM"
    db.createObjectStore('lsvaDocs', { keyPath: 'id' })
  }
})

export const kv = {
  async get(k){ return (await dbp).get('kv', k) },
  async set(k,v){ return (await dbp).put('kv', v, k) }
}
