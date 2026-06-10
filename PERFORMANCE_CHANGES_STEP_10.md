# Performance Changes – Step 10

## Fokus

Schritt 10 reduziert die Initiallast auf Explore- und Kategorie-Seiten. `/admin/media` und die POI-Aufruf-/View-Zählung wurden nicht verändert.

## Änderungen

### 1. Explore lädt Kategorien über den gecachten Public-Endpunkt

`components/ExploreClient.js` importiert den Supabase-Browser-Client nicht mehr nur für die Kategorieauswahl. Stattdessen lädt die Explore-Seite aktive Kategorien über:

```txt
/api/categories?active=1
```

Der Endpunkt ist bereits öffentlich cachebar. Dadurch wird weniger Client-JavaScript benötigt und der initiale Explore-Start macht keinen direkten Supabase-Query mehr für Kategorien.

### 2. `/api/categories` unterstützt aktive Public-Kategorien

`app/api/categories/route.js` unterstützt nun:

```txt
?active=1
?public=1
```

Damit können öffentliche Seiten gezielt nur aktive Kategorien laden. Die Sortierung nutzt `sort_order` und danach `name`.

### 3. Kategorie-Detailseiten laden Karten-POIs später

`components/CategoryDetailClient.js` lädt die große Kategorie-Karte und die zugehörigen POIs erst, wenn der Kartenbereich nahe am Viewport ist. Außerdem werden keine `include_images=1`-Requests mehr für Karten-POIs gesendet.

Damit werden bei Kategorie-Seiten nicht mehr direkt beim Seitenstart Karten-, POI- und Bilddaten vorbereitet, die Besucher möglicherweise nie sehen.

### 4. Kategorienübersicht lädt keine vollständigen POI-Listen mehr nur für Counts

`app/categories/page.js` holt für Kategorie-Zähler keine vollständigen POI-Zeilen mehr. Stattdessen werden count-only Queries verwendet:

```js
.select('id', { count: 'exact', head: true })
```

Das reduziert Datenbank-Transfer und Server-Arbeit bei vielen veröffentlichten POIs.

### 5. Kategorienübersicht ist revalidierbar

Die Kategorienseite nutzt jetzt:

```js
export const revalidate = 600
```

Dadurch kann Next.js die Seite zwischenzeitlich wiederverwenden, statt sie zwingend bei jedem Request vollständig neu zu rendern.

## Nicht geändert

- Keine Änderungen an `/admin/media`
- Keine Änderungen an `/api/poi-view`
- Keine neue Aufrufzählung
- Keine Design- oder Inhaltsänderungen

## Empfohlene Prüfung

```bash
npm install
npm test
npm run build
```

