# Performance Changes – Step 11

## Ziel

Öffentliche Seiten sollen schneller starten, indem schwerere Auth-/Supabase-Client-Arbeit nicht mehr direkt im initialen Client-Pfad liegt.

Dieser Schritt verändert bewusst nichts an:

- `/admin/media`
- Aufruf-/View-Zählung
- POI-Datenmodell
- sichtbarem Design

## Änderungen

### 1. NavBar lädt Supabase Auth verzögert

`components/NavBar.js` importiert `createBrowserSupabaseClient` nicht mehr statisch.

Vorher wurde der Supabase-Browser-Client direkt mit der Navigation in den initialen Client-Code gezogen.

Jetzt wird der Supabase-Client dynamisch importiert und die Session-/Profilprüfung per `requestIdleCallback` beziehungsweise kleinem Timeout nach hinten geschoben.

Dadurch können öffentliche Besucher zuerst Inhalt und Navigation sehen, bevor Auth-/Profil-Checks laufen.

### 2. Public App Settings bleiben früh verfügbar

Die öffentliche Ranking-Sichtbarkeit wird weiterhin über den bestehenden deduplizierten Public-App-Settings-Loader geladen.

Die Auth-Arbeit wurde getrennt, damit Ranking-/Settings-Logik nicht auf Supabase Auth warten muss.

### 3. Logout bleibt kompatibel

Beim Logout wird der Supabase-Client bei Bedarf ebenfalls dynamisch geladen.

### 4. MaintenanceGate lädt Supabase nur bei aktivem Wartungsmodus

`components/MaintenanceGate.js` importiert den Supabase-Browser-Client nicht mehr statisch.

Im Normalfall `maintenanceMode !== true` werden keine Supabase-Session- oder Profilabfragen ausgelöst.

Nur wenn der Wartungsmodus wirklich aktiv ist, wird geprüft, ob der Besucher Admin ist.

## Erwartete Wirkung

- weniger initiales Client-JavaScript auf öffentlichen Seiten
- weniger sofortige Auth-/Profil-Arbeit beim Seitenstart
- bessere gefühlte Geschwindigkeit auf Start-, Explore-, Kategorie- und POI-Seiten
- kein Einfluss auf Admin-Media und keine Änderung an View-Zählungen

## Prüfung

Ausgeführt:

```bash
npm ci --ignore-scripts
npm test
```

`npm run build` wurde gestartet und ohne direkten Syntaxfehler kompiliert, wurde in dieser Umgebung aber wegen Timeout während des Next-Builds beendet.
