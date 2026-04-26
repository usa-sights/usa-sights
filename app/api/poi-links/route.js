import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const { data, error } = await admin
    .from('poi_external_links')
    .select('*')
    .eq('poi_id', poiId)
    .eq('status', 'published')
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] })
}
