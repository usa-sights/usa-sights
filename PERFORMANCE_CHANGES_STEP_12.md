# Performance Schritt 12 – Bewertungen und Upload-UI auf POI-Detailseiten verzögert laden

## Ziel

Die POI-Detailseite soll schneller interaktiv wirken und weniger initiales JavaScript laden, ohne sichtbare Funktionen zu entfernen.

## Änderungen

- `POIReviewOverview` wurde in eine eigene schlanke Komponente ausgelagert.
- Die vollständige Bewertungssektion (`POIReviews`) wird per `next/dynamic` erst geladen, wenn der Bewertungsbereich nahe am Viewport ist.
- Direkte Links auf Bewertungen funktionieren weiterhin: `#poi-reviews`, `#review-*`, `#reply-*` und Review-Filter in der URL lösen weiterhin sofortiges Laden aus.
- Der Foto-Upload-Bereich (`UserPOIImageUploader`) wird ebenfalls dynamisch geladen und damit nicht mehr im initialen POI-Detail-Bundle mitgeschickt.
- Admin-Media wurde nicht verändert.
- Aufruf-/View-Zählung wurde nicht verändert.

## Erwarteter Effekt

- Weniger initiales JavaScript auf POI-Detailseiten.
- Weniger sofortige Supabase/Auth- und Review-Client-Logik beim ersten Render.
- Schnellere gefühlte Interaktion im oberen Seitenbereich, besonders mobil.

## Prüfung

Empfohlen:

```bash
npm install
npm test
npm run build
```

## Git

```bash
git status
git add .
git commit -m "Defer POI review and upload widgets"
git push
```
