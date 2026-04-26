import { requireUserRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'

async function getFavoriteImageMap(admin, poiIds = []) {
  if (!poiIds.length) return {}

  const { data: images, error } = await admin
    .from('poi_images')
    .select('poi_id,path,is_cover,created_at')
    .in('poi_id', poiIds)
    .eq('status', 'approved')
    .order('is_cover', { ascending: false })
    .order('created_at', { ascending: false })

  if (error || !images?.length) return {}

  const chosen = new Map()
  for (const image of images) {
    if (!chosen.has(image.poi_id)) chosen.set(image.poi_id, image)
  }

  const paths = Array.from(new Set(
    Array.from(chosen.values())
      .flatMap((image) => [deriveThumbPath(image.path), image.path])
      .filter(Boolean)
  ))

  let signedMap = {}
  if (paths.length) {
    const signed = await admin.storage.from('poi-images').createSignedUrls(paths, 3600)
    if (!signed.error) {
      signedMap = Object.fromEntries((signed.data || []).map((entry, idx) => [paths[idx], entry.signedUrl]))
    }
  }

  return Object.fromEntries(Array.from(chosen.entries()).map(([poiId, image]) => {
    const thumbPath = deriveThumbPath(image.path)
    return [poiId, {
      cover_thumb_url: signedMap[thumbPath] || signedMap[image.path] || null,
      cover_url: signedMap[image.path] || null,
      cover_thumb_path: thumbPath,
      cover_path: image.path,
    }]
  }))
}

export async function GET(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { data: favs, error } = await auth.admin.from('favorites').select('id, poi_id').eq('user_id', auth.user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!favs?.length) return Response.json({ items: [] })

  const ids = favs.map((x) => x.poi_id)
  const { data: pois, error: poiError } = await auth.admin
    .from('pois')
    .select('id,title,slug,short_description,latitude,longitude,state,city,address,categories(name)')
    .in('id', ids)
    .eq('status', 'published')
  if (poiError) return Response.json({ error: poiError.message }, { status: 500 })

  const imageMap = await getFavoriteImageMap(auth.admin, ids)
  const map = Object.fromEntries((pois || []).map((p) => {
    const image = imageMap[p.id] || {}
    return [p.id, {
      ...p,
      category: p.categories?.name || '',
      image: image.cover_thumb_url || image.cover_url || '',
      cover_thumb_url: image.cover_thumb_url || null,
      cover_url: image.cover_url || null,
      cover_thumb_path: image.cover_thumb_path || null,
      cover_path: image.cover_path || null,
    }]
  }))
  const items = favs.map((f) => ({ id: f.id, poi_id: f.poi_id, pois: map[f.poi_id] || null })).filter((x) => x.pois)
  return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}
