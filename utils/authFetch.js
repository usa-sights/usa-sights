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

function withTimeout(promise, ms = 1200) {
  return Promise.race([
    promise,
    new Promise((resolve) => window.setTimeout(() => resolve(null), ms)),
  ])
}

async function getAuthToken() {
  // Production issue observed on Vercel/Chrome/Firefox: Supabase's LockManager can
  // occasionally delay getSession() long enough that account/admin pages remain
  // in "Lädt ...". The browser storage already contains the valid access token,
  // so use it first and keep getSession() only as a bounded fallback.
  const storedToken = getTokenFromBrowserStorage()
  if (storedToken) return storedToken

  const supabase = createBrowserSupabaseClient()

  const sessionResult = await withTimeout(supabase.auth.getSession())
  const sessionToken = sessionResult?.data?.session?.access_token
  if (sessionToken) return sessionToken

  await new Promise((resolve) => window.setTimeout(resolve, 80))
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
