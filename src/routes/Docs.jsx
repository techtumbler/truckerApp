import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  addFiles, listDocs, getDoc, removeDoc, updateNote, updateDocFolder, humanSize,
  listFolders, addFolder, renameFolder, removeFolder
} from '../lib/docs'

export default function Docs(){
  const [docs, setDocs] = useState([])
  const [folders, setFolders] = useState([])
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterFolder, setFilterFolder] = useState('all') // 'all' | folderId | 'none'
  const [preview, setPreview] = useState(null) // { id, url, name, type, isImage, isPDF, zoom }
  const fileRef = useRef(null)
  const noteRef = useRef(null)
  const folderSelectRef = useRef(null)

  useEffect(()=>{ refresh() }, [])
  async function refresh(){
    setDocs(await listDocs())
    setFolders(await listFolders())
  }

  async function onPick(e){
    const files = Array.from(e.target.files || [])
    if(files.length===0) return
    const note = noteRef.current?.value || ''
    const folderId = folderSelectRef.current?.value && folderSelectRef.current.value!=='all' ? folderSelectRef.current.value : null
    await addFiles(files, { note, folderId })
    e.target.value = ''
    if(noteRef.current) noteRef.current.value = ''
    await refresh()
  }

  async function openPreview(id){
    const rec = await getDoc(id)
    if(!rec) return
    const url = URL.createObjectURL(rec.blob)
    setPreview({ id: rec.id, url, name: rec.name, type: rec.type, isImage: rec.isImage, isPDF: rec.isPDF, zoom: 1 })
  }

  function closePreview(){
    if(preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  // Zoom controls (für Bilder; bei PDF disabled)
  function zoomIn(){ setPreview(p => p ? { ...p, zoom: Math.min(4, (p.zoom||1) + 0.25) } : p) }
  function zoomOut(){ setPreview(p => p ? { ...p, zoom: Math.max(0.25, (p.zoom||1) - 0.25) } : p) }
  function zoomReset(){ setPreview(p => p ? { ...p, zoom: 1 } : p) }
  function zoomFit(){ setPreview(p => p ? { ...p, zoom: 'fit' } : p) } // 'fit' = contain (CSS), sonst scale()

  async function onEditNote(id){
    const current = docs.find(d=>d.id===id)?.note || ''
    const next = window.prompt('Notiz bearbeiten:', current)
    if(next===null) return
    await updateNote(id, next)
    refresh()
  }
  async function onDelete(id){
    if(!confirm('Dieses Dokument wirklich löschen?')) return
    await removeDoc(id)
    refresh()
  }

  async function onCreateFolder(){
    const name = window.prompt('Neuer Ordnername:')
    if(!name) return
    await addFolder(name)
    refresh()
  }
  async function onRenameFolder(id){
    const current = folders.find(f=>f.id===id)?.name || ''
    const name = window.prompt('Ordner umbenennen:', current)
    if(name===null) return
    await renameFolder(id, name)
    refresh()
  }
  async function onRemoveFolder(id){
    if(!confirm('Ordner löschen? (Dokumente bleiben erhalten)')) return
    await removeFolder(id)
    if(filterFolder===id) setFilterFolder('all')
    refresh()
  }
  async function onMoveDoc(id){
    const options = [{id:'none', name:'(Kein Ordner)'}, ...folders]
    const names = options.map((o,i)=> `${i}: ${o.name}`).join('\n')
    const pick = window.prompt(`Dokument verschieben in:\n${names}\n\nGib die Nummer ein:`,'0')
    if(pick===null) return
    const idx = parseInt(pick,10)
    if(Number.isNaN(idx) || idx<0 || idx>=options.length) return
    const folderId = options[idx].id==='none' ? null : options[idx].id
    await updateDocFolder(id, folderId)
    refresh()
  }

  // Filter
  const monthOptions = useMemo(()=>{
    const keys = Array.from(new Set(docs.map(d=>d.monthKey))).sort().reverse()
    return keys
  }, [docs])

  const filtered = useMemo(()=>{
    return docs.filter(d => {
      const okMonth = filterMonth==='all' ? true : d.monthKey===filterMonth
      const okFolder = filterFolder==='all' ? true : (filterFolder==='none' ? !d.folderId : d.folderId===filterFolder)
      return okMonth && okFolder
    })
  }, [docs, filterMonth, filterFolder])

  return (
    <section className="card">
      <h1>Dokumente</h1>
      <p style={{color:'var(--muted)'}}>Fotos oder PDFs hinzufügen. Ordner helfen bei der Struktur (z. B. „Fahrzeug A“, „Belege“).</p>

      {/* Upload + Ordnerzuordnung */}
      <div className="card">
        <div className="docs-upload">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" multiple onChange={onPick}/>
          <input ref={noteRef} className="input" type="text" placeholder="Optional: Notiz für diese Auswahl" />
          <select ref={folderSelectRef} className="select">
            <option value="all">(Ohne Ordner)</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={()=>fileRef.current?.click()}>📷 Foto / 📄 Datei wählen</button>
          <button className="btn" onClick={()=>{ if(noteRef.current) noteRef.current.value='' }}>Notiz leeren</button>
          <button className="btn" onClick={onCreateFolder}>📁 Ordner anlegen</button>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="docs-filter">
          <label>Monat:</label>
          <select className="select" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
            <option value="all">Alle</option>
            {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <label>Ordner:</label>
          <select className="select" value={filterFolder} onChange={e=>setFilterFolder(e.target.value)}>
            <option value="all">Alle</option>
            <option value="none">(Ohne Ordner)</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <span className="muted">Anzahl: {filtered.length}</span>
        </div>

        {/* Ordner-Management (klein) */}
        {folders.length>0 && (
          <div className="folders-inline">
            {folders.map(f=>(
              <span className="folder-chip" key={f.id} title="Ordner bearbeiten">
                📁 {f.name}
                <button className="chip-btn" onClick={()=>onRenameFolder(f.id)} title="Umbenennen">✏️</button>
                <button className="chip-btn" onClick={()=>onRemoveFolder(f.id)} title="Löschen">🗑️</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="card">
        {filtered.length===0 ? (
          <div className="table-empty">Keine Dokumente im gewählten Zeitraum/Ordner.</div>
        ) : (
          <div className="docs-grid">
            {filtered.map(d=>(
              <article className="doc-card" key={d.id}>
                <div className="doc-thumb" onClick={()=>openPreview(d.id)} role="button" title="Vorschau öffnen">
                  {d.isImage && d.thumbDataUrl ? (
                    <img src={d.thumbDataUrl} alt={d.name} />
                  ) : d.isPDF ? (
                    <div className="doc-pdf">PDF</div>
                  ) : (
                    <div className="doc-file">FILE</div>
                  )}
                </div>
                <div className="doc-meta">
                  <div className="doc-name" title={d.name}>{d.name}</div>
                  <div className="doc-sub">
                    {new Date(d.createdAt).toLocaleString()} • {humanSize(d.size)}
                    {d.folderId ? <> • 📁 {folders.find(f=>f.id===d.folderId)?.name || '—'}</> : <> • (ohne Ordner)</>}
                  </div>
                  {d.note ? <div className="doc-note">📝 {d.note}</div> : null}
                </div>
                <div className="btn-row">
                  <button className="btn" onClick={()=>openPreview(d.id)}>👁️ Anzeigen</button>
                  <button className="btn" onClick={()=>onEditNote(d.id)}>✏️ Notiz</button>
                  <button className="btn" onClick={()=>onMoveDoc(d.id)}>🚚 Verschieben</button>
                  <button className="btn" onClick={()=>onDelete(d.id)}>🗑️ Löschen</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Vorschau-Modal mit Zoom-Toolbar */}
      {preview && (
        <div className="modal" role="dialog" aria-modal="true" onClick={closePreview}>
          <div className="modal-body" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-head">
              <strong>{preview.name}</strong>
              <div className="zoombar">
                <button className="btn" onClick={zoomOut} disabled={preview.isPDF}>−</button>
                <button className="btn" onClick={zoomIn} disabled={preview.isPDF}>+</button>
                <button className="btn" onClick={zoomReset} disabled={preview.isPDF}>100%</button>
                <button className="btn" onClick={zoomFit}>Einpassen</button>
                <a className="btn" href={preview.url} target="_blank" rel="noreferrer">↗️ Neu öffnen</a>
                <button className="btn" onClick={closePreview}>Schließen</button>
              </div>
            </div>
            <div className="modal-content center">
              {preview.isImage ? (
                <img
                  className={`preview-media ${preview.zoom==='fit' ? 'fit' : ''}`}
                  src={preview.url}
                  alt={preview.name}
                  style={preview.zoom!=='fit' ? { transform:`scale(${preview.zoom||1})`, transformOrigin:'center center' } : undefined}
                />
              ) : preview.isPDF ? (
                <iframe
                  title="PDF Vorschau"
                  src={preview.url}
                  className="preview-frame"
                />
              ) : (
                <p>Dieser Dateityp kann nicht direkt angezeigt werden.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
