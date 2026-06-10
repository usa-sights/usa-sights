# Performance Changes – Step 9

Fokus: öffentliches User-Ranking schneller machen, ohne Admin-Media oder Aufrufzählungen zu verändern.

## Änderungen

### 1. Public Ranking API entlastet

`/api/public/user-ranking` liest für die normale Tabellenansicht jetzt nur noch die minimal notwendigen Spalten:

- Profile: `id,name`
- POIs: `id,created_by`
- Bilder: `id,uploaded_by`
- Links: `id,submitted_by`
- Reviews: `id,user_id`
- Replies: `id,user_id`

Vorher wurden auch Titel, Slugs, verschachtelte POI-Daten, Texte und weitere Detailfelder schon für die normale Übersicht geladen.

### 2. Serverseitiger In-Memory-Cache

Die aggregierte Ranking-Basis wird für 5 Minuten serverseitig zwischengespeichert und parallele Requests werden dedupliziert.

Details pro Nutzer/Content-Typ werden separat kurz für 60 Sekunden gecacht.

### 3. Details erst bei Bedarf

Detaildaten wie POI-Titel, Links, Review-Texte oder Bild-Thumbnails werden erst abgefragt, wenn ein Nutzer im Ranking auf eine konkrete Zahl klickt.

### 4. Public Cache-Control

Die Ranking-API gibt nun öffentliche Cache-Header zurück:

- Übersicht: `s-maxage=300`
- Detailansicht: `s-maxage=60`
- Fehler: weiterhin `no-store`

### 5. Client Cache-Buster entfernt

`UserRankingClient` hängt kein `t=Date.now()` mehr an Ranking-Requests und erzwingt kein `cache: 'no-store'` mehr.

### 6. Ranking-Seite kurz revalidierbar

`/ranking` nutzt jetzt `revalidate = 60` und erzwingt nicht mehr bei jedem Seitenaufruf `noStore()`.

## Bewusst nicht geändert

- Keine Änderung an `/admin/media`.
- Keine Änderung an `/api/poi-view` oder der Aufruf-/View-Zählung.
- Keine sichtbare Änderung an Ranking-Design oder Ranking-Funktionalität.

## Prüfung

- `npm ci --ignore-scripts`: erfolgreich
- `npm test`: erfolgreich, aktuell ohne vorhandene Tests
- `npm run build`: Produktionserstellung kompiliert erfolgreich, wurde in dieser Umgebung später bei `Collecting page data` wegen Timeout beendet.
