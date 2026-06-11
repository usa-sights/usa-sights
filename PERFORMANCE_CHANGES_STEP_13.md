# Performance Step 13 – Shared signed URL batching and faster Admin Media first paint

## Ziel

Dieser Schritt reduziert die Anzahl paralleler Bild-Signing-Requests im Frontend und verbessert die gefühlte Ladezeit in `/admin/media`, insbesondere bei 72 Bildern pro Seite und langsameren Verbindungen.

Es wurden keine Aufruf-/View-Zählungen verändert.

## Änderungen

### 1. Gemeinsamer Client-Cache für signierte Bild-URLs

Neu:

- `utils/clientSignedUrls.js`

Dieser Helfer bündelt gleichzeitige Bildpfad-Anfragen innerhalb eines kurzen Zeitfensters und ruft `/api/images/signed-urls` gebündelt auf. Zusätzlich werden signierte URLs clientseitig bis kurz vor Ablauf wiederverwendet.

Betroffen:

- `components/OptimizedImage.js`
- `components/map/SmartImage.js`
- `components/AdminMediaClient.js`

### 2. Weniger Request-Flut bei Discovery, Map-Popups und POI-Galerien

Mehrere Bilder, die gleichzeitig sichtbar werden, erzeugen nicht mehr jeweils eigene Signing-Requests. Stattdessen werden sie nach Transformationsgröße gebündelt.

### 3. Admin Media lädt sichtbare Thumbnails zuerst

In `/admin/media` werden bei großen Seiten nicht mehr alle 72 Thumbnail-URLs blockierend vorbereitet.

Neu:

- Die ersten 18 Thumbnail-URLs werden priorisiert geladen.
- Die restlichen Thumbnail-URLs werden kurz danach im Hintergrund nachgeladen.
- Originalbilder werden weiterhin erst bei Großansicht geladen.

Das verbessert die gefühlte Erstansicht, weil die Seite früher nutzbar ist und sichtbare Bilder schneller erscheinen.

### 4. Bestehende Funktionen bleiben erhalten

- Statusfilter bleiben erhalten.
- 24/48/72/120 Bilder pro Seite bleiben erhalten.
- Großansicht lädt weiterhin Originalbilder bei Bedarf.
- Keine Änderung an View-/Aufrufzählungen.

## Prüfung

- `npm ci --ignore-scripts`: erfolgreich
- `npm test`: erfolgreich, aktuell ohne vorhandene Tests
- `npm run build`: kompiliert erfolgreich; wurde in dieser Umgebung später bei `Collecting page data` wegen Timeout beendet.

## Git

```bash
git status
git add .
git commit -m "Batch signed image URL loading"
git push
```
