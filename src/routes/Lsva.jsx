// src/routes/Lsva.jsx
import React, { useEffect, useState } from 'react'
import { kv } from '../lib/db'
import { periodIdFrom, dueDateFor } from '../lib/dates'

export default function Lsva(){
  const [period, setPeriod] = useState(null)

  useEffect(()=>{
    const id = periodIdFrom(new Date())
    setPeriod({
      id,
      dueDate: dueDateFor(id),
      status: 'open',
      steps: {
        emotach: false,
        chipcardPC: false,
        submitToEZV: false,
        archiveProtocol: false
      },
      docs: []
    })
  },[])

  if(!period) return null
  const due = new Date(period.dueDate).toLocaleDateString()
  return (
    <section className="card">
      <h1>LSVA-Helfer</h1>
      <p>Nächste Fälligkeit: <strong>{due}</strong> – Status: <strong>{period.status}</strong></p>
      <ul>
        <li><input type="checkbox" /> Emotach auslesen</li>
        <li><input type="checkbox" /> Chipkarte am PC einlesen</li>
        <li><input type="checkbox" /> An EZV übermitteln</li>
        <li><input type="checkbox" /> Protokoll archivieren</li>
      </ul>
      <button className="btn primary">Dokument hinzufügen</button>
    </section>
  )
}
