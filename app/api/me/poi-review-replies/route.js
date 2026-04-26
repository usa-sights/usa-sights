import { sendPoiNoteNotification } from '@/lib/adminNotifications'
import { requireUserRoute } from '@/utils/supabase/auth'

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()

  const { data, error } = await auth.admin
    .from('poi_review_replies')
    .insert({ review_id: body.review_id, user_id: auth.user.id, reply_text: body.reply_text })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: review } = await auth.admin.from('poi_reviews').select('poi_id').eq('id', body.review_id).maybeSingle()
  if (review?.poi_id && String(body.reply_text || '').trim()) {
    sendPoiNoteNotification({
      poiId: review.poi_id,
      userId: auth.user.id,
      noteTitle: 'Antwort auf Bewertung',
      noteBody: String(body.reply_text || '').trim(),
      kind: 'Antwort',
    }).catch(() => {})
  }

  return Response.json({ item: data })
}
