# V105 Auth/API-Session-Fix

## Problem
Auf Vercel wurde der Nutzer im Frontend als eingeloggt erkannt, aber `/api/me/dashboard` antwortete mit `401`, weil der Request keinen `Authorization: Bearer ...` Header enthielt.

## Änderung
- `utils/authFetch.js` robuster gemacht:
  - holt den Supabase Access Token über `supabase.auth.getSession()`
  - wartet kurz und versucht es erneut, falls die Session direkt nach Redirect/Reload noch nicht synchronisiert ist
  - nutzt als Fallback vorhandene Supabase Browser-Storage-Session (`sb-...-auth-token`)
  - setzt damit zuverlässig `Authorization: Bearer <token>` für `/api/me/*` und Admin-API-Aufrufe
- `components/POIDetailClient.js` nutzt für `/api/me/profile` jetzt ebenfalls `authFetchJson()` statt plain `fetch()`.

## Erwartete Wirkung
- Dashboard lädt nach Login statt endlos zu hängen.
- `/api/me/dashboard`, `/api/me/profile`, `/api/me/favorites`, `/api/me/pois` erhalten den Bearer Token.
- Logout bleibt unverändert.

## Geprüft
- Syntaxcheck der geänderten Dateien: ok
- Unit-Tests: 6/6 bestanden
- `npm run build` lokal hier nicht ausführbar, weil `next` in dieser Umgebung nicht installiert ist.

## Nach Deployment testen
1. Vercel neu deployen.
2. Inkognito-Fenster öffnen.
3. `https://usa-sights.vercel.app/login` öffnen.
4. Einloggen.
5. `/account` öffnen.
6. In DevTools → Network prüfen: `/api/me/dashboard` sollte `200` zurückgeben und im Request Header `Authorization: Bearer ...` enthalten.
