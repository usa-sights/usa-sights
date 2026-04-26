import { requireAdminRoute } from '@/utils/supabase/auth'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')
  let query = auth.admin.from('poi_reviews').select('*, pois(title)').order('created_at', { ascending: false })
  if (period === 'today') {
    const d = new Date(); d.setHours(0,0,0,0)
    query = query.gte('created_at', d.toISOString())
  }
  if (period === '7d') {
    const d = new Date(Date.now()-7*24*60*60*1000)
    query = query.gte('created_at', d.toISOString())
  }
  const { data, error } = await query.limit(500)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { id, rating, review_text } = body
  const { data, error } = await auth.admin
    .from('poi_reviews')
    .update({ rating: Number(rating), review_text: review_text || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, pois(title)')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function DELETE(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const delReplies = await auth.admin.from('poi_review_replies').delete().eq('review_id', id)
  if (delReplies.error) return Response.json({ error: delReplies.error.message }, { status: 500 })
  const delReview = await auth.admin.from('poi_reviews').delete().eq('id', id)
  if (delReview.error) return Response.json({ error: delReview.error.message }, { status: 500 })
  return Response.json({ ok: true })
}
