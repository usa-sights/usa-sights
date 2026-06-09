# Performance Changes – Schritt 8

Fokus: POI-Detailseiten und Bewertungsdaten schlanker machen, ohne sichtbare Funktionen zu verändern.

## Änderungen

### 1. `/api/poi-public` erzeugt keine signierten Bild-URLs mehr vorab

Der POI-Detail-Endpunkt hat bisher für jedes Galerie-Bild Thumbnail- und Original-URLs sofort signiert. Das ist teuer, besonders bei POIs mit vielen Bildern.

Neu:

- Der Endpunkt liefert Bildpfade (`thumb_path`, `original_path`) statt sofort signierter URLs.
- Die öffentlichen POI-Daten bekommen einen kurzen CDN-/SWR-Cache:
  - `public, s-maxage=60, stale-while-revalidate=300`
- Bei gezielten Aktualisierungen kann der Client mit `fresh=1` weiterhin ungecacht laden.

### 2. Galerie-Bilder werden erst bei Bedarf signiert

`OptimizedImage` kann jetzt optional Supabase-Storage-Pfade signieren und nutzt dafür einen clientseitigen Cache.

Die POI-Galerie lädt dadurch:

- für die normale Galerie zuerst optimierte Thumbnail-Varianten
- Original-/Großansicht erst beim Öffnen der Lightbox
- transformierte URLs mit passender Größe/Qualität

### 3. Bewertungsdaten werden cachebar

`/api/poi-reviews` liefert öffentliche Daten und wird jetzt kurz gecacht:

- `public, s-maxage=60, stale-while-revalidate=300`
- Nach neuer Bewertung/Antwort wird mit `fresh=1` ungecached aktualisiert.

### 4. Cache-Buster auf POI-Detailseiten entfernt

Die öffentlichen POI-Detail-Requests und Review-Requests nutzen nicht mehr standardmäßig `Date.now()` und `no-store`.

## Nicht geändert

- Keine Änderung an Design, Layout oder sichtbaren Inhalten.
- Keine Änderung an Admin-Media.
- Keine Änderung an der View-Tracking-Logik selbst.

## Hinweis zu Aufrufzählungen

Die vorhandene Aufrufzählung hängt weiterhin davon ab, dass das SQL-Skript `sql/POI_VIEW_STATS_OPTIONAL.sql` in Supabase ausgeführt wurde. Wenn Aufrufe nicht gezählt werden, bitte dieses SQL im Supabase SQL Editor ausführen und danach eine POI-Detailseite öffnen.

## Erwarteter Effekt

- schnellere POI-Detailseiten
- weniger Supabase-Storage-Signing pro Detailseitenaufruf
- bessere Cache-Treffer für öffentliche POI- und Bewertungsdaten
- weniger Bandbreite bei großen Galerien, weil Originalbilder erst in der Lightbox geladen werden
