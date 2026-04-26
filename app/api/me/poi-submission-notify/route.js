import { requireUserRoute } from '@/utils/supabase/auth'
import { sendPoiSubmissionNotification } from '@/lib/adminNotifications'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const poiId = String(body?.poi_id || '').trim()
  if (!poiId) return Response.json({ error: 'POI-ID fehlt.' }, { status: 400 })

  const { data: poi } = await auth.admin.from('pois').select('id,created_by').eq('id', poiId).maybeSingle()
  if (!poi || poi.created_by !== auth.user.id) return Response.json({ error: 'Kein Zugriff.' }, { status: 403 })

  try {
    await sendPoiSubmissionNotification({ poiId })
  } catch (error) {
    return Response.json({ error: error.message || 'Benachrichtigung fehlgeschlagen.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
