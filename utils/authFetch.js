import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { dispatchAppDataChanged } from '@/lib/appEvents'

function normalizeMethod(method) {
  return String(method || 'GET').toUpperCase()
}

function shouldBypassCache(method, init) {
  if (init?.cache) return false
  return method === 'GET' || method === 'HEAD'
}

function parseStoredSession(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token || null
  } catch {
    return null
  }
}

function getTokenFromBrowserStorage() {
  if (typeof window === 'undefined') return null
  const stores = []
  try { if (window.localStorage) stores.push(window.localStorage) } catch {}
  try { if (window.sessionStorage) stores.push(window.sessionStorage) } catch {}

  for (const store of stores) {
    try {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i)
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
        const token = parseStoredSession(store.getItem(key))
        if (token) return token
      }
    } catch {}
  }
  return null
}

async function getAuthToken() {
  const supabase = createBrowserSupabaseClient()

  // First use the official Supabase session API. This covers normal email/password
  // sessions and keeps token refresh behavior intact.
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) return data.session.access_token

  // On production domains, especially directly after redirects or hard reloads,
  // getSession() can briefly return null while the browser storage already contains
  // the valid session. Retry once before falling back to direct storage parsing.
  await new Promise((resolve) => window.setTimeout(resolve, 80))
  const retry = await supabase.auth.getSession()
  if (retry.data.session?.access_token) return retry.data.session.access_token

  // Final fallback for existing deployed sessions. The token is still the same
  // Supabase token; we only read it so our own /api/me/* routes receive the
  // Authorization header they already expect.
  return getTokenFromBrowserStorage()
}

export async function authFetch(input, init = {}) {
  const token = await getAuthToken()
  const method = normalizeMethod(init.method)

  const headers = new Headers(init.headers || {})
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(input, {
    ...init,
    headers,
    ...(shouldBypassCache(method, init) ? { cache: 'no-store' } : {}),
  })

  if (response.ok && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    dispatchAppDataChanged({
      method,
      url: typeof input === 'string' ? input : input?.toString?.() || '',
    })
  }

  return response
}

export async function authFetchJson(input, init = {}) {
  const res = await authFetch(input, init)
  const text = await res.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text || 'Ungültige Server-Antwort' }
    }
  }
  if (!res.ok && !data.error) {
    data.error = `HTTP ${res.status}`
  }
  return data
}
