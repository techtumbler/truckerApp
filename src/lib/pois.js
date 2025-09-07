import { dbp } from './db'

export async function listPOIs(){
  const db = await dbp;
  const all = await db.getAll('pois');   // kürzer
  return all.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
}

export async function addPOI(poi){
  const db = await dbp;
  const id = poi.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
  await db.put('pois', { ...poi, id, createdAt: new Date().toISOString() });
  return id;
}

export async function removePOI(id){
  const db = await dbp;
  await db.delete('pois', id);
}

export function humanPOI(p){
  const feats = [
    p.kosten ? (p.kosten==='kostenlos' ? 'kostenlos' : 'bezahlt') : null,
    p.wc ? 'WC' : null,
    p.dusche ? 'Dusche' : null
  ].filter(Boolean);
  return feats.length ? feats.join(' · ') : '–';
}
