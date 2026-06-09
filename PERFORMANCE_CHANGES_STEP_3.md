# Performance-Änderungen Schritt 3

Ziel: Doppelte App-Settings-/Maintenance-Requests auf öffentlichen Seiten reduzieren, ohne Navigation, Wartungsmodus oder Admin-Toggles sichtbar zu verändern.

## Änderungen

- Neue Client-Hilfsdatei `utils/publicAppSettings.js`
  - dedupliziert gleichzeitige Requests an `/api/public/app-settings`
  - hält einen kurzen In-Memory-Cache passend zur API-Cache-Zeit
  - kann nach Admin-Änderungen gezielt neu laden oder lokal aktualisiert werden

- Neue Client-Hilfsdatei `utils/adminAppSettings.js`
  - dedupliziert Admin-Settings-GETs im Admin-Rail
  - verhindert, dass Ranking- und Wartungs-Toggle direkt hintereinander denselben Settings-Endpunkt anfragen

- `components/NavBar.js`
  - nutzt den gemeinsamen Public-App-Settings-Loader
  - nutzt den gemeinsamen Admin-App-Settings-Loader
  - entfernt Cache-Buster von Admin-Settings-POSTs, da POST ohnehin nicht gecacht wird
  - aktualisiert die lokalen Settings-Caches nach erfolgreichem Ranking-/Wartungsmodus-Toggle

- `components/MaintenanceGate.js`
  - nutzt den gemeinsamen Public-App-Settings-Loader
  - überspringt Maintenance-Checks auf Admin-, Login- und Register-Routen, weil diese ohnehin ausgenommen sind
  - vermeidet im Normalfall zusätzliche Supabase-Session- und Profil-Requests auf öffentlichen Seiten, solange der Wartungsmodus deaktiviert ist
  - prüft Admin-Bypass erst dann, wenn Maintenance wirklich aktiv ist

## Erwarteter Effekt

- Weniger doppelte Requests beim ersten Seitenaufruf
- Weniger Auth-/Profil-Abfragen auf öffentlichen Seiten
- Schnellere Hydration/ruhigere Initialphase im Browser
- Weniger Last auf `/api/public/app-settings`, `/api/admin/app-settings` und `/api/me/profile`

## Prüfung

- `npm test` erfolgreich, aktuell ohne vorhandene Tests
- `npm run build` kompiliert erfolgreich, bricht in der lokalen Prerender-Phase erwartungsgemäß ab, weil keine echten Supabase-Environment-Variablen gesetzt sind (`supabaseUrl is required`).

## Hinweis

Die Funktionalität bleibt gleich: Ranking-Link, Wartungsmodus, Admin-Bypass und Admin-Toggles bleiben erhalten. Die Änderung betrifft primär Request-Deduplizierung und das Vermeiden unnötiger Abfragen im Standardfall.
