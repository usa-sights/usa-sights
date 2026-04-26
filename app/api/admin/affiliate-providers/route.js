import { requireAdminRoute } from '@/utils/supabase/auth'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.admin
    .from('affiliate_providers')
    .select('*')
    .order('sort_order')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { provider_key, provider_name, is_global_enabled, sort_order } = body

  const { data, error } = await auth.admin
    .from('affiliate_providers')
    .upsert({ provider_key, provider_name, is_global_enabled, sort_order }, { onConflict: 'provider_key' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
