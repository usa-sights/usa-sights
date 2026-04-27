# Auth Fix v106

## Problem
Auf Vercel konnte der Nutzer eingeloggt sein, aber Account/Admin-Seiten blieben bei „Lädt ...“ hängen oder `/api/me/dashboard` antwortete mit `401`.

Im Browser war zusätzlich eine Supabase-Warnung sichtbar:

`Lock "...auth-token" was not released within 5000ms`

Dadurch konnte `supabase.auth.getSession()` in manchen Fällen zu lange blockieren. Der Bearer-Token wurde dann nicht rechtzeitig an `/api/me/...` und `/api/admin/...` Requests angehängt.

## Änderung
`utils/authFetch.js` liest den vorhandenen Supabase Access Token jetzt zuerst direkt aus Browser Storage und nutzt `getSession()` nur noch als zeitlich begrenzten Fallback.

Damit werden API-Requests robuster:

- `/api/me/dashboard`
- `/api/me/profile`
- `/api/me/favorites`
- `/api/admin/dashboard`
- weitere `authFetch()` / `authFetchJson()` Aufrufe

## Nach Deployment testen
1. Vercel neu deployen.
2. Inkognito öffnen.
3. Einloggen.
4. `/account` und `/admin/dashboard` öffnen.
5. DevTools → Network prüfen:
   - `/api/me/dashboard` bzw. `/api/admin/dashboard` sollte `200` zurückgeben.
   - Request Header sollte `Authorization: Bearer ...` enthalten.
