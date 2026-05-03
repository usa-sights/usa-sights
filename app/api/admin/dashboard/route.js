import { requireAdminRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

async function safeCount(queryPromise) {
  try {
    const res = await queryPromise
    return res.count || 0
  } catch {
    return 0
  }
}

async function safeData(queryPromise, fallback = []) {
  try {
    const res = await queryPromise
    return res.data || fallback
  } catch {
    return fallback
  }
}

async function fetchAllRows(builderFactory, pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    const query = builderFactory().range(from, from + pageSize - 1)
    const res = await query
    if (res.error) break
    const data = res.data || []
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function groupByCount(rows, keySelector, titleSelector = null, slugSelector = null, limit = 8) {
  const map = new Map()
  for (const row of rows || []) {
    const key = keySelector(row)
    if (!key) continue
    const current = map.get(key) || {
      key,
      count: 0,
      title: titleSelector ? titleSelector(row) : null,
      slug: slugSelector ? slugSelector(row) : null,
    }
    current.count += 1
    if (!current.title && titleSelector) current.title = titleSelector(row)
    if (!current.slug && slugSelector) current.slug = slugSelector(row)
    map.set(key, current)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit)
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function attachPoiThumbs(admin, items) {
  const input = items || []
  const poiIds = Array.from(new Set(input.map((item) => item.poi_id || item.key).filter(Boolean)))
  if (!poiIds.length && !input.some((item) => item.path || item.thumb_path)) return input

  const imageRows = poiIds.length ? await safeData(
    admin
      .from('poi_images')
      .select('poi_id,path,is_cover,is_gallery_pick,created_at,status')
      .in('poi_id', poiIds)
      .in('status', ['approved', 'published'])
      .order('is_cover', { ascending: false })
      .order('created_at', { ascending: false })
      .order('is_gallery_pick', { ascending: false })
  ) : []

  const firstByPoi = new Map()
  for (const row of imageRows) {
    if (!firstByPoi.has(row.poi_id)) firstByPoi.set(row.poi_id, row)
  }

  const ownPaths = input.flatMap((item) => [item.thumb_path, item.path ? deriveThumbPath(item.path) : null, item.path]).filter(Boolean)
  const coverPaths = Array.from(firstByPoi.values()).flatMap((row) => [deriveThumbPath(row.path), row.path]).filter(Boolean)
  const thumbPaths = Array.from(new Set([...ownPaths, ...coverPaths]))
  let signedMap = {}
  if (thumbPaths.length) {
    const signed = await admin.storage.from('poi-images').createSignedUrls(thumbPaths, 3600)
    signedMap = Object.fromEntries((signed.data || []).map((item, index) => [thumbPaths[index], item?.signedUrl || null]))
  }

  return input.map((item) => {
    const key = item.poi_id || item.key
    const image = firstByPoi.get(key)
    const ownThumb = item.thumb_url || (item.thumb_path ? signedMap[item.thumb_path] : null) || (item.path ? (signedMap[deriveThumbPath(item.path)] || signedMap[item.path]) : null)
    const coverThumb = image ? (signedMap[deriveThumbPath(image.path)] || signedMap[image.path] || null) : null
    return { ...item, thumb_url: ownThumb || coverThumb || null }
  })
}

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalPois,
    pendingPois,
    publishedPois,
    rejectedPois,
    reviewsTotal,
    reviewsToday,
    reviews7d,
    reviewsWithRating,
    favoritesTotal,
    totalUsers,
    totalImages,
    pendingImages,
    approvedImages,
    rejectedImages,
    pendingLinks,
    pendingChanges,
    pois7d,
    images7d,
    links7d,
    changes7d,
    totalLinksCount,
    publishedLinksCount,
    rejectedLinksCount,
    recentPois,
    recentReviews,
    recentImages,
    recentLinks,
    recentReplies,
    allPoiRows,
    imageRows,
    favoriteRows,
    reviewRows,
  ] = await Promise.all([
    safeCount(admin.from('pois').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('pois').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(admin.from('pois').select('*', { count: 'exact', head: true }).eq('status', 'published')),
    safeCount(admin.from('pois').select('*', { count: 'exact', head: true }).eq('status', 'rejected')),
    safeCount(admin.from('poi_reviews').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('poi_reviews').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString())),
    safeCount(admin.from('poi_reviews').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString())),
    fetchAllRows(() => admin.from('poi_reviews').select('rating')),
    safeCount(admin.from('favorites').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('profiles').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('poi_images').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('poi_images').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(admin.from('poi_images').select('*', { count: 'exact', head: true }).in('status', ['approved', 'published'])),
    safeCount(admin.from('poi_images').select('*', { count: 'exact', head: true }).eq('status', 'rejected')),
    safeCount(admin.from('poi_external_links').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(admin.from('poi_change_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(admin.from('pois').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString())),
    safeCount(admin.from('poi_images').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString())),
    safeCount(admin.from('poi_external_links').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString())),
    safeCount(admin.from('poi_change_requests').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString())),
    safeCount(admin.from('poi_external_links').select('*', { count: 'exact', head: true })),
    safeCount(admin.from('poi_external_links').select('*', { count: 'exact', head: true }).in('status', ['published', 'approved'])),
    safeCount(admin.from('poi_external_links').select('*', { count: 'exact', head: true }).eq('status', 'rejected')),
    safeData(admin.from('pois').select('id,title,slug,status,updated_at,created_at').order('updated_at', { ascending: false }).limit(8)),
    safeData(admin.from('poi_reviews').select('id,created_at,poi_id,rating,pois(title,slug)').order('created_at', { ascending: false }).limit(8)),
    safeData(admin.from('poi_images').select('id,poi_id,path,created_at,status,pois(title,slug)').order('created_at', { ascending: false }).limit(8)),
    safeData(admin.from('poi_external_links').select('id,poi_id,created_at,status,url,label,pois(title,slug)').order('created_at', { ascending: false }).limit(8)),
    safeData(admin.from('poi_review_replies').select('id,review_id,created_at,reply_text,poi_reviews(poi_id,pois(title,slug))').order('created_at', { ascending: false }).limit(8)),
    fetchAllRows(() => admin.from('pois').select('id,category_id,description')),
    fetchAllRows(() => admin.from('poi_images').select('poi_id,status')),
    fetchAllRows(() => admin.from('favorites').select('poi_id, pois(title,slug)')),
    fetchAllRows(() => admin.from('poi_reviews').select('poi_id, pois(title,slug)')),
  ])

  const avgRating = reviewsWithRating.length
    ? Number((reviewsWithRating.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviewsWithRating.length).toFixed(2))
    : 0

  const approvedImagePoiSet = new Set((imageRows || []).filter((x) => ['approved', 'published'].includes(x.status)).map((x) => x.poi_id))
  const reviewPoiSet = new Set((reviewRows || []).map((x) => x.poi_id))

  const poisWithoutImages = allPoiRows.filter((x) => !approvedImagePoiSet.has(x.id)).length
  const poisWithoutCategory = allPoiRows.filter((x) => x.category_id === null || x.category_id === undefined || x.category_id === '').length
  const poisWithoutDescription = allPoiRows.filter((x) => !String(x.description || '').trim()).length
  const poisWithoutReviews = allPoiRows.filter((x) => !reviewPoiSet.has(x.id)).length

  let mostFavoritedPois = groupByCount(
    favoriteRows,
    (row) => row.poi_id,
    (row) => row.pois?.title || 'POI',
    (row) => row.pois?.slug || '',
    8
  ).map((item) => ({ ...item, poi_id: item.key }))

  let mostReviewedPois = groupByCount(
    reviewRows,
    (row) => row.poi_id,
    (row) => row.pois?.title || 'POI',
    (row) => row.pois?.slug || '',
    8
  ).map((item) => ({ ...item, poi_id: item.key }))

  mostFavoritedPois = await attachPoiThumbs(admin, mostFavoritedPois)
  mostReviewedPois = await attachPoiThumbs(admin, mostReviewedPois)

  const recentPoiEntries = await attachPoiThumbs(admin, recentPois.map((item) => ({
    poi_id: item.id,
    type: 'POI',
    icon: 'poi',
    created_at: item.updated_at || item.created_at,
    created_at_label: formatDateTime(item.updated_at || item.created_at),
    title: item.title,
    label: `POI · ${item.status}`,
    href: item.slug ? `/poi/${item.slug}#poi-visitor-info` : `/admin/poi/${item.id}`,
    status: item.status,
  })))

  const recentImageEntries = await attachPoiThumbs(admin, recentImages.map((item) => ({
    poi_id: item.poi_id,
    path: item.path,
    type: 'Bild',
    icon: 'image',
    created_at: item.created_at,
    created_at_label: formatDateTime(item.created_at),
    title: item.pois?.title || 'POI',
    label: `Bild · ${item.status}`,
    href: item.pois?.slug ? `/poi/${item.pois.slug}#poi-gallery` : (item.poi_id ? `/admin/poi/${item.poi_id}` : '/admin/media'),
    status: item.status,
  })))

  const recentReviewEntries = await attachPoiThumbs(admin, recentReviews.map((item) => ({
    poi_id: item.poi_id,
    type: 'Review',
    icon: 'review',
    created_at: item.created_at,
    created_at_label: formatDateTime(item.created_at),
    title: item.pois?.title || 'POI',
    label: `Bewertung ${item.rating}/5`,
    href: item.pois?.slug ? `/poi/${item.pois.slug}#review-${item.id}` : (item.poi_id ? `/admin/poi/${item.poi_id}` : '/admin/reviews'),
    status: 'published',
  })))

  const recentReplyEntries = await attachPoiThumbs(admin, recentReplies.map((item) => ({
    poi_id: item.poi_reviews?.poi_id || null,
    type: 'Antwort',
    icon: 'reply',
    created_at: item.created_at,
    created_at_label: formatDateTime(item.created_at),
    title: item.poi_reviews?.pois?.title || 'POI',
    label: item.reply_text || 'Antwort',
    href: item.poi_reviews?.pois?.slug ? `/poi/${item.poi_reviews.pois.slug}#reply-${item.id}` : '/admin/reviews',
    status: 'published',
  })))

  const recentLinkEntries = await attachPoiThumbs(admin, recentLinks.map((item) => ({
    poi_id: item.poi_id,
    type: 'Link',
    icon: 'link',
    created_at: item.created_at,
    created_at_label: formatDateTime(item.created_at),
    title: item.pois?.title || 'POI',
    label: `${item.label || 'Link'} · ${item.url || item.status}`,
    href: item.pois?.slug ? `/poi/${item.pois.slug}#poi-link-${item.id}` : '/admin/admin-links',
    status: item.status,
    url: item.url || '',
  })))

  const activityFeed = [
    ...recentPoiEntries,
    ...recentReviewEntries,
    ...recentReplyEntries,
    ...recentImageEntries,
    ...recentLinkEntries,
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 20)

  const openModeration = pendingPois + pendingImages + pendingLinks + pendingChanges
  const contributions7d = pois7d + reviews7d + images7d + links7d + changes7d

  const moderationItems = [
    { key: 'pois', label: 'POIs pending', count: pendingPois, href: '/admin/pois?status=pending' },
    { key: 'images', label: 'Bilder pending', count: pendingImages, href: '/admin/media?status=pending' },
    { key: 'links', label: 'Links pending', count: pendingLinks, href: '/admin/admin-links?status=pending' },
    { key: 'changes', label: 'Änderungen pending', count: pendingChanges, href: '/admin/change-requests' },
  ]

  return Response.json({
    kpis: {
      totalPois,
      pendingPois,
      publishedPois,
      rejectedPois,
      reviewsTotal,
      reviewsToday,
      reviews7d,
      avgRating,
      favoritesTotal,
      totalUsers,
      contributions7d,
      openModeration,
      imagesTotal: totalImages,
      imagesPending: pendingImages,
      imagesPublished: approvedImages,
      imagesRejected: rejectedImages,
      linksTotal: totalLinksCount,
      linksPending: pendingLinks,
      linksPublished: publishedLinksCount,
      linksRejected: rejectedLinksCount,
    },
    moderationItems,
    activityFeed,
    quality: {
      poisWithoutImages,
      poisWithoutCategory,
      poisWithoutDescription,
      poisWithoutReviews,
      mostFavoritedPois,
      mostReviewedPois,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
