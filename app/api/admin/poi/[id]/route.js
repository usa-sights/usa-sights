import { requireAdminRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'
import { normalizeEditorialRecord, normalizePoiRecord, normalizeList, normalizeFamilyFriendly, normalizeText } from '@/lib/poiEditorial'

export const dynamic = 'force-dynamic'

function noStoreJson(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...(init.headers || {}),
    },
  })
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

export async function GET(req, { params }) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return noStoreJson({ error: auth.error }, { status: auth.status })
  const id = params.id
  const admin = auth.admin
  const [poiRes, editorialRes, linksRes, affiliateRes, imagesRes] = await Promise.all([
    admin.from('pois').select('*, categories(name)').eq('id', id).single(),
    admin.from('poi_editorial').select('*').eq('poi_id', id).maybeSingle(),
    admin.from('poi_external_links').select('*').eq('poi_id', id).order('created_at', { ascending: true }),
    admin.from('poi_affiliate_settings').select('*').eq('poi_id', id).order('provider_key'),
    admin.from('poi_images').select('*').eq('poi_id', id).order('is_cover', { ascending: false }).order('is_gallery_pick', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
  ])
  if (poiRes.error) return noStoreJson({ error: poiRes.error.message }, { status: 500 })
  if (editorialRes.error) return noStoreJson({ error: editorialRes.error.message }, { status: 500 })

  let images = imagesRes.data || []
  if (images.length) {
    const paths = Array.from(new Set(images.flatMap((x) => [x.path, deriveThumbPath(x.path)]).filter(Boolean)))
    const signed = await admin.storage.from('poi-images').createSignedUrls(paths, 3600)
    const urlMap = Object.fromEntries((signed.data || []).map((x, i) => [paths[i], x?.signedUrl || null]))
    images = images.map((img) => ({ ...img, url: urlMap[img.path] || null, thumb_url: urlMap[deriveThumbPath(img.path)] || urlMap[img.path] || null }))
  }

  return noStoreJson({
    item: normalizePoiRecord(poiRes.data),
    editorial: editorialRes.data ? normalizeEditorialRecord(editorialRes.data) : null,
    links: linksRes.data || [],
    affiliate_settings: affiliateRes.data || [],
    images,
  })
}

export async function PUT(req, { params }) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return noStoreJson({ error: auth.error }, { status: auth.status })
  const id = params.id
  const body = await req.json().catch(() => ({}))
  const admin = auth.admin
  const poiPayload = body.poi || {}
  const editorialPayload = body.editorial || {}
  const nextStatus = ['pending','published','rejected'].includes(poiPayload.status) ? poiPayload.status : 'pending'

  const updatePayload = {
    title: normalizeText(poiPayload.title, null),
    slug: normalizeText(poiPayload.slug, null),
    category_id: poiPayload.category_id || null,
    state: normalizeText(poiPayload.state, null),
    city: normalizeText(poiPayload.city, null),
    address: normalizeText(poiPayload.address, null),
    latitude: numberOrNull(poiPayload.latitude),
    longitude: numberOrNull(poiPayload.longitude),
    short_description: normalizeText(poiPayload.short_description, null),
    description: normalizeText(poiPayload.description, null),
    opening_hours_text: normalizeText(poiPayload.opening_hours_text, null),
    price_info_text: normalizeText(poiPayload.price_info_text, null),
    hotels_nearby_text: normalizeText(poiPayload.hotels_nearby_text, null),
    website_url: normalizeText(poiPayload.website_url, null),
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === 'published') updatePayload.approved_by = auth.user.id

  const { data: poi, error: poiError } = await admin.from('pois').update(updatePayload).eq('id', id).select('*, categories(name)').single()
  if (poiError) return noStoreJson({ error: poiError.message }, { status: 500 })

  const editorialUpsertPayload = {
    poi_id: id,
    highlights_json: normalizeList(editorialPayload.highlights_json),
    nice_to_know_json: normalizeList(editorialPayload.nice_to_know_json),
    visit_duration_text: normalizeText(editorialPayload.visit_duration_text, null),
    best_time_to_visit_text: normalizeText(editorialPayload.best_time_to_visit_text, null),
    family_friendly_json: normalizeFamilyFriendly(editorialPayload.family_friendly_json),
    suggested_tags_json: normalizeList(editorialPayload.suggested_tags_json),
    seo_title: normalizeText(editorialPayload.seo_title, null),
    seo_description: normalizeText(editorialPayload.seo_description, null),
    editorial_review_notes_json: normalizeList(editorialPayload.editorial_review_notes_json),
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }
  const { data: editorial, error: editorialError } = await admin.from('poi_editorial').upsert(editorialUpsertPayload, { onConflict: 'poi_id' }).select().single()
  if (editorialError) return noStoreJson({ error: editorialError.message }, { status: 500 })

  return noStoreJson({ item: normalizePoiRecord(poi), editorial: normalizeEditorialRecord(editorial) })
}
