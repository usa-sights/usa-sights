# Performance Changes – Step 4

Ziel: Bildausgabe, LCP/CLS und Netzwerk-Startkosten weiter verbessern, ohne sichtbare Funktionalität zu ändern.

## Änderungen

### 1. Neue zentrale Bildkomponente

Neue Datei:

- `components/OptimizedImage.js`

Die Komponente setzt standardmäßig:

- `loading="lazy"`
- `decoding="async"`
- optionale `width` / `height`
- optionale `sizes`
- optionale `fetchPriority`
- einfache Fallback-Logik bei fehlerhaften Bildquellen

Damit werden wiederkehrende Bildoptimierungen zentraler und wartbarer.

### 2. POI-Galerie optimiert

Datei:

- `components/POIGallery.js`

Änderungen:

- Hauptbild der POI-Galerie lädt weiterhin sofort, erhält aber zusätzlich feste Dimensionen und `fetchPriority="high"`.
- Galerie-Side-Images und Lightbox-Thumbnails laden lazy mit festen Dimensionen.
- Lightbox-Hauptbild erhält feste Dimensionen und `decoding="async"`.

Das reduziert Layout Shifts und hilft dem Browser, das wichtigste POI-Bild höher zu priorisieren.

### 3. Discovery Cards optimiert

Datei:

- `components/PublicDiscoverySection.js`

Änderungen:

- Discovery-Bilder nutzen jetzt ebenfalls die zentrale `OptimizedImage`-Komponente.
- Feste Dimensionen und responsive `sizes` wurden ergänzt.

### 4. Affiliate-Bilder optimiert

Datei:

- `components/AffiliateSmartCards.js`

Änderungen:

- Affiliate-Bilder nutzen jetzt `OptimizedImage`.
- Lazy Loading, feste Dimensionen und Fallback-Bilder sind zentralisiert.

### 5. Supabase Preconnect

Datei:

- `app/layout.js`

Änderungen:

- Wenn `NEXT_PUBLIC_SUPABASE_URL` gesetzt ist, wird im Dokumentkopf ein `preconnect` und `dns-prefetch` zur Supabase-Origin ausgegeben.

Das kann API- und Bildabrufe beschleunigen, weil DNS/TLS-Verbindung früher vorbereitet wird.

## Erwartete Wirkung

- stabilere Bildflächen, weniger CLS-Risiko
- besser priorisiertes POI-Hauptbild
- weniger Browser-Rätselraten bei Bildgrößen
- bessere Wiederverwendbarkeit für weitere Bildbereiche
- etwas schnellere Supabase-Verbindungsaufnahme

## Prüfstatus

- `npm ci --ignore-scripts`: erfolgreich
- `npm test`: erfolgreich; aktuell sind keine Unit-Tests vorhanden
- `npm run build`: Produktion kompiliert erfolgreich; die Prüfung lief bis `Collecting page data`, wurde in dieser Umgebung aber wegen Timeout beendet. Vorheriger Fehler wegen fehlender Supabase-ENV trat bei diesem Schritt nicht als Codefehler auf.

## Git

Empfohlener Commit:

```bash
git add .
git commit -m "Optimize public image rendering"
git push
```
