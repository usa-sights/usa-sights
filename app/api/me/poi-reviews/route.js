import { sendPoiNoteNotification } from '@/lib/adminNotifications'
import { normalizeReviewRow } from '@/lib/poiReviews'
import { requireUserRoute } from '@/utils/supabase/auth'

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const rating = Number(body.rating || 0)
  const reviewText = String(body.review_text || '').trim()

  if (!body.poi_id) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return Response.json({ error: 'Bitte 1 bis 5 Sterne auswählen.' }, { status: 400 })

  const { data, error } = await auth.admin
    .from('poi_reviews')
    .upsert({
      poi_id: body.poi_id,
      user_id: auth.user.id,
      rating,
      review_text: reviewText || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'poi_id,user_id' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let authorName = 'Nutzer'
  const profileRes = await auth.admin.from('profiles').select('name,email').eq('id', auth.user.id).maybeSingle()
  if (profileRes.data?.name || profileRes.data?.email) authorName = profileRes.data.name || profileRes.data.email

  if (reviewText) {
    sendPoiNoteNotification({
      poiId: body.poi_id,
      userId: auth.user.id,
      noteTitle: `Bewertung ${rating || data?.rating || 0}/5`,
      noteBody: reviewText,
      kind: 'Bewertung mit Text',
    }).catch(() => {})
  }

  return Response.json({ item: normalizeReviewRow(data, authorName) }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
