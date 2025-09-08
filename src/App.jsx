import React from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

function TopNav(){
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div className="brand">
          <img src="/icons/logo.svg" alt="Trucker App" width="28" height="28" />
          <span>Trucker&nbsp;App</span>
        </div>
        <nav className="nav-top">
          <NavLink to="/" end>⏱️ Timer</NavLink>
          <NavLink to="/map">🅿️ Karte</NavLink>
          <NavLink to="/docs">📄 Dokumente</NavLink>
          <NavLink to="/lsva">🇨🇭 LSVA</NavLink>
        </nav>
      </div>
    </header>
  )
}

function BottomNav(){
  const { pathname } = useLocation()
  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  return (
    <nav className="nav-bottom" aria-label="Hauptnavigation unten">
      <NavLink to="/" end className={isActive('/') ? 'active' : ''}>
        <span className="icon">⏱️</span><span className="label">Timer</span>
      </NavLink>
      <NavLink to="/map" className={isActive('/map') ? 'active' : ''}>
        <span className="icon">🅿️</span><span className="label">Karte</span>
      </NavLink>
      <NavLink to="/docs" className={isActive('/docs') ? 'active' : ''}>
        <span className="icon">📄</span><span className="label">Dok.</span>
      </NavLink>
      <NavLink to="/lsva" className={isActive('/lsva') ? 'active' : ''}>
        <span className="icon">🇨🇭</span><span className="label">LSVA</span>
      </NavLink>
    </nav>
  )
}

export default function App(){
  return (
    <div className="app-shell">
      {/* Top-Nav: sichtbar ab Tablet/Desktop */}
      <TopNav/>
      <main className="container main-content">
        <Outlet/>
      </main>
      {/* Bottom-Nav: nur auf Smartphones sichtbar */}
      <BottomNav/>
    </div>
  )
}
