// src/routes/Docs.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import FolderTree from '../lib/FolderTree.jsx'
import {
  addFiles,
  listDocs,
  listAllDocs,
  getDoc,
  removeDoc,
  updateDocFolder,
  humanSize,
  listFolders,
  addFolder,
  renameFolder,
  removeFolder,
  moveFolder,
  buildFolderTree,
  folderPathParts, // ← nutzen wir (liefert Namen), IDs rekonstruieren wir unten
} from '../lib/docs.js'
import { zipDocs, zipFolderDeep, downloadBlob } from '../lib/zip.js'
import { vibrate } from '../lib/haptics.js'

// "Alle Dateien" pseudo-Folder-ID
const ALL_FILES = '__ALL__'

export default function Docs() {
  const [busy, setBusy] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [view, setView] = useState('grid') // 'grid' | 'list' (bei ALL_FILES forcieren wir 'list')
  const [currentFolder, setCurrentFolder] = useState(null) // null = Root
  const [folderTree, setFolderTree] = useState(null)
  const [folders, setFolders] = useState([])
  const [docs, setDocs] = useState([])
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const [showPanel, setShowPanel] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  const [preview, setPreview] = useState(null) // { id, url, name, type, size, isImage, isPDF, zoom }

  const fileRef = useRef(null)
  const wrapRef = useRef(null)

  // aria-live toast
  function notify(msg) {
    setToastMsg(msg)
    try { vibrate(18) } catch {}
    setTimeout(() => setToastMsg(''), 1800)
  }

  // ===== Daten laden =====
  async function refresh() {
    const fs = await listFolders()
    setFolders(fs)
    const tree = buildFolderTree(fs)
    setFolderTree(tree)

    if (currentFolder === ALL_FILES) {
      const all = await listAllDocs()
      setDocs(all)
    } else {
      const list = await listDocs(currentFolder)
      setDocs(list)
    }
  }

  // Pfad/Title: Namen über folderPathParts, IDs via Rekonstruktion (Map chain)
  const pathParts = useMemo(() => {
    if (!folders || currentFolder == null) return []
    // nutzt API (liefert string-Namen)
    const _names = folderPathParts(currentFolder, folders)
    // IDs + Namen rekonstruieren
    const byId = new Map((folders || []).map(f => [f.id, f]))
    const out = []
    let cur = byId.get(currentFolder)
    while (cur) {
      out.unshift({ id: cur.id, name: cur.name || '' })
      cur = cur.parentId != null ? byId.get(cur.parentId) : null
    }
    return out
  }, [folders, currentFolder])

  // ===== Auswahl-Logik =====
  function toggleSelect(id) {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function clearSelection() { setSelectedDocs(new Set()) }

  // ===== Upload =====
  async function uploadFiles(files, { toFolder = currentFolder } = {}) {
    if (!files?.length) return
    setBusy(true)
    try {
      await addFiles(files, { folderId: toFolder })
      notify(`${files.length} Datei(en) hochgeladen`)
      if (fileRef.current) fileRef.current.value = ''
      await refresh()
    } catch (e) {
      alert('Upload fehlgeschlagen. ' + (e?.message || ''))
    } finally {
      setBusy(false)
    }
  }

  // Safari-sicher: nutzt webkitGetAsEntry wenn vorhanden, sonst Fallback auf files
  async function extractFilesFromDataTransfer(dt) {
    const out = []
    if (dt?.items && dt.items.length) {
      const hasEntry = typeof dt.items[0].webkitGetAsEntry === 'function'
      if (hasEntry) {
        const walk = async (entry) => {
          if (entry.isFile) {
            await new Promise(res => entry.file(f => { out.push(f); res() }))
          } else if (entry.isDirectory) {
            const reader = entry.createReader()
            while (true) {
              const entries = await new Promise(res => reader.readEntries(res))
              if (!entries.length) break
              for (const e of entries) await walk(e)
            }
          }
        }
        for (const it of dt.items) {
          const entry = it.webkitGetAsEntry && it.webkitGetAsEntry()
          if (entry) await walk(entry)
        }
      }
    }
    if (!out.length && dt?.files && dt.files.length) {
      return Array.from(dt.files)
    }
    return out
  }

  async function onRootDrop(e, toFolderId = currentFolder) {
    e.preventDefault()
    setIsDraggingOver(false)
    try {
      const files = await extractFilesFromDataTransfer(e.dataTransfer)
      if (files?.length) {
        await uploadFiles(files, { toFolder: toFolderId })
        return
      }
      // ggf. Dokumente/Ordner verschieben (IDs im DataTransfer)
      const idsRaw = e.dataTransfer.getData('application/x-doc-ids')
      const folderIdRaw = e.dataTransfer.getData('application/x-folder-id')
      if (idsRaw) {
        const ids = JSON.parse(idsRaw)
        if (toFolderId === null) {
          if (!confirm('In die Root verschieben? Dateien ohne Ordner können schwer wiederzufinden sein.')) return
        }
        await Promise.all(ids.map(id => updateDocFolder(id, toFolderId ?? null)))
        notify(`${ids.length} Datei(en) verschoben`)
        await refresh()
        clearSelection()
      } else if (folderIdRaw) {
        const movingId = folderIdRaw
        if (toFolderId === movingId) return
        if (toFolderId === null) {
          if (!confirm('Ordner in die Root verschieben?')) return
        }
        await moveFolder(movingId, toFolderId ?? null)
        notify('Ordner verschoben')
        await refresh()
      }
    } catch (err) {
      alert('Drop fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'))
    }
  }

  function onDragOver(e) { e.preventDefault(); setIsDraggingOver(true) }
  function onDragLeave() { setIsDraggingOver(false) }
  async function onDrop(e) { return onRootDrop(e, currentFolder) }

  async function onInputChange(e) {
    const files = Array.from(e.target.files || [])
    await uploadFiles(files)
  }

  // ===== Aktionen: ZIP, Löschen, Verschieben =====
  async function exportSelected() {
    if (!selectedDocs.size) return
    const chosen = docs.filter(d => selectedDocs.has(d.id))
    if (!chosen.length) return
    notify('ZIP wird erstellt …')
    const blob = await zipDocs(chosen)
    downloadBlob(blob, 'auswahl.zip')
    notify('ZIP erstellt')
  }

  async function deleteSelected() {
    if (!selectedDocs.size) return
    const chosen = docs.filter(d => selectedDocs.has(d.id))
    if (!chosen.length) return
    if (!confirm(`${chosen.length} Datei(en) löschen?`)) return
    await Promise.all(chosen.map(d => removeDoc(d.id)))
    notify(`${chosen.length} gelöscht`)
    await refresh()
    clearSelection()
  }

  async function moveSelected() {
    if (!selectedDocs.size) return
    const to = prompt('Zielordner-ID (leer = Root):', currentFolder ?? '')
    if (to === null) return
    const dst = to === '' ? null : to
    if (dst === null && !confirm('In die Root verschieben?')) return
    await Promise.all(
      Array.from(selectedDocs).map(id => updateDocFolder(id, dst))
    )
    notify(`${selectedDocs.size} verschoben`)
    await refresh()
    clearSelection()
  }

  async function exportFolderDeep() {
    const folderId = currentFolder
    if (!folderId && folderId !== null) return
    const blob = await zipFolderDeep(folderId)
    downloadBlob(blob, (folderId ? `ordner-${folderId}` : 'root') + '.zip')
  }

  // ===== Preview =====
  async function openPreview(d) {
    try {
      const fileDoc = await getDoc(d.id)
      const url = URL.createObjectURL(fileDoc.blob)
      setPreview({
        id: d.id, url, name: d.name, type: d.type, size: d.size,
        isImage: d.type?.startsWith('image/'),
        isPDF: d.type === 'application/pdf',
        zoom: 1
      })
    } catch (e) {
      alert('Vorschau nicht möglich.')
    }
  }
  function closePreview() { try { URL.revokeObjectURL(preview?.url) } catch {} ; setPreview(null) }
  function zoomIn() { setPreview(p => ({ ...p, zoom: Math.min(6, (p.zoom || 1) + 0.2) })) }
  function zoomOut() { setPreview(p => ({ ...p, zoom: Math.max(0.2, (p.zoom || 1) - 0.2) })) }
  function zoomReset() { setPreview(p => ({ ...p, zoom: 1 })) }
  function zoomFit() { setPreview(p => ({ ...p, zoom: 'fit' })) }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closePreview()
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn() }
      if (e.key === '-') { e.preventDefault(); zoomOut() }
      if (e.key === '0') { e.preventDefault(); zoomReset() }
    }
    if (preview) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  // ===== Ordner-Wechsel =====
  async function onSelectFolder(id) {
    setCurrentFolder(id)
    clearSelection()
  }

  // ===== Erst-Load + Reload bei currentFolder =====
  useEffect(() => { refresh() }, [currentFolder])

  // "Alle Dateien" → List erzwingen
  const effectiveView = currentFolder === ALL_FILES ? 'list' : view

  // ===== Rendering =====
  return (
    <div className="docs-page">
      <div className="drawer-toggle">
        <button className="btn outline sm show-mobile" onClick={() => setShowPanel(s => !s)} aria-expanded={showPanel}>
          ☰ Ordner
        </button>
      </div>

      <aside className={`drawer ${showPanel ? 'open' : ''}`}>
        {folderTree && (
          <FolderTree
            tree={folderTree}
            current={currentFolder}
            onSelect={onSelectFolder}
            onDropDocs={(folderId, e) => onRootDrop(e, folderId)}
            onDropFolder={(folderId, e) => onRootDrop(e, folderId)}
            onRootDrop={(e) => onRootDrop(e, null)}
            allowRootDrop
          />
        )}

        <div className="folder-actions">
          <button
            className="btn sm"
            onClick={async ()=>{
              const name = prompt('Neuer Ordnername:')
              if (name === null || !name.trim()) return
              await addFolder({ name: name.trim(), parentId: currentFolder ?? null })
              await refresh()
            }}
          >
            + Ordner
          </button>
          <button
            className="btn sm"
            onClick={async ()=>{
              if (!currentFolder) { alert('Für Umbenennen bitte einen Ordner wählen.'); return }
              const name = prompt('Neuer Ordnername:')
              if (name === null || !name.trim()) return
              await renameFolder(currentFolder, name.trim())
              await refresh()
            }}
          >
            Umbenennen
          </button>
          <button
            className="btn crit sm"
            onClick={async ()=>{
              if (!currentFolder) { alert('Root kann nicht gelöscht werden.'); return }
              if (!confirm('Ordner wirklich löschen? (Inhalt bleibt erhalten, aber ohne Ordner)')) return
              await removeFolder(currentFolder)
              setCurrentFolder(null)
              await refresh()
            }}
          >
            Ordner löschen
          </button>

          <hr/>
          <button
            className="btn sm"
            onClick={() => setCurrentFolder(ALL_FILES)}
            aria-pressed={currentFolder === ALL_FILES}
          >
            Alle Dateien
          </button>
          <button
            className="btn sm"
            onClick={() => setCurrentFolder(null)}
            aria-pressed={currentFolder === null}
          >
            Root
          </button>
        </div>
      </aside>

      <section
        ref={wrapRef}
        className={`docs-wrap ${isDraggingOver ? 'dropping' : ''}`}
        onDragEnter={onDragOver}   // wichtig für Safari
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
        aria-busy={busy ? 'true' : 'false'}
      >
        <header className="docs-header">
          <div className="path">
            <span className="crumb" role="link" tabIndex={0} onClick={()=>setCurrentFolder(null)}>Home</span>
            {pathParts.map(p => (
              <span key={p.id} className="crumb" role="link" tabIndex={0} onClick={()=>setCurrentFolder(p.id)}>{p.name}</span>
            ))}
            {currentFolder === ALL_FILES && <span className="crumb">Alle Dateien</span>}
          </div>

          <div className="actions">
            <div className="seg">
              <button
                className={`seg-btn ${effectiveView==='grid' ? 'active' : ''}`}
                onClick={()=>setView('grid')}
                disabled={currentFolder === ALL_FILES}
                aria-pressed={effectiveView === 'grid'}
              >Grid</button>
              <button
                className={`seg-btn ${effectiveView==='list' ? 'active' : ''}`}
                onClick={()=>setView('list')}
                aria-pressed={effectiveView === 'list'}
              >Liste</button>
            </div>

            <button className="btn primary hide-mobile" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'Lädt…' : 'Dateien wählen'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              capture="environment"
              onChange={onInputChange}
              style={{ display: 'none' }}
            />
          </div>
        </header>

        {/* Dropzone Overlay */}
        {isDraggingOver && (
          <div className="dropzone" role="region" aria-live="polite">
            <div className="dz-inner">
              <div className="dz-title">Dateien hier ablegen</div>
              <div className="dz-sub">
                Ziel: {currentFolder===ALL_FILES ? 'Alle Dateien' : (pathParts.map(p=>p.name).join(' / ') || 'Root')}
              </div>
            </div>
          </div>
        )}

        {/* Dateien */}
        <div className={effectiveView==='grid' ? 'docs-grid' : 'docs-list'}>
          {docs.map(d => (
            <DocCard
              key={d.id}
              d={d}
              view={effectiveView}
              selected={selectedDocs.has(d.id)}
              onSelect={() => toggleSelect(d.id)}
              onOpen={() => openPreview(d)}
              showThumb={currentFolder !== ALL_FILES} // in "Alle Dateien" keine Thumbs
            />
          ))}
          {docs.length===0 && (
            <div className="empty">
              <p>Noch keine Dateien im Ordner.</p>
            </div>
          )}
        </div>

        {/* Aktionen (Desktop) */}
        <div className="toolbar hide-mobile">
          <button className="btn outline sm" onClick={moveSelected} disabled={!selectedDocs.size}>Verschieben</button>
          <button className="btn outline sm" onClick={exportSelected} disabled={!selectedDocs.size}>ZIP</button>
          <button className="btn crit sm" onClick={deleteSelected} disabled={!selectedDocs.size}>Löschen</button>
          <div className="spacer" />
          <button className="btn sm" onClick={exportFolderDeep} disabled={currentFolder===ALL_FILES}>Ordner als ZIP</button>
        </div>

        {/* FAB (Mobile Upload) */}
        <button
          className="fab show-mobile"
          onClick={() => fileRef.current?.click()}
          aria-label="Datei aufnehmen/hochladen"
          disabled={busy}
        >
          <span className="fab-plus" aria-hidden>+</span>
        </button>

        {/* Bottom action bar (Mobile) */}
        <div className={`bottom-bar show-mobile ${selectedDocs.size ? 'show' : ''}`} aria-hidden={selectedDocs.size ? 'false' : 'true'}>
          <span className="bb-count">{selectedDocs.size} gewählt</span>
          <button className="btn outline sm" onClick={moveSelected} disabled={!selectedDocs.size}>Verschieben</button>
          <button className="btn outline sm" onClick={exportSelected} disabled={!selectedDocs.size}>ZIP</button>
          <button className="btn crit sm" onClick={deleteSelected} disabled={!selectedDocs.size}>Löschen</button>
        </div>
      </section>

      {/* aria-live Region */}
      <div className="sr-only" aria-live="polite">{toastMsg}</div>

      {/* Viewer */}
      {preview && (
        <div className="viewer" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList.contains('viewer')) closePreview() }}>
          <div className="viewer-inner">
            <div className="viewer-bar">
              <strong className="name">{preview.name}</strong>
              <span className="meta">{preview.type} · {humanSize(preview.size)}</span>
              <div className="spacer" />
              <button className="btn sm" onClick={zoomFit}>Fit</button>
              <button className="btn sm" onClick={zoomOut}>–</button>
              <button className="btn sm" onClick={zoomIn}>+</button>
              <button className="btn sm" onClick={zoomReset}>100%</button>
              <a className="btn" href={preview.url} download={preview.name}>Download</a>
              <button className="btn" onClick={closePreview}>Schliessen</button>
            </div>
            <div className={`viewer-body ${preview.isImage ? 'image' : preview.isPDF ? 'pdf' : 'other'}`}>
              {preview.isImage && (
                <img
                  src={preview.url}
                  alt={preview.name}
                  style={{ transform: preview.zoom==='fit' ? 'none' : `scale(${preview.zoom || 1})` }}
                  className={preview.zoom==='fit' ? 'fit' : ''}
                  onDoubleClick={()=> setPreview(p => ({ ...p, zoom: p.zoom==='fit' ? 1 : 'fit' }))}
                  onWheel={(e)=>{
                    e.preventDefault()
                    const dir = Math.sign(e.deltaY)
                    setPreview(p => ({ ...p, zoom: Math.max(0.2, Math.min(6, (p.zoom || 1) + (dir<0 ? 0.1 : -0.1))) }))
                  }}
                />
              )}
              {preview.isPDF && (
                <object data={preview.url} type="application/pdf" className="pdfobj">
                  <p>PDF kann nicht angezeigt werden. <a href={preview.url} target="_blank" rel="noreferrer">Im neuen Tab öffnen</a></p>
                </object>
              )}
              {!preview.isImage && !preview.isPDF && (
                <p>Diese Datei kann hier nicht angezeigt werden. <a href={preview.url} target="_blank" rel="noreferrer">Öffnen</a></p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocCard({ d, view, selected, onSelect, onOpen, showThumb }) {
  const ext = (d.name.split('.').pop() || '').toLowerCase()
  const isImage = d.type?.startsWith('image/')
  const isPDF = d.type === 'application/pdf'

  if (view === 'list') {
    return (
      <div className={`row ${selected?'sel':''}`} role="button" tabIndex={0} onClick={onSelect}>
        <span className="col col-ico" aria-hidden>{currentIcon(showThumb, isImage, isPDF)}</span>
        <span className="col col-name" onDoubleClick={(e)=>{ e.stopPropagation(); onOpen?.() }}>{d.name}</span>
        <span className="col col-ext">{ext}</span>
        <span className="col col-size">{humanSize(d.size)}</span>
        <span className="col col-path">{d.path || d.folderPath || ''}</span>
      </div>
    )
  }

  return (
    <div className={`card ${selected?'sel':''}`} role="button" tabIndex={0} onClick={onSelect}>
      <div className="thumb" onDoubleClick={(e)=>{ e.stopPropagation(); onOpen?.() }}>
        {showThumb && isImage && d.thumb ? (
          <img src={d.thumb} alt="" loading="lazy" />
        ) : (
          <div className="ico">{currentIcon(showThumb, isImage, isPDF)}</div>
        )}
      </div>
      <div className="meta">
        <div className="name" title={d.name}>{d.name}</div>
        <div className="sub">{humanSize(d.size)}</div>
      </div>
    </div>
  )
}

function currentIcon(showThumb, isImage, isPDF) {
  if (!showThumb) return '📄'
  if (isImage) return '🖼️'
  if (isPDF) return '📄'
  return '📎'
}
