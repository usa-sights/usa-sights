import { requireAdminRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

async function safeData(promise, fallback = []) {
  try {
    const res = await promise
    return res.data || fallback
  } catch {
    return fallback
  }
}

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin

  const [pois, images, links, changes] = await Promise.all([
    safeData(admin.from('pois').select('id,title,status,created_at,updated_at,categories(name)').eq('status', 'pending').order('created_at', { ascending: false })),
    safeData(admin.from('poi_images').select('id,poi_id,status,created_at').eq('status', 'pending').order('created_at', { ascending: false })),
    safeData(admin.from('poi_external_links').select('id,poi_id,status,created_at,label,url').eq('status', 'pending').order('created_at', { ascending: false })),
    safeData(admin.from('poi_change_requests').select('id,poi_id,status,created_at,field_name,new_value').eq('status', 'pending').order('created_at', { ascending: false })),
  ])

  return Response.json({
    pois,
    images,
    links,
    changes,
    counts: {
      pois: pois.length,
      images: images.length,
      links: links.length,
      changes: changes.length,
      total: pois.length + images.length + links.length + changes.length,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
