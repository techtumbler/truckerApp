# CHANGELOG

## Phase 0 – Basis
- Vite/React PWA aufgesetzt
- Routing mit `react-router-dom`
- Globale Styles (`app.css`) für Dark-Theme, hohe Kontraste, Buttons, Cards
- IndexedDB-Setup (`db.js`) mit `idb`
- Key-Value-Store + Grundstruktur

## Sprint 1 – Timer
- `Timer.jsx` mit Start/Stopp Fahrt & Pause, Umschalten
- Dynamische Buttons (OK, Warnung ab 15 Min, Kritisch ab 5 Min Restfahrzeit)
- Fortschrittsbalken, Badges
- Protokoll (History) letzte 50 Fahrten/Pausen
- Speicherung in LocalStorage
- UX-Politur: Vibrate, Shortcuts (D/P/S), Toast/aria-live

## Sprint 2 – Karte / POIs
- `Map.jsx` mit Leaflet
- Geolocation, Standortmarker
- POIs-Store (`pois`): Klick → Name/Kosten/WC/Dusche speichern
- POI-Liste im Panel, löschen
- Panel einklappbar auf Phone, offen auf Desktop
- Panel ARIA: `aria-expanded`, `aria-controls`

## Sprint 3 – Dokumente
- DB v4: Stores `docs`, `folders`
- `docs.js`: addFiles, listDocs, getDoc, removeDoc, updateNote, updateDocFolder, Folder-APIs, Thumbnail für Bilder
- `Docs.jsx` Upload von Fotos/PDFs, Notiz + Ordnerauswahl, Filter nach Monat & Ordner, Ordner-Management (anlegen/umbenennen/löschen)
- Dokumentliste mit Thumbs/Icons, Metadaten (Datum, Größe, Ordner, Notiz)
- Aktionen: Anzeigen, Notiz bearbeiten, Verschieben, Löschen
- Preview-Modal: Zoom (In/Out/Reset/Fit), PDFs im `<object>`, Toolbar inkl. „Neu öffnen“
