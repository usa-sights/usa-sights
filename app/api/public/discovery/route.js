import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

function groupByCount(rows, keySelector, titleSelector, slugSelector, limit = 8) {
  const map = new Map()
  for (const row of rows || []) {
    const key = keySelector(row)
    if (!key) continue
    const current = map.get(key) || { key, count: 0, title: titleSelector(row), slug: slugSelector(row) }
    current.count += 1
    map.set(key, current)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit)
}

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('category_id')

  let basePois = admin
    .from('pois')
    .select('id,title,slug,category_id,created_at,short_description,categories(name)')
    .eq('status', 'published')

  if (categoryId) basePois = basePois.eq('category_id', categoryId)

  const [
    { data: newestPois },
    { data: favoriteRows },
    { data: reviewRows },
  ] = await Promise.all([
    basePois.order('created_at', { ascending: false }).limit(8),
    admin.from('favorites').select('poi_id, pois(title,slug,category_id,status)').limit(5000),
    admin.from('poi_reviews').select('poi_id, pois(title,slug,category_id,status)').limit(5000),
  ])

  const favoriteFiltered = (favoriteRows || []).filter((x) => x.pois?.status === 'published' && (!categoryId || x.pois?.category_id === categoryId))
  const reviewFiltered = (reviewRows || []).filter((x) => x.pois?.status === 'published' && (!categoryId || x.pois?.category_id === categoryId))

  const popular = groupByCount(favoriteFiltered, (x) => x.poi_id, (x) => x.pois?.title || 'POI', (x) => x.pois?.slug || '', 8)
  const mostReviewed = groupByCount(reviewFiltered, (x) => x.poi_id, (x) => x.pois?.title || 'POI', (x) => x.pois?.slug || '', 8)

  const slugMap = new Map()
  for (const item of ([...(newestPois || []), ...popular, ...mostReviewed])) {
    if (item.slug) slugMap.set(item.slug, true)
  }
  const slugs = Array.from(slugMap.keys())

  const coverBySlug = {}
  if (slugs.length) {
    const { data: poiRows } = await admin.from('pois').select('id,slug').in('slug', slugs).eq('status', 'published')
    const poiIds = (poiRows || []).map((x) => x.id)
    if (poiIds.length) {
      const { data: images } = await admin
        .from('poi_images')
        .select('poi_id,path,is_cover,created_at')
        .in('poi_id', poiIds)
        .eq('status', 'approved')
        .order('is_cover', { ascending: false })
        .order('created_at', { ascending: false })

      const chosenByPoi = {}
      for (const img of (images || [])) {
        if (!chosenByPoi[img.poi_id]) chosenByPoi[img.poi_id] = img
      }

      const chosen = Object.values(chosenByPoi)
      if (chosen.length) {
        const thumbPaths = chosen.map((x) => deriveThumbPath(x.path))
        const signed = await admin.storage.from('poi-images').createSignedUrls(thumbPaths, 3600)
        const signedByPoi = {}
        for (let i = 0; i < chosen.length; i += 1) {
          signedByPoi[chosen[i].poi_id] = signed.data?.[i]?.signedUrl || null
        }
        for (const row of (poiRows || [])) {
          coverBySlug[row.slug] = signedByPoi[row.id] || null
        }
      }
    }
  }

  const enrich = (item) => ({ ...item, image_url: coverBySlug[item.slug] || null })

  return Response.json({
    newest: (newestPois || []).map(enrich),
    popular: popular.map(enrich),
    mostReviewed: mostReviewed.map(enrich),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
