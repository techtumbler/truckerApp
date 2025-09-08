import React, { useEffect, useMemo, useRef, useState } from 'react'
import { addFiles, listDocs, getDoc, removeDoc, updateNote, humanSize } from '../lib/docs'

export default function Docs(){
  const [docs, setDocs] = useState([])
  const [filterMonth, setFilterMonth] = useState('all') // 'all' | 'YYYY-MM'
  const [preview, setPreview] = useState(null) // { id, url, name, type }
  const fileRef = useRef(null)
  const noteRef = useRef(null)

  useEffect(()=>{ refresh() }, [])

  async function refresh(){
    const d = await listDocs()
    setDocs(d)
  }

  async function onPick(e){
    const files = Array.from(e.target.files || [])
    if(files.length===0) return
    const note = noteRef.current?.value || ''
    await addFiles(files, { note })
    e.target.value = ''
    if(noteRef.current) noteRef.current.value = ''
    await refresh()
  }

  async function openPreview(id){
    const rec = await getDoc(id)
    if(!rec) return
    const url = URL.createObjectURL(rec.blob)
    setPreview({ id: rec.id, url, name: rec.name, type: rec.type, isImage: rec.isImage, isPDF: rec.isPDF })
  }

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

  // Filter
  const monthOptions = useMemo(()=>{
    const keys = Array.from(new Set(docs.map(d=>d.monthKey))).sort().reverse()
    return keys
  }, [docs])

  const filtered = useMemo(()=>{
    return docs.filter(d => filterMonth==='all' ? true : d.monthKey===filterMonth)
  }, [docs, filterMonth])

  return (
    <section className="card">
      <h1>Dokumente</h1>
      <p style={{color:'var(--muted)'}}>Fotos oder PDFs hinzufügen. Auf dem Smartphone öffnet sich die Kamera automatisch.</p>

      {/* Upload */}
      <div className="card">
        <div className="docs-upload">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            onChange={onPick}
          />
          <input ref={noteRef} className="input" type="text" placeholder="Optional: Notiz für diese Auswahl" />
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={()=>fileRef.current?.click()}>📷 Foto / 📄 Datei wählen</button>
          <button className="btn" onClick={()=>{ if(noteRef.current) noteRef.current.value='' }}>Notiz leeren</button>
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
          <span className="muted">Anzahl: {filtered.length}</span>
        </div>
      </div>

      {/* Liste */}
      <div className="card">
        {filtered.length===0 ? (
          <div className="table-empty">Keine Dokumente im gewählten Zeitraum.</div>
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
                  <div className="doc-sub">{new Date(d.createdAt).toLocaleString()} • {humanSize(d.size)}</div>
                  {d.note ? <div className="doc-note">📝 {d.note}</div> : null}
                </div>
                <div className="btn-row">
                  <button className="btn" onClick={()=>openPreview(d.id)}>👁️ Anzeigen</button>
                  <button className="btn" onClick={()=>onEditNote(d.id)}>✏️ Notiz</button>
                  <button className="btn" onClick={()=>onDelete(d.id)}>🗑️ Löschen</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Vorschau-Modal */}
      {preview && (
        <div className="modal" role="dialog" aria-modal="true" onClick={()=>{ URL.revokeObjectURL(preview.url); setPreview(null) }}>
          <div className="modal-body" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-head">
              <strong>{preview.name}</strong>
              <button className="btn" onClick={()=>{ URL.revokeObjectURL(preview.url); setPreview(null) }}>Schließen</button>
            </div>
            <div className="modal-content">
              {preview.isImage ? (
                <img src={preview.url} alt={preview.name} />
              ) : preview.isPDF ? (
                <iframe title="PDF Vorschau" src={preview.url} style={{width:'100%',height:'70vh',border:'0',background:'white'}} />
              ) : (
                <p>Dateityp wird nicht direkt angezeigt.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
