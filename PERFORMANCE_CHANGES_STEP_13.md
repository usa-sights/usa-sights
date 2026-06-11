# Performance Step 13 – Hero Stats lazy loading and stats API cache

## Ziel

Dieser Schritt reduziert Arbeit direkt beim ersten Seitenaufruf der Startseite und entlastet gleichzeitig die öffentliche Statistik-API.

Es wurden keine Änderungen an `/admin/media` und keine Änderungen an der Aufruf-/View-Zählung vorgenommen.

## Änderungen

### 1. Hero-Statistiken laden erst bei Bedarf

`components/HomeUserStats.js` lädt `/api/public/stats` nicht mehr sofort beim Mount der Komponente.

Neu:

- Die Quick-Facts behalten ihren Layout-Platz mit Platzhaltern.
- Der Statistik-Request startet erst, wenn der Bereich sichtbar oder fast sichtbar ist.
- Der erste Request wird über `requestIdleCallback` beziehungsweise einen kleinen Fallback verzögert, damit er den Seitenstart nicht blockiert.
- Auto-Refresh startet erst, nachdem Statistiken überhaupt einmal geladen wurden.
- Das Refresh-Intervall wurde von 45 Sekunden auf 120 Sekunden reduziert.

### 2. Statistik-API mit In-Memory-Cache

`app/api/public/stats/route.js` nutzt nun zusätzlich zum CDN-/Browser-Cache einen serverseitigen Kurzcache:

- 5 Minuten frischer In-Memory-Cache
- parallele Requests werden dedupliziert
- bis zu 30 Minuten stale Fallback, falls eine kurzfristige DB-Abfrage fehlschlägt
- Fehlerantworten bleiben `no-store`

### 3. Count-Abfragen minimaler

Die Statistik-Counts nutzen nun `select('id', { count: 'exact', head: true })` statt `select('*', ...)`.

## Erwarteter Effekt

- weniger Netzwerk- und DB-Arbeit beim Startseitenaufruf
- stabilere erste Darstellung der Hero-Quick-Facts
- weniger Last bei mehreren gleichzeitigen Besuchern
- geringere Konkurrenz zu wichtigeren Initial-Ressourcen wie HTML, CSS, Hero und Navigation

## Prüfung

Erfolgreich ausgeführt:

```bash
npm ci --ignore-scripts
npm test
```

`npm run build` wurde zusätzlich mit Dummy-ENV-Werten gestartet. In dieser Umgebung schlug er wegen einer lokal unvollständigen Next.js-Installation fehl:

```text
ENOENT: no such file or directory, open 'node_modules/next/dist/build/polyfills/polyfill-nomodule.js'
```

Das ist kein Syntaxfehler aus dieser Änderung. `node_modules` und `.next` sind nicht Teil des ZIP-Pakets.
