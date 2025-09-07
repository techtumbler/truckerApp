// src/App.jsx
import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'

export default function App(){
  return (
    <div>
      <nav className="nav container">
        <NavLink to="/" end>⏱️ Timer</NavLink>
        <NavLink to="/map">🅿️ Karte</NavLink>
        <NavLink to="/docs">📄 Dokumente</NavLink>
        <NavLink to="/lsva">🇨🇭 LSVA</NavLink>
      </nav>
      <main className="container">
        <Outlet/>
      </main>
    </div>
  )
}
