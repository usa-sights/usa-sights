import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

function toNum(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)

  const categoryId = searchParams.get('category_id')
  const q = searchParams.get('q')
  const state = searchParams.get('state')
  const includeImages = searchParams.get('include_images') === '1'

  const minLat = toNum(searchParams.get('minLat'))
  const maxLat = toNum(searchParams.get('maxLat'))
  const minLng = toNum(searchParams.get('minLng'))
  const maxLng = toNum(searchParams.get('maxLng'))

  const limit = Math.min(Number(searchParams.get('limit') || 300), 800)
  const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

  let query = admin
    .from('pois')
    .select('id,title,slug,short_description,city,state,address,latitude,longitude,categories(name)', { count: 'exact' })
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (categoryId) query = query.eq('category_id', categoryId)
  if (state) query = query.eq('state', state)
  if (q) query = query.or(`title.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%,address.ilike.%${q}%`)
  if (minLat !== null && maxLat !== null) query = query.gte('latitude', minLat).lte('latitude', maxLat)
  if (minLng !== null && maxLng !== null) query = query.gte('longitude', minLng).lte('longitude', maxLng)

  const { data, error, count } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const items = data || []
  let imageMap = {}
  if (items.length) {
    const poiIds = items.map((x) => x.id)
    const imagesRes = await admin
      .from('poi_images')
      .select('poi_id,path,is_cover,created_at')
      .in('poi_id', poiIds)
      .eq('status', 'approved')
      .order('is_cover', { ascending: false })
      .order('created_at', { ascending: false })

    const chosen = new Map()
    for (const img of (imagesRes.data || [])) {
      if (!chosen.has(img.poi_id)) chosen.set(img.poi_id, img)
    }

    if (includeImages) {
      const paths = Array.from(new Set(Array.from(chosen.values()).flatMap((img) => [deriveThumbPath(img.path), img.path]).filter(Boolean)))
      if (paths.length) {
        const signed = await admin.storage.from('poi-images').createSignedUrls(paths, 3600)
        if (!signed.error) {
          const signedMap = Object.fromEntries((signed.data || []).map((entry, idx) => [paths[idx], entry.signedUrl]))
          imageMap = Object.fromEntries(Array.from(chosen.entries()).map(([poiId, img]) => [poiId, {
            cover_url: signedMap[img.path] || null,
            cover_thumb_url: signedMap[deriveThumbPath(img.path)] || signedMap[img.path] || null,
            cover_path: img.path,
            cover_thumb_path: deriveThumbPath(img.path),
          }]))
        }
      }
    } else {
      imageMap = Object.fromEntries(Array.from(chosen.entries()).map(([poiId, img]) => [poiId, {
        cover_path: img.path,
        cover_thumb_path: deriveThumbPath(img.path),
      }]))
    }
  }

  return Response.json({
    items: items.map((item) => {
      const image = imageMap[item.id] || {}
      return {
        id: item.id,
        title: item.title,
        slug: item.slug,
        lat: item.latitude,
        lng: item.longitude,
        latitude: item.latitude,
        longitude: item.longitude,
        category: item.categories?.name || '',
        categories: item.categories || null,
        image: image.cover_thumb_url || image.cover_url || '',
        cover_thumb_url: image.cover_thumb_url || null,
        cover_thumb_path: image.cover_thumb_path || null,
        cover_path: image.cover_path || null,
        city: item.city || '',
        state: item.state || '',
        address: item.address || '',
        short_description: item.short_description || '',
      }
    }),
    total: count || 0,
    limit,
    offset,
    has_more: (offset + limit) < (count || 0)
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  })
}
