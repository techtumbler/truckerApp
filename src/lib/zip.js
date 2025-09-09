// src/lib/zip.js
import JSZip from 'jszip'
import { folderPathParts, listAllDocs, getDescendantFolderIds } from './docs'

export async function zipDocs(docs, folders, { rootName = 'export' } = {}) {
  const zip = new JSZip()
  for (const d of docs) {
    const parts = folderPathParts(d.folderId, folders)
    const dir = [rootName, ...parts].join('/')
    const filePath = `${dir}/${d.name}`
    const ab = await d.blob.arrayBuffer()
    zip.file(filePath, ab)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  return blob
}

/** Zippt einen Ordner inkl. ALLE Unterordner + Dateien (Root=null => kompletter Export) */
export async function zipFolderDeep(folderId, folders, { rootName = 'export' } = {}) {
  const all = await listAllDocs()
  const set = getDescendantFolderIds(folders, folderId ?? null) // enthält auch null
  const take = all.filter(d => set.has(d.folderId ?? null))
  return zipDocs(take, folders, { rootName })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
