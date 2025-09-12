# ROADMAP

> Stand: Phase 0–3 sind umgesetzt (Basis, Dokumente/Explorer, Karte/POIs, Dev/Preview-Konfiguration).
> Diese Roadmap fasst umgesetzte Meilensteine zusammen und listet die nächsten optionalen Ausbauten.

## ✅ Erreichte Meilensteine

### Phase 0 – Basis
- Vite/React PWA Grundgerüst
- Routing mit `react-router-dom`
- Dark-Theme-Styles (`styles/app.css`)
- IndexedDB Setup mit `idb` (siehe `src/lib/db.js`)
- Key-Value-Store / Grundstruktur

### Phase 1 – Timer (Grundfunktion)
- `Timer.jsx` mit Start/Stopp Fahrt & Pause
- Fortschrittsanzeige, Badges, History (LocalStorage)

### Phase 2 – Dokumente/Explorer
- Grid↔List Toggle (Segment-Control)
- „Alle Dateien” automatisch Listenansicht, ohne Thumbnails (nur 📄 + Pfad)
- Drag&Drop: Dateien ↔ Ordnerbaum, Ordner ↔ Ordner (inkl. Drop auf Root)
- Warn-/Bestätigungsdialog bei Drop auf Root
- Upload-Verbesserungen: große Dropzone-Overlay, Multi-Select, FAB „+” (Mobile, `capture="environment"`)
- Mehrfachaktionen: Verschieben, ZIP, Löschen
- ZIP-Export: Auswahl (`zipDocs(...)`), Ordner rekursiv (`zipFolderDeep(...)`)
- Viewer: Bild contain + Wheel/DblClick-Zoom, 100%/Fit, Download/Neu öffnen; PDF `<object>`-Fallback; ESC schliesst
- A11y/Feedback: `aria-live` Toasts, Vibrationen (Mobile)
- Mobile-Optimierungen: Sidebar-Drawer, Bottom-Actionbar, „stacked” Liste, FAB Safe-Area
- Overflow-/Layout-Fixes: breite Bilder laufen nicht aus

### Phase 3 – Karte / POIs
- `src/lib/pois.js` (Felder: id, name, lat, **lon**, kosten, wc, dusche, created)
- Liste sortiert `created desc`
- `src/routes/Map.jsx`: Fallback-Center (Frankfurt), HTTPS-Geolocation-Fallback, `invalidateSize` (Mount/Resize/Panel), Marker-Replace, Popup-Delete, Quick-Add-Dialog, stabile Inline-Höhe

### Dev/Preview
- `vite.config.js`: `https: false`, `host: true`, `port: 5173`
- `package.json` Scripts: `dev`, `build`, `preview` passend gesetzt

## 🔜 Nächste optionale Ausbauten
- **Drag&Drop-Upload** (weitere Verfeinerungen): Fortschrittsanzeige pro Datei, Fehlerliste nach Upload
- **Mehrfachverschieben** verbessern: Bulk-Operationen im Baum inkl. Tastenkürzel
- **ZIP-Export** erweitern: Fortschritt, Grössenlimit-Warnungen, Queue
- **Verbesserte Modals**: einheitliche, zugängliche Confirm/Prompt-Komponenten
- **CSV-Export für Timer-Log**: Export/Import, Option für Zeitfilter
- **Kontextmenü/Inline-Rename**: Dateien/Ordner direkt umbenennen
- **Bottom-Sheet-Upload-Quelle**: Kamera / Datei / Scanner-Auswahl
- **POI-Detailformular**: als Sheet (statt Prompt), Validierung & Edit
- **Finale SVG-Logo-Integration** (siehe TODO)

> Hinweis: Reihenfolge flexibel nach Bedarf. Aktuell ist die Basis stabil; Fokus kann auf UX-Politur und Export/Import liegen.
