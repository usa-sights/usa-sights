import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createSupabaseAdminClient } from './admin'

async function getUserFromBearerToken(req, admin) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error) return null
  return data.user || null
}

export async function getRouteUser(req) {
  const admin = createSupabaseAdminClient()

  const bearerUser = await getUserFromBearerToken(req, admin)
  if (bearerUser) return bearerUser

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )

  const { data } = await supabase.auth.getUser()
  return data.user || null
}

export async function requireAdminRoute(req) {
  const admin = createSupabaseAdminClient()
  const user = await getRouteUser(req)
  if (!user) return { ok: false, status: 401, error: 'Nicht eingeloggt' }

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { ok: false, status: 403, error: 'Kein Admin' }
  }

  return { ok: true, user, admin }
}

export async function requireUserRoute(req) {
  const user = await getRouteUser(req)
  if (!user) return { ok: false, status: 401, error: 'Nicht eingeloggt' }
  const admin = createSupabaseAdminClient()
  return { ok: true, user, admin }
}
