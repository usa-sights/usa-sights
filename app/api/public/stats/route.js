import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { safeExactCount } from '@/lib/supabaseDb'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const publicCacheHeaders = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
}

export async function GET() {
  const admin = createSupabaseAdminClient()

  const [pois, images, links] = await Promise.all([
    safeExactCount(
      admin.from('pois').select('*', { count: 'exact', head: true }).eq('status', 'published')
    ),
    safeExactCount(
      admin.from('poi_images').select('*', { count: 'exact', head: true }).eq('status', 'approved')
    ),
    safeExactCount(
      admin.from('poi_external_links').select('*', { count: 'exact', head: true }).eq('status', 'published')
    ),
  ])

  return Response.json(
    { stats: { pois, images, links }, generated_at: new Date().toISOString() },
    { headers: publicCacheHeaders }
  )
}
