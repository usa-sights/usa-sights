# Performance Changes – Step 6

## Fokus

Dieser Schritt behebt eine konkrete Ursache dafür, dass in `/admin/media` nicht alle Bild-Thumbnails angezeigt wurden, und reduziert gleichzeitig unnötige Arbeit in der Medienverwaltung.

Wichtig: Es wurde keine Aufruf-/View-Zählung ergänzt oder verändert.

## Änderungen

### 1. Batch-Signing für Bild-URLs repariert

`/api/images/signed-urls` hat bisher maximal 24 Pfade pro Request verarbeitet. Die Medienverwaltung lädt aber je nach Seitengröße deutlich mehr Pfade, weil pro Bild Thumbnail- und Originalpfad signiert werden können.

Neu:

- bis zu 500 Pfade pro Request
- Supabase-Signing in Batches zu je 100 Pfaden
- deduplizierte Pfade bleiben erhalten
- saubere Fehlerantwort mit `no-store`

Das sollte verhindern, dass bei `/admin/media` nur die ersten Bilder einer Seite sichtbar sind.

### 2. `/admin/media` zeigt standardmäßig alle Status

Die Medienverwaltung war standardmäßig auf `pending` gefiltert. Dadurch konnten bereits freigegebene oder abgelehnte Bilder wie „nicht geladen“ wirken.

Neu:

- Standardfilter: `alle Status`
- Statusfilter enthält zusätzlich:
  - `pending`
  - `approved`
  - `rejected`
- URLs wie `/admin/media?status=pending` funktionieren weiterhin.

### 3. Weniger doppelte Medien-Requests

Beim Statuswechsel und Initialisieren wurde unnötig direkt und über Effects geladen. Das ist jetzt vereinheitlicht.

### 4. Vorschau nutzt Originalbild bevorzugt

Die große Medienvorschau verwendet jetzt bevorzugt die Original-URL, wenn sie verfügbar ist. Thumbnails bleiben für Grid-Kacheln erhalten.

### 5. Bild-Rendering im Admin-Grid stabilisiert

Admin-Thumbnails haben jetzt feste Dimensionen und `decoding="async"`, damit das Layout stabiler bleibt.

## Nicht geändert

- Keine Änderung an Analytics
- Keine Aufrufzählung
- Keine Änderung an POI-Views
- Keine Änderung an öffentlicher Darstellung
