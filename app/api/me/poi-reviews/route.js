import { sendPoiNoteNotification } from '@/lib/adminNotifications'
import { requireUserRoute } from '@/utils/supabase/auth'

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()

  const { data, error } = await auth.admin
    .from('poi_reviews')
    .upsert({
      poi_id: body.poi_id,
      user_id: auth.user.id,
      rating: body.rating,
      review_text: body.review_text || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'poi_id,user_id' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (String(body.review_text || '').trim()) {
    sendPoiNoteNotification({
      poiId: body.poi_id,
      userId: auth.user.id,
      noteTitle: `Bewertung ${body.rating || data?.rating || 0}/5`,
      noteBody: String(body.review_text || '').trim(),
      kind: 'Bewertung mit Text',
    }).catch(() => {})
  }

  return Response.json({ item: data })
}
