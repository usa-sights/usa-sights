import { requireAdminRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'
import { normalizeEditorialRecord, normalizePoiRecord, normalizeList, normalizeFamilyFriendly, normalizeText } from '@/lib/poiEditorial'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

function preserveText(value, current = null) {
  const next = normalizeText(value, null)
  if (next === null || next === '') return current ?? null
  return next
}

function preserveNumber(value, current = null) {
  const next = numberOrNull(value)
  return next === null ? (current ?? null) : next
}

function preserveList(value, current = []) {
  const next = normalizeList(value)
  return next.length ? next : normalizeList(current)
}

function preserveFamily(value, current = {}) {
  const next = normalizeFamilyFriendly(value)
  const hasNext = typeof next.value === 'boolean' || String(next.reason || '').trim()
  return hasNext ? next : normalizeFamilyFriendly(current)
}

async function buildSignedUrlMap(admin, paths = []) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))
  const entries = await Promise.all(uniquePaths.map(async (path) => {
    const { data } = await admin.storage.from('poi-images').createSignedUrl(path, 3600)
    if (data?.signedUrl) return [path, data.signedUrl]
    return [path, null]
  }))
  return Object.fromEntries(entries.filter(([, url]) => !!url))
}

async function approveRelatedPublicContent(admin, poiId) {
  const now = new Date().toISOString()
  await admin.from('poi_images').update({ status: 'approved' }).eq('poi_id', poiId).in('status', ['pending', 'approved'])
  await admin.from('poi_external_links').update({ status: 'published', updated_at: now }).eq('poi_id', poiId).in('status', ['pending', 'published'])
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
    const paths = Array.from(new Set(images.flatMap((x) => [deriveThumbPath(x.path), x.path]).filter(Boolean)))
    const urlMap = await buildSignedUrlMap(admin, paths)
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

  const [existingPoiRes, existingEditorialRes] = await Promise.all([
    admin.from('pois').select('*').eq('id', id).maybeSingle(),
    admin.from('poi_editorial').select('*').eq('poi_id', id).maybeSingle(),
  ])
  if (existingPoiRes.error) return noStoreJson({ error: existingPoiRes.error.message }, { status: 500 })
  const existingPoi = normalizePoiRecord(existingPoiRes.data || {})
  const existingEditorial = normalizeEditorialRecord(existingEditorialRes.data || {})

  const nextStatus = ['pending','published','rejected'].includes(poiPayload.status) ? poiPayload.status : (existingPoi.status || 'pending')

  const updatePayload = {
    title: preserveText(poiPayload.title, existingPoi.title),
    slug: preserveText(poiPayload.slug, existingPoi.slug),
    category_id: poiPayload.category_id || existingPoi.category_id || null,
    state: preserveText(poiPayload.state, existingPoi.state),
    city: preserveText(poiPayload.city, existingPoi.city),
    address: preserveText(poiPayload.address, existingPoi.address),
    latitude: preserveNumber(poiPayload.latitude, existingPoi.latitude),
    longitude: preserveNumber(poiPayload.longitude, existingPoi.longitude),
    short_description: preserveText(poiPayload.short_description, existingPoi.short_description),
    description: preserveText(poiPayload.description, existingPoi.description),
    opening_hours_text: preserveText(poiPayload.opening_hours_text, existingPoi.opening_hours_text),
    price_info_text: preserveText(poiPayload.price_info_text, existingPoi.price_info_text),
    hotels_nearby_text: preserveText(poiPayload.hotels_nearby_text, existingPoi.hotels_nearby_text),
    website_url: preserveText(poiPayload.website_url, existingPoi.website_url),
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === 'published') updatePayload.approved_by = auth.user.id

  const { data: poi, error: poiError } = await admin.from('pois').update(updatePayload).eq('id', id).select('*, categories(name)').single()
  if (poiError) return noStoreJson({ error: poiError.message }, { status: 500 })

  if (nextStatus === 'published') {
    await approveRelatedPublicContent(admin, id)
  }

  const editorialUpsertPayload = {
    poi_id: id,
    highlights_json: preserveList(editorialPayload.highlights_json, existingEditorial.highlights_json),
    nice_to_know_json: preserveList(editorialPayload.nice_to_know_json, existingEditorial.nice_to_know_json),
    visit_duration_text: preserveText(editorialPayload.visit_duration_text, existingEditorial.visit_duration_text),
    best_time_to_visit_text: preserveText(editorialPayload.best_time_to_visit_text, existingEditorial.best_time_to_visit_text),
    family_friendly_json: preserveFamily(editorialPayload.family_friendly_json, existingEditorial.family_friendly_json),
    suggested_tags_json: preserveList(editorialPayload.suggested_tags_json, existingEditorial.suggested_tags_json),
    seo_title: preserveText(editorialPayload.seo_title, existingEditorial.seo_title),
    seo_description: preserveText(editorialPayload.seo_description, existingEditorial.seo_description),
    editorial_review_notes_json: preserveList(editorialPayload.editorial_review_notes_json, existingEditorial.editorial_review_notes_json),
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }
  const { data: editorial, error: editorialError } = await admin.from('poi_editorial').upsert(editorialUpsertPayload, { onConflict: 'poi_id' }).select().single()
  if (editorialError) return noStoreJson({ error: editorialError.message }, { status: 500 })

  return noStoreJson({ item: normalizePoiRecord(poi), editorial: normalizeEditorialRecord(editorial) })
}
