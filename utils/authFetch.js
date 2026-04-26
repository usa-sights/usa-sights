import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { dispatchAppDataChanged } from '@/lib/appEvents'

function normalizeMethod(method) {
  return String(method || 'GET').toUpperCase()
}

function shouldBypassCache(method, init) {
  if (init?.cache) return false
  return method === 'GET' || method === 'HEAD'
}

export async function authFetch(input, init = {}) {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const method = normalizeMethod(init.method)

  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)

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
