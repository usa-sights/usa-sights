import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

function noStoreJson(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...(init.headers || {}),
    },
  })
}

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return noStoreJson({ error: 'poi_id fehlt' }, { status: 400 })

  const { data, error } = await admin
    .from('poi_external_links')
    .select('*')
    .eq('poi_id', poiId)
    .in('status', ['published', 'approved'])
    .order('created_at')

  if (error) return noStoreJson({ error: error.message }, { status: 500 })
  return noStoreJson({ items: data || [] })
}
