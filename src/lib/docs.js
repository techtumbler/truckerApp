// src/lib/docs.js
import { dbp } from './db'

// ---------- Utils ----------
export function humanSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function monthKeyFrom(ts) {
  const dt = new Date(ts)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

async function toThumb(file) {
  if (!file || !file.type?.startsWith('image/')) return null
  const imgData = await file.arrayBuffer()
  const blob = new Blob([imgData], { type: file.type })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = rej
      im.src = url
    })
    const canvas = document.createElement('canvas')
    const maxW = 400, maxH = 300
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    URL.revokeObjectURL(url)
    return dataUrl
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

// ===================== DOCS =====================

/**
 * Robust: (a) Transaktion kurz halten, (b) keyPath immer befüllen (id).
 */
export async function addFiles(files, { note = '', folderId = null } = {}) {
  const list = Array.from(files || [])
  if (!list.length) return []

  const created = Date.now()
  const mk = monthKeyFrom(created)

  // 1) alles vorbereiten (ohne IDB)
  const prepared = await Promise.all(
    list.map(async (file) => {
      const buf = await file.arrayBuffer()
      const thumb = await toThumb(file)
      const id =
        (globalThis.crypto?.randomUUID?.() ?? null) ||
        String(Date.now() + Math.random())
      return {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        created,
        monthKey: mk,
        folderId: folderId ?? null,
        note,
        blob: new Blob([buf], { type: file.type }),
        thumb
      }
    })
  )

  // 2) kurze Transaktion
  const db = await dbp
  const tx = db.transaction('docs', 'readwrite')
  const store = tx.objectStore('docs')
  await Promise.all(prepared.map((doc) => store.add(doc)))
  await tx.done

  return prepared
}

/**
 * Liefert Dokumente:
 * - folderId === undefined  -> alle
 * - folderId === null       -> Root: d.folderId == null (null ODER undefined/legacy)
 * - folderId sonst          -> genau dieser Ordner
 */
export async function listDocs({ folderId, month = null } = {}) {
  const db = await dbp
  let docs

  if (typeof folderId === 'undefined') {
    docs = await db.getAll('docs')
  } else if (folderId === null) {
    try {
      // index + legacy-merge (folderId undefined)
      const viaIndex = await db.getAllFromIndex('docs', 'byFolder', null)
      const all = await db.getAll('docs')
      const legacy = all.filter(d => d.folderId == null) // null ODER undefined
      const m = new Map()
      for (const d of [...viaIndex, ...legacy]) m.set(d.id, d)
      docs = [...m.values()]
    } catch {
      docs = (await db.getAll('docs')).filter(d => d.folderId == null)
    }
  } else {
    try {
      docs = await db.getAllFromIndex('docs', 'byFolder', folderId)
    } catch {
      docs = (await db.getAll('docs')).filter(d => d.folderId === folderId)
    }
  }

  if (month) docs = docs.filter(d => d.monthKey === month)
  docs.sort((a, b) => b.created - a.created)
  return docs
}

export async function listAllDocs() {
  const db = await dbp
  const all = await db.getAll('docs')
  all.sort((a, b) => b.created - a.created)
  return all
}

export async function getDoc(id) {
  const db = await dbp
  return db.get('docs', id)
}
export async function removeDoc(id) {
  const db = await dbp
  return db.delete('docs', id)
}
export async function updateNote(id, note) {
  const db = await dbp
  const d = await db.get('docs', id)
  if (!d) return
  d.note = note
  await db.put('docs', d)
  return d
}
export async function updateDocFolder(id, folderId) {
  const db = await dbp
  const d = await db.get('docs', id)
  if (!d) return
  d.folderId = folderId ?? null
  await db.put('docs', d)
  return d
}

// ===================== FOLDERS (Baum) =====================

export async function listFolders() {
  const db = await dbp
  const rows = await db.getAll('folders')
  rows.forEach(f => { if (!('parentId' in f)) f.parentId = null })
  return rows
}

export async function addFolder(name, parentId = null) {
  const db = await dbp
  const id =
    (globalThis.crypto?.randomUUID?.() ?? null) ||
    String(Date.now() + Math.random())
  const folder = { id, name, parentId: parentId ?? null }
  await db.put('folders', folder)
  return folder
}
export async function renameFolder(id, name) {
  const db = await dbp
  const f = await db.get('folders', id)
  if (!f) return
  f.name = name
  await db.put('folders', f)
  return f
}
export async function moveFolder(id, newParentId = null) {
  const db = await dbp
  const all = await db.getAll('folders')
  const folder = all.find(f => f.id === id)
  if (!folder) return

  // Zyklus-Schutz
  const descendants = new Set()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()
    for (const f of all) {
      if (f.parentId === cur) {
        descendants.add(f.id)
        stack.push(f.id)
      }
    }
  }
  if (newParentId != null && (newParentId === id || descendants.has(newParentId))) {
    throw new Error('Ungültiges Ziel (Zyklus).')
  }

  folder.parentId = newParentId ?? null
  await db.put('folders', folder)
  return folder
}
export async function removeFolder(id) {
  const db = await dbp
  // Unterordner?
  let children = []
  try {
    children = await db.getAllFromIndex('folders', 'byParent', id)
  } catch {
    const all = await db.getAll('folders')
    children = all.filter(f => f.parentId === id)
  }
  if (children.length) throw new Error('Ordner enthält Unterordner.')
  // Dateien?
  let docs = []
  try {
    docs = await db.getAllFromIndex('docs', 'byFolder', id)
  } catch {
    const allDocs = await db.getAll('docs')
    docs = allDocs.filter(d => d.folderId === id)
  }
  if (docs.length) throw new Error('Ordner ist nicht leer.')
  await db.delete('folders', id)
}

// ========== Helpers ==========
export function buildFolderTree(folders) {
  const byId = new Map(folders.map(f => [f.id, { ...f, children: [] }]))
  const roots = []
  for (const f of byId.values()) {
    if (f.parentId == null) roots.push(f)
    else {
      const p = byId.get(f.parentId)
      if (p) p.children.push(f)
      else roots.push(f)
    }
  }
  const sortRec = n => {
    n.children.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    n.children.forEach(sortRec)
  }
  roots.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  roots.forEach(sortRec)
  return roots
}

export function folderPathParts(folderId, folders) {
  if (folderId == null) return []
  const map = new Map(folders.map(f => [f.id, f]))
  const parts = []
  let cur = map.get(folderId)
  while (cur) {
    parts.push(cur.name || '')
    cur = cur.parentId != null ? map.get(cur.parentId) : null
  }
  return parts.reverse()
}

export function getDescendantFolderIds(folders, rootId) {
  const byParent = new Map()
  for (const f of folders) {
    const arr = byParent.get(f.parentId ?? null) || []
    arr.push(f)
    byParent.set(f.parentId ?? null, arr)
  }
  const out = new Set([rootId ?? null])
  const stack = [rootId ?? null]
  while (stack.length) {
    const cur = stack.pop()
    const kids = byParent.get(cur) || []
    for (const k of kids) {
      if (!out.has(k.id)) {
        out.add(k.id)
        stack.push(k.id)
      }
    }
  }
  return out
}
