import { dbp } from './db'

const toMonthKey = (d=new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  return `${y}-${m}`
}

export async function listDocs(){
  const db = await dbp
  const all = await db.getAll('docs')
  return all.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))
}

export async function getDoc(id){
  const db = await dbp
  return db.get('docs', id)
}

export async function removeDoc(id){
  const db = await dbp
  await db.delete('docs', id)
}

export async function updateNote(id, note){
  const db = await dbp
  const d = await db.get('docs', id)
  if(!d) return
  d.note = note
  await db.put('docs', d)
  return d
}

export async function addFiles(files, {note} = {}){
  const out = []
  for (const file of files) {
    const rec = await makeRecordFromFile(file, note)
    const db = await dbp
    await db.put('docs', rec)
    out.push(rec.id)
  }
  return out
}

// Helpers

async function makeRecordFromFile(file, note){
  const id = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
  const now = new Date()
  const isImage = file.type.startsWith('image/')
  const isPDF = file.type === 'application/pdf'
  const thumbDataUrl = isImage ? await makeImageThumb(file) : null
  // Wir speichern die Datei als Blob im Record (lokal, offline-fähig)
  const arrayBuf = await file.arrayBuffer()
  const blob = new Blob([arrayBuf], { type: file.type })
  return {
    id,
    name: file.name || (isImage ? 'Foto' : isPDF ? 'Dokument' : 'Datei'),
    type: file.type,
    size: file.size,
    createdAt: now.toISOString(),
    monthKey: toMonthKey(now),
    note: note || '',
    isImage, isPDF,
    thumbDataUrl,   // Base64 für schnelle Liste
    blob            // eigentlicher Inhalt
  }
}

async function makeImageThumb(file, maxSide=256, quality=0.8){
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = width > height ? maxSide/width : maxSide/height
  const w = Math.max(1, Math.round(width*scale))
  const h = Math.max(1, Math.round(height*scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  bitmap.close?.()
  return dataUrl
}

export function humanSize(bytes){
  const units = ['B','KB','MB','GB']; let i=0; let n=bytes
  while(n>=1024 && i<units.length-1){ n/=1024; i++ }
  return `${n.toFixed(n>=10||i===0?0:1)} ${units[i]}`
}
