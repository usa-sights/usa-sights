# Performance Changes – Step 2

## Ziel

Die Kartenansichten sollen initial weniger Backend-/Storage-Arbeit auslösen, ohne sichtbare Funktionen zu entfernen. Bilder in Karten-Popups und der POI-Sidebar bleiben verfügbar, werden aber erst bei tatsächlichem Bedarf signiert und geladen.

## Änderungen

### 1. Keine massenhafte Bild-URL-Signierung mehr im initialen Karten-Request

Die Karten-Requests in `components/HomeMapSection.js` und `components/ExploreClient.js` senden nicht mehr `include_images=1` an `/api/public-pois`.

Dadurch liefert `/api/public-pois` weiterhin die nötigen POI- und Cover-Pfade, erzeugt aber nicht mehr für hunderte POIs sofort signierte Storage-URLs.

### 2. Lazy Signed URLs in `SmartImage`

`components/map/SmartImage.js` wurde erweitert:

- nutzt weiterhin vorhandene direkte Bild-URLs, falls sie vorhanden sind
- fällt ansonsten auf `cover_thumb_path` und `cover_path` zurück
- ruft `/api/images/signed-urls` erst dann auf, wenn ein Bild tatsächlich gerendert wird
- cached signierte URLs clientseitig im Browser-Speicher der aktuellen Session
- setzt `width`, `height`, `loading="lazy"` und `decoding="async"`

### 3. Funktionsumfang bleibt erhalten

- Kartenmarker bleiben unverändert sichtbar
- Sidebar bleibt aktiv
- Popup-Bilder bleiben aktiv
- POI-Detailnavigation bleibt unverändert
- Favoriten-/Bewertungsdaten werden in diesem Schritt noch nicht verändert

## Erwartete Wirkung

- deutlich weniger Storage-Signed-URL-Operationen pro Kartenbewegung
- geringere Serverzeit für `/api/public-pois`
- weniger Payload im initialen Karten-JSON
- bessere Skalierung bei vielen POIs im Kartenausschnitt

## Hinweise

Der lokale `next build` kompiliert erfolgreich, bricht in dieser Umgebung aber erwartungsgemäß bei der Prerender-Phase ab, weil keine echten Supabase-Environment-Variablen gesetzt sind (`supabaseUrl is required`). Das ist kein Fehler dieser Änderung.

`npm test` läuft erfolgreich; es sind derzeit keine Unit-Tests im Projekt vorhanden.
