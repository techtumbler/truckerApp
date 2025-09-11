// src/routes/Docs.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  addFiles, listDocs, listAllDocs, getDoc, removeDoc, updateDocFolder, humanSize,
  listFolders, addFolder, renameFolder, removeFolder, moveFolder, folderPathParts
} from '../lib/docs'
import FolderTree from '../lib/FolderTree.jsx'
import { zipDocs, downloadBlob, zipFolderDeep } from '../lib/zip'

export default function Docs() {
  // --- state ---
  const [docs, setDocs] = useState([])
  const [folders, setFolders] = useState([])
  const [currentFolder, setCurrentFolder] = useState(null) // null = Root
  const [filterMonth, setFilterMonth] = useState('all')
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const [showAll, setShowAll] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [preview, setPreview] = useState(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showFolders, setShowFolders] = useState(false) // mobile drawer

  const fileRef = useRef(null)

  // --- helpers ---
  function notify(msg) {
    setFlash(msg)
    if (navigator?.vibrate) navigator.vibrate(8)
    window.setTimeout(() => setFlash(null), 2200)
  }

  const breadcrumb = useMemo(() => {
    const parts = folderPathParts(currentFolder, folders)
    return parts.length ? parts.join(' / ') : 'Root'
  }, [currentFolder, folders])

  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(docs.map(d => d.monthKey).filter(Boolean))).sort().reverse()
    return ['all', ...keys]
  }, [docs])

  // --- data ---
  async function refresh() {
    const fs = await listFolders()
    setFolders(fs)

    let list
    if (showAll) {
      list = await listAllDocs()
    } else {
      list = await listDocs({
        folderId: currentFolder,
        month: filterMonth === 'all' ? null : filterMonth
      })
    }
    setDocs(list)
    setSelectedDocs(sel => new Set([...sel].filter(id => list.some(d => d.id === id))))
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => { refresh() }, [currentFolder, filterMonth, showAll])

  // Automatisch Liste aktivieren, wenn "Alle Dateien" an ist
  useEffect(() => {
    if (showAll && viewMode !== 'list') setViewMode('list')
  }, [showAll, viewMode])

  // --- upload core ---
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

  // --- input select (auto-upload) ---
  async function onInputChange(e) {
    const files = Array.from(e.target.files || [])
    await uploadFiles(files)
  }

  // --- Dropzone (Gesamtbereich) ---
  function onDragOver(e) { e.preventDefault(); setIsDraggingOver(true) }
  function onDragLeave() { setIsDraggingOver(false) }
  async function onDrop(e) {
    e.preventDefault(); setIsDraggingOver(false)
    const files = await extractFilesFromDataTransfer(e.dataTransfer)
    if (files.length) await uploadFiles(files)
  }

  // rekursiver Ordner-Upload (sofern Browser kann), sonst fallback
  async function extractFilesFromDataTransfer(dt) {
    const out = []
    if (dt.items && dt.items.length && dt.items[0]?.webkitGetAsEntry) {
      const recurse = async (entry) => {
        if (entry.isFile) {
          await new Promise(res => entry.file(f => { out.push(f); res() }))
        } else if (entry.isDirectory) {
          const reader = entry.createReader()
          const entries = await new Promise(res => reader.readEntries(res))
          for (const e of entries) await recurse(e)
        }
      }
      for (const it of dt.items) {
        const entry = it.webkitGetAsEntry()
        if (entry) await recurse(entry)
      }
    } else if (dt.files && dt.files.length) {
      out.push(...Array.from(dt.files))
    }
    return out
  }

  // --- Preview ---
  async function openPreview(id) {
    const d = await getDoc(id)
    const url = URL.createObjectURL(d.blob)
    setPreview({
      id: d.id, url, name: d.name, type: d.type, size: d.size,
      isImage: d.type?.startsWith('image/'),
      isPDF: d.type === 'application/pdf',
      zoom: 1
    })
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

  // --- Ordner-Aktionen ---
  async function newFolder() {
    const name = prompt('Neuer Ordnername')
    if (!name) return
    await addFolder(name, currentFolder)
    notify('Ordner erstellt'); refresh()
  }
  async function renameCur() {
    if (currentFolder == null) return
    const cur = folders.find(f => f.id === currentFolder)
    const name = prompt('Neuer Name', cur?.name || '')
    if (!name) return
    await renameFolder(currentFolder, name)
    notify('Ordner umbenannt'); refresh()
  }
  async function moveCur() {
    if (currentFolder == null) return
    const options = folders.filter(f => f.id !== currentFolder)
    const pick = prompt('Ziel-Ordner ID (leer = Root)\n' + options.map(f => `${f.id}: ${f.name}`).join('\n'))
    if (pick === null) return
    const newParentId = pick.trim() === '' ? null : pick.trim()
    try { await moveFolder(currentFolder, newParentId); notify('Ordner verschoben'); refresh() }
    catch(e){ alert(e?.message || 'Verschieben nicht möglich.') }
  }
  async function deleteCur() {
    if (currentFolder == null) return
    if (!confirm('Ordner löschen? Nur möglich, wenn leer.')) return
    try { await removeFolder(currentFolder); setCurrentFolder(null); notify('Ordner gelöscht'); refresh() }
    catch(e){ alert(e?.message || 'Ordner nicht leer / hat Unterordner.') }
  }

  // --- DnD auf Baum (Docs/Folders) ---
  async function onDropDocIds(folderId, ids) {
    if (folderId == null) {
      const ok = confirm('In Root verschieben? Dateien ohne Ordner werden im Root angezeigt.')
      if (!ok) return
    }
    for (const id of ids) await updateDocFolder(id, folderId)
    setSelectedDocs(new Set()); notify(`${ids.length} Datei(en) verschoben`); refresh()
  }
  async function onDropFiles(folderId, files) {
    await uploadFiles(files, { toFolder: folderId })
  }
  async function onDropFolder(sourceFolderId, targetFolderId) {
    try {
      if (targetFolderId == null) {
        const ok = confirm('Ordner in Root verschieben?')
        if (!ok) return
      }
      await moveFolder(sourceFolderId, targetFolderId)
      notify('Ordner verschoben'); refresh()
    } catch (e) {
      alert(e?.message || 'Ordner konnte nicht verschoben werden.')
    }
  }

  // --- Auswahl-Aktionen ---
  function onDragStartDoc(e, id) {
    const ids = selectedDocs.size && selectedDocs.has(id) ? [...selectedDocs] : [id]
    e.dataTransfer.setData('application/x-trucker-doc-ids', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }
  function toggleSel(id) {
    setSelectedDocs(sel => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() { setSelectedDocs(new Set(docs.map(d => d.id))) }
  function clearSel() { setSelectedDocs(new Set()) }

  async function deleteSelected() {
    if (!selectedDocs.size) return
    if (!confirm(`${selectedDocs.size} Datei(en) löschen?`)) return
    for (const id of selectedDocs) await removeDoc(id)
    clearSel(); notify('Auswahl gelöscht'); refresh()
  }
  async function moveSelected() {
    if (!selectedDocs.size) return
    const pick = prompt('Ziel-Ordner ID (leer = Root [Warnung])\n' + folders.map(f => `${f.id}: ${f.name}`).join('\n'))
    if (pick === null) return
    const folderId = pick.trim() === '' ? null : pick.trim()
    if (folderId == null) {
      const ok = confirm('In Root verschieben? Dateien ohne Ordner werden im Root angezeigt.')
      if (!ok) return
    }
    for (const id of selectedDocs) await updateDocFolder(id, folderId)
    clearSel(); notify('Auswahl verschoben'); refresh()
  }
  async function exportSelected() {
    if (!selectedDocs.size) return
    const list = docs.filter(d => selectedDocs.has(d.id))
    const blob = await zipDocs(list, folders, { rootName: 'auswahl' })
    downloadBlob(blob, `auswahl_${Date.now()}.zip`)
    notify('ZIP erstellt')
  }
  async function exportCurrentFolder() {
    const name = currentFolder == null ? 'Root' : (folders.find(f => f.id === currentFolder)?.name || 'export')
    const blob = await zipFolderDeep(currentFolder, folders, { rootName: name })
    downloadBlob(blob, `${name}.zip`)
    notify('ZIP erstellt')
  }

  // ---- render helpers ----
  const renderDocGridCard = (d) => {
    const path = folderPathParts(d.folderId, folders).join(' / ')
    const showThumb = !showAll && d.thumb // in „Alle Dateien“ keine Bildvorschau
    return (
      <article
        key={d.id}
        className={`file ${selectedDocs.has(d.id) ? 'sel' : ''}`}
        draggable
        onDragStart={(e) => onDragStartDoc(e, d.id)}
      >
        <div className="thumb" role="button" onClick={() => openPreview(d.id)}>
          {showThumb ? <img src={d.thumb} alt="" /> : <span className="icon" aria-hidden>📄</span>}
        </div>
        <div className="meta">
          <div className="name">
            <input type="checkbox" checked={selectedDocs.has(d.id)} onChange={() => toggleSel(d.id)} />
            <strong title={d.name}>{d.name}</strong>
          </div>
          <div className="sub">
            <span>{humanSize(d.size)}</span>
            <span>·</span>
            <span>{new Date(d.created).toLocaleDateString()}</span>
            {showAll && path && (<><span>·</span><span title={path}>{path}</span></>)}
          </div>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={() => openPreview(d.id)}>Anzeigen</button>
          <button className="btn sm" onClick={async () => {
            const pick = prompt('Ziel-Ordner ID (leer = Root [Warnung])\n' + folders.map(f => `${f.id}: ${f.name}`).join('\n'))
            if (pick === null) return
            const folderId = pick.trim() === '' ? null : pick.trim()
            if (folderId == null && !confirm('In Root verschieben?')) return
            await updateDocFolder(d.id, folderId); notify('Datei verschoben'); refresh()
          }}>Verschieben</button>
          <button className="btn sm" onClick={async () => { if (confirm('Löschen?')) { await removeDoc(d.id); notify('Datei gelöscht'); refresh() } }}>Löschen</button>
        </div>
      </article>
    )
  }

  const renderDocListRow = (d) => {
    const path = folderPathParts(d.folderId, folders).join(' / ')
    return (
      <div
        key={d.id}
        className={`lrow ${selectedDocs.has(d.id) ? 'sel' : ''}`}
        draggable
        onDragStart={(e) => onDragStartDoc(e, d.id)}
      >
        <div className="cell name">
          <input type="checkbox" checked={selectedDocs.has(d.id)} onChange={() => toggleSel(d.id)} />
          <span className="icon" aria-hidden>📄</span>
          <button className="linklike" onClick={() => openPreview(d.id)} title="Anzeigen">{d.name}</button>
        </div>
        <div className="cell size">{humanSize(d.size)}</div>
        <div className="cell date">{new Date(d.created).toLocaleDateString()}</div>
        <div className="cell path" title={path}>{path || '—'}</div>
        <div className="cell actions">
          <button className="btn xs" onClick={async () => {
            const pick = prompt('Ziel-Ordner ID (leer = Root [Warnung])\n' + folders.map(f => `${f.id}: ${f.name}`).join('\n'))
            if (pick === null) return
            const folderId = pick.trim() === '' ? null : pick.trim()
            if (folderId == null && !confirm('In Root verschieben?')) return
            await updateDocFolder(d.id, folderId); notify('Datei verschoben'); refresh()
          }}>Verschieben</button>
          <button className="btn xs" onClick={async () => { if (confirm('Löschen?')) { await removeDoc(d.id); notify('Datei gelöscht'); refresh() } }}>Löschen</button>
        </div>
      </div>
    )
  }

  // ------ render ------
  return (
    <div className="docs-layout">
      {/* Off-canvas Sidebar (mobile) */}
      <div className={`drawer-backdrop ${showFolders ? 'open' : ''}`} onClick={()=>setShowFolders(false)} aria-hidden />
      <aside className={`card sidebar drawer ${showFolders ? 'open' : ''}`} aria-label="Ordner">
        <div className="sidebar-head">
          <h3>Ordner</h3>
          <div style={{display:'flex', gap:8}}>
            <button className="btn outline sm" onClick={() => setCurrentFolder(null)} title="Root">⬆ Root</button>
            <button className="btn outline sm show-mobile" onClick={()=>setShowFolders(false)}>Schließen</button>
          </div>
        </div>

        <div className="mt-2">
          <FolderTree
            folders={folders}
            selectedId={currentFolder}
            onSelect={(id)=>{ setCurrentFolder(id); setShowFolders(false) }}
            onDropDocIds={onDropDocIds}
            onDropFiles={onDropFiles}
            onDropFolder={onDropFolder}
          />
        </div>

        <div className="mt-3 sidebar-actions">
          <button className="btn ok" onClick={newFolder}>Neuer Ordner</button>
          <button className="btn outline" onClick={renameCur} disabled={currentFolder == null}>Umbenennen</button>
          <button className="btn outline" onClick={moveCur} disabled={currentFolder == null}>Verschieben</button>
          <button className="btn outline" onClick={exportCurrentFolder}>Ordner als ZIP</button>
          <button className="btn crit" onClick={deleteCur} disabled={currentFolder == null}>Löschen</button>
        </div>
      </aside>

      {/* Main */}
      <section
        className={`card main dropzone ${isDraggingOver ? 'over' : ''}`}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      >
        {/* Drop-Overlay */}
        <div className={`dz-overlay ${isDraggingOver ? 'show' : ''}`}>
          <div className="dz-box">
            <div className="dz-title">Dateien hier ablegen</div>
            <div className="dz-sub">Ziel: <strong>{breadcrumb}</strong></div>
          </div>
        </div>

        {/* Status */}
        <div className="screen-reader" aria-live="polite">{flash || ''}</div>
        {flash && <div className="toast">{flash}</div>}

        {/* Header */}
        <header className="main-head">
          <div className="path">
            <button className="btn outline sm show-mobile" onClick={()=>setShowFolders(true)}>☰ Ordner</button>
            <span className="crumb">{breadcrumb}</span>
          </div>
          <div className="filters">
            <label>Monat</label>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              {monthOptions.map(k => <option key={k} value={k}>{k === 'all' ? 'Alle' : k}</option>)}
            </select>

            <div className="view-toggle hide-mobile" role="tablist" aria-label="Darstellung">
              <button
                className={`seg ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                role="tab" aria-selected={viewMode === 'grid'}
              >Grid</button>
              <button
                className={`seg ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                role="tab" aria-selected={viewMode === 'list'}
              >Liste</button>
            </div>

            <label className="toggle-all">
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
              <span>Alle Dateien</span>
            </label>

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

        {/* Aktionen (Desktop) */}
        <div className="toolbar hide-mobile">
          <button className="btn outline" onClick={selectAll} disabled={!docs.length}>Alle wählen</button>
          <button className="btn outline" onClick={clearSel} disabled={!selectedDocs.size}>Auswahl aufheben</button>
          <span className="badge">{selectedDocs.size} gewählt</span>
          <div className="spacer" />
          <button className="btn outline" onClick={moveSelected} disabled={!selectedDocs.size}>Verschieben</button>
          <button className="btn outline" onClick={exportSelected} disabled={!selectedDocs.size}>ZIP</button>
          <button className="btn crit" onClick={deleteSelected} disabled={!selectedDocs.size}>Löschen</button>
        </div>

        {/* Grid / List */}
        {viewMode === 'grid' ? (
          <div className="grid-files">
            {docs.map(renderDocGridCard)}
            {!docs.length && <div className="empty"><p>Keine Dokumente. Dateien wählen oder in den Bereich ziehen.</p></div>}
          </div>
        ) : (
          <div className="list-files">
            <div className="lhead hide-mobile">
              <div className="cell name">Name</div>
              <div className="cell size">Größe</div>
              <div className="cell date">Datum</div>
              <div className="cell path">Pfad</div>
              <div className="cell actions">Aktionen</div>
            </div>
            <div className="lbody">
              {docs.map(renderDocListRow)}
              {!docs.length && <div className="empty"><p>Keine Dokumente.</p></div>}
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {preview && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closePreview}>
            <div className="modal viewer" onClick={(e) => e.stopPropagation()}>
              <header className="viewer-head">
                <div className="vh-left">
                  <strong className="vh-name" title={preview.name}>{preview.name}</strong>
                  <span className="vh-chip">{preview.isPDF ? 'PDF' : (preview.isImage ? 'Bild' : (preview.type || 'Datei'))}</span>
                  <span className="vh-sub">{humanSize(preview.size)}</span>
                </div>
                <div className="vh-actions">
                  {!preview.isPDF && (
                    <>
                      <button className="btn" onClick={zoomOut}>−</button>
                      <button className="btn" onClick={zoomIn}>+</button>
                      <button className="btn" onClick={zoomReset}>100%</button>
                      <button className="btn" onClick={zoomFit}>Einpassen</button>
                    </>
                  )}
                  <a className="btn" href={preview.url} download={preview.name}>Download</a>
                  <a className="btn" href={preview.url} target="_blank" rel="noreferrer">Neu öffnen</a>
                  <button className="btn" onClick={closePreview}>Schließen</button>
                </div>
              </header>
              <div
                className="viewer-scroller"
                onDoubleClick={() => (preview.isPDF ? null : zoomIn())}
                onWheel={(e) => {
                  if (!preview?.isImage) return
                  e.preventDefault()
                  setPreview(p => ({ ...p, zoom: Math.max(0.2, Math.min(6, (p.zoom || 1) + (e.deltaY < 0 ? 0.1 : -0.1))) }))
                }}
              >
                {preview.isImage && (
                  <div className="image-center">
                    <img
                      src={preview.url}
                      alt=""
                      className="viewer-img"
                      onError={() => setPreview(p => ({ ...p, isImage: false }))}
                      style={{ transform: preview.zoom === 'fit' ? 'none' : `scale(${preview.zoom || 1})` }}
                    />
                  </div>
                )}
                {preview.isPDF && (
                  <object data={preview.url} type="application/pdf" width="100%" height="100%">
                    <p>PDF kann nicht angezeigt werden. <a href={preview.url} target="_blank" rel="noreferrer">Hier öffnen</a>.</p>
                  </object>
                )}
                {!preview.isImage && !preview.isPDF && (
                  <div className="other-preview">
                    <div>Keine Vorschau verfügbar.</div>
                    <a className="btn" href={preview.url} download={preview.name}>Download</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

       {/* FAB (Mobile Upload) — ersetzt den bisherigen Button */}
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
    </div>
  )
}
