import { requireAdminRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

async function fetchAllRows(builderFactory, pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    const res = await builderFactory().range(from, from + pageSize - 1)
    if (res.error) throw new Error(res.error.message)
    const batch = res.data || []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : false
}

function withinPeriod(value, periodDays) {
  if (!periodDays) return true
  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000
  return new Date(value || 0).getTime() >= cutoff
}

function sortRows(rows, sortKey = 'pois', sortDir = 'desc') {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
    return String(av || '').localeCompare(String(bv || '')) * factor
  })
}

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const { searchParams } = new URL(req.url)
  const sortKey = searchParams.get('sort') || 'pois'
  const sortDir = searchParams.get('dir') || 'desc'
  const roleFilter = searchParams.get('role') || ''
  const query = (searchParams.get('q') || '').trim().toLowerCase()
  const period = Number(searchParams.get('period') || 0) || 0
  const userId = searchParams.get('user_id') || ''
  const contentType = searchParams.get('content_type') || ''

  try {
    const [profiles, pois, images, links, reviews, replies] = await Promise.all([
      fetchAllRows(() => admin.from('profiles').select('id,name,email,role,created_at')),
      fetchAllRows(() => admin.from('pois').select('id,title,slug,created_by,created_at,status')),
      fetchAllRows(() => admin.from('poi_images').select('id,poi_id,uploaded_by,created_at,status,caption, pois(title,slug)')),
      fetchAllRows(() => admin.from('poi_external_links').select('id,poi_id,submitted_by,created_at,status,label,url, pois(title,slug)')),
      fetchAllRows(() => admin.from('poi_reviews').select('id,poi_id,user_id,created_at,rating,review_text, pois(title,slug)')),
      fetchAllRows(() => admin.from('poi_review_replies').select('id,review_id,user_id,created_at,reply_text, poi_reviews(poi_id, pois(title,slug))')),
    ])

    const map = new Map((profiles || []).map((profile) => [profile.id, {
      id: profile.id,
      name: profile.name || 'Nutzer',
      email: profile.email || '',
      role: profile.role || 'user',
      created_at: profile.created_at,
      pois: 0,
      images: 0,
      links: 0,
      reviewsWithText: 0,
      reviewsWithoutText: 0,
      comments: 0,
      activityTotal: 0,
    }]))

    function ensure(userIdValue) {
      if (!userIdValue) return null
      if (!map.has(userIdValue)) map.set(userIdValue, { id: userIdValue, name: 'Nutzer', email: '', role: 'user', created_at: null, pois: 0, images: 0, links: 0, reviewsWithText: 0, reviewsWithoutText: 0, comments: 0, activityTotal: 0 })
      return map.get(userIdValue)
    }

    for (const row of pois) {
      if (!withinPeriod(row.created_at, period)) continue
      const item = ensure(row.created_by)
      if (item) item.pois += 1
    }
    for (const row of images) {
      if (!withinPeriod(row.created_at, period)) continue
      const item = ensure(row.uploaded_by)
      if (item) item.images += 1
    }
    for (const row of links) {
      if (!withinPeriod(row.created_at, period)) continue
      const item = ensure(row.submitted_by)
      if (item) item.links += 1
    }
    for (const row of reviews) {
      if (!withinPeriod(row.created_at, period)) continue
      const item = ensure(row.user_id)
      if (!item) continue
      if (hasText(row.review_text)) item.reviewsWithText += 1
      else item.reviewsWithoutText += 1
    }
    for (const row of replies) {
      if (!withinPeriod(row.created_at, period)) continue
      const item = ensure(row.user_id)
      if (item) item.comments += 1
    }

    let items = Array.from(map.values()).map((item) => ({ ...item, activityTotal: item.pois + item.images + item.links + item.reviewsWithText + item.reviewsWithoutText + item.comments }))
    if (roleFilter) items = items.filter((item) => item.role === roleFilter)
    if (query) items = items.filter((item) => [item.name, item.email, item.id].some((value) => String(value || '').toLowerCase().includes(query)))
    items = sortRows(items, sortKey, sortDir)

    let details = []
    if (userId && contentType) {
      if (contentType === 'pois') {
        details = pois.filter((row) => row.created_by === userId && withinPeriod(row.created_at, period)).map((row) => ({ id: row.id, title: row.title, href: row.slug ? `/admin/poi/${row.id}` : '/admin/pois', created_at: row.created_at, meta: row.status || 'POI' }))
      } else if (contentType === 'images') {
        details = images.filter((row) => row.uploaded_by === userId && withinPeriod(row.created_at, period)).map((row) => ({ id: row.id, title: row.pois?.title || row.caption || 'Bild', href: `/admin/media?uploaded_by=${userId}`, created_at: row.created_at, meta: row.status || 'Bild' }))
      } else if (contentType === 'links') {
        details = links.filter((row) => row.submitted_by === userId && withinPeriod(row.created_at, period)).map((row) => ({ id: row.id, title: row.label || row.url, href: `/admin/admin-links?submitted_by=${userId}`, created_at: row.created_at, meta: row.status || 'Link' }))
      } else if (contentType === 'reviewsWithText') {
        details = reviews.filter((row) => row.user_id === userId && hasText(row.review_text) && withinPeriod(row.created_at, period)).map((row) => ({ id: row.id, title: row.pois?.title || 'Bewertung', href: `/admin/reviews?user_id=${userId}&with_text=1`, created_at: row.created_at, meta: `${row.rating || 0}★ · mit Text` }))
      } else if (contentType === 'reviewsWithoutText') {
        details = reviews.filter((row) => row.user_id === userId && !hasText(row.review_text) && withinPeriod(row.created_at, period)).map((row) => ({ id: row.id, title: row.pois?.title || 'Bewertung', href: `/admin/reviews?user_id=${userId}&with_text=0`, created_at: row.created_at, meta: `${row.rating || 0}★ · ohne Text` }))
      } else if (contentType === 'comments') {
        details = replies.filter((row) => row.user_id === userId && withinPeriod(row.created_at, period)).map((row) => ({ id: row.id, title: row.poi_reviews?.pois?.title || 'Kommentar', href: `/admin/reviews?reply_user_id=${userId}`, created_at: row.created_at, meta: 'Kommentar / Antwort' }))
      }
    }

    return Response.json({ items, details }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Ranking konnte nicht geladen werden.' }, { status: 500 })
  }
}
