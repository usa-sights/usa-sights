# Performance-Optimierung Schritt 1

Dieses Paket enthält bewusst risikoarme Änderungen, die bestehende Funktionen und UI möglichst unverändert lassen.

## Geänderte Bereiche

### Public API Caching
- `/api/public-pois`: `revalidate = 60` und `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- `/api/public/discovery`: `revalidate = 300` und CDN/SWR-Caching
- `/api/public/stats`: `revalidate = 300` und CDN/SWR-Caching
- `/api/public/app-settings`: sehr kurzes Caching mit `s-maxage=15`, damit Wartungsmodus/Ranking nicht dauerhaft verzögert werden
- `/api/categories`: `revalidate = 600` und CDN/SWR-Caching

Fehlerantworten bleiben `no-store`, damit keine 500er gecacht werden.

### Entfernte Cache-Buster bei öffentlichen Daten
- Home-Statistiken laden nicht mehr mit `?t=Date.now()`.
- Public Discovery lädt nicht mehr mit `?t=Date.now()`.
- Public POI-Requests in Home-/Explore-/Kategorie-Karte laden nicht mehr mit `?t=Date.now()`.
- Initiale öffentliche App-Settings in `NavBar` und `MaintenanceGate` nutzen den neuen kurzen Cache.

Admin-/User-spezifische Requests wurden bewusst nicht allgemein gecacht.

### Bilder
- Discovery-Card-Bilder nutzen jetzt `loading="lazy"` und `decoding="async"`.

### Home-Karte
- Die große Home-Karte wird erst gemountet, wenn sie nahe am Viewport ist (`IntersectionObserver`, `rootMargin: 450px`).
- Vorher erscheint ein leichter Placeholder.
- Dadurch werden Leaflet/Map-Komponenten und der initiale POI-Request nicht mehr sofort beim Seitenstart aktiv.

### Explore-Karte
- Das explizite `limit` wurde von `1500` auf `800` gesetzt. Die API hatte ohnehin bereits ein internes Maximum von 800. Das macht das Verhalten transparenter und verhindert unnötige Erwartung/Parametrierung.

## Validierung

- `npm ci --ignore-scripts` erfolgreich.
- `npm test` erfolgreich, aber es sind aktuell keine Unit-Tests vorhanden.
- `next build` kompiliert erfolgreich bis inklusive „Compiled successfully“ und generiert statische Seiten mit Dummy-Supabase-ENV-Werten. Der lokale Build-Prozess lief danach in dieser Umgebung in ein Timeout; ohne echte Supabase-ENV-Werte schlägt er erwartungsgemäß fehl.

## Nächster sinnvoller Schritt

Schritt 2 sollte die Public-POI-API weiter verschlanken:
- Marker-Minimaldaten und Popup-/Bilddaten trennen.
- `include_images=1` nur dort verwenden, wo Bilder sofort sichtbar gebraucht werden.
- Review-/Favorite-Aggregationen mittelfristig in SQL View/RPC verschieben.
