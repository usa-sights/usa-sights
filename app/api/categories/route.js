import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  let query = admin.from('categories').select('*').order('name', { ascending: true })
  if (slug) query = query.eq('slug', slug).limit(1)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
  return Response.json({ items: data || [] }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
}
