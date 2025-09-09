// src/lib/FolderTree.jsx
import React, { useMemo, useState } from 'react'
import { buildFolderTree } from './docs'

export default function FolderTree({ folders, selectedId, onSelect, onDropDocIds, onDropFiles, onDropFolder }) {
  const roots = useMemo(() => buildFolderTree(folders), [folders])

  const [rootHover, setRootHover] = useState(false)
  function allowDrop(e) {
    if (
      e.dataTransfer.types.includes('application/x-trucker-doc-ids') ||
      e.dataTransfer.types.includes('application/x-trucker-folder-id') ||
      e.dataTransfer.types.includes('Files')
    ) e.preventDefault()
  }
  function dropOnRoot(e) {
    e.preventDefault()
    setRootHover(false)
    const folderId = null
    const folderDrag = e.dataTransfer.getData('application/x-trucker-folder-id')
    if (folderDrag) { onDropFolder?.(folderDrag, folderId); return }
    const idsJson = e.dataTransfer.getData('application/x-trucker-doc-ids')
    if (idsJson) { try { onDropDocIds?.(folderId, JSON.parse(idsJson)) } catch {} ; return }
    if (e.dataTransfer.files && e.dataTransfer.files.length) onDropFiles?.(folderId, Array.from(e.dataTransfer.files))
  }

  return (
    <div className="tree">
      <div
        className={`tree-row ${selectedId == null ? 'sel' : ''} ${rootHover ? 'drop' : ''}`}
        onClick={() => onSelect(null)}
        onDragOver={(e)=>{allowDrop(e); setRootHover(true)}}
        onDragLeave={()=>setRootHover(false)}
        onDrop={dropOnRoot}
        role="button"
      >
        <span className="tree-spacer" />
        <span className="tree-name">📂 Root</span>
        {rootHover && <span className="drop-hint">Ablegen in „Root“</span>}
      </div>

      <TreeNodes
        nodes={roots}
        selectedId={selectedId}
        onSelect={onSelect}
        onDropDocIds={onDropDocIds}
        onDropFiles={onDropFiles}
        onDropFolder={onDropFolder}
        depth={0}
      />
    </div>
  )
}

function TreeNodes({ nodes, selectedId, onSelect, onDropDocIds, onDropFiles, onDropFolder, depth }) {
  return (
    <ul className="tree-ul">
      {nodes.map(n => (
        <TreeNode
          key={n.id}
          node={n}
          selectedId={selectedId}
          onSelect={onSelect}
          onDropDocIds={onDropDocIds}
          onDropFiles={onDropFiles}
          onDropFolder={onDropFolder}
          depth={depth}
        />
      ))}
    </ul>
  )
}

function TreeNode({ node, selectedId, onSelect, onDropDocIds, onDropFiles, onDropFolder, depth }) {
  const [open, setOpen] = useState(true)
  const [hover, setHover] = useState(false)
  const isSel = selectedId === node.id
  const hasChildren = !!(node.children && node.children.length)

  function onDragStartFolder(e) {
    e.dataTransfer.setData('application/x-trucker-folder-id', node.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e) {
    if (
      e.dataTransfer.types.includes('application/x-trucker-doc-ids') ||
      e.dataTransfer.types.includes('application/x-trucker-folder-id') ||
      e.dataTransfer.types.includes('Files')
    ) { e.preventDefault(); setHover(true) }
  }
  function onDragLeave() { setHover(false) }
  function onDrop(e) {
    e.preventDefault(); setHover(false)
    const folderDrag = e.dataTransfer.getData('application/x-trucker-folder-id')
    if (folderDrag) { onDropFolder?.(folderDrag, node.id); return }
    const idsJson = e.dataTransfer.getData('application/x-trucker-doc-ids')
    if (idsJson) { try { onDropDocIds?.(node.id, JSON.parse(idsJson)) } catch {} ; return }
    if (e.dataTransfer.files && e.dataTransfer.files.length) onDropFiles?.(node.id, Array.from(e.dataTransfer.files))
  }

  return (
    <li>
      <div
        className={`tree-row ${isSel ? 'sel' : ''} ${hover ? 'drop' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node.id)}
        onDragStart={onDragStartFolder}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        draggable
        role="button"
        title="Ziehen, um Ordner zu verschieben"
      >
        {hasChildren ? (
          <button
            className="tree-toggle"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
            aria-label={open ? 'Zuklappen' : 'Aufklappen'}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : <span className="tree-spacer" />}
        <span className="tree-name">📁 {node.name}</span>
        {hover && <span className="drop-hint">Ablegen in „{node.name}“</span>}
      </div>
      {hasChildren && open && (
        <TreeNodes
          nodes={node.children}
          selectedId={selectedId}
          onSelect={onSelect}
          onDropDocIds={onDropDocIds}
          onDropFiles={onDropFiles}
          onDropFolder={onDropFolder}
          depth={depth + 1}
        />
      )}
    </li>
  )
}
