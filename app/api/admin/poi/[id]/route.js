import { requireAdminRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function normalizeJsonArray(value) {
  const parsed = parseMaybeJson(value)
  if (Array.isArray(parsed)) return parsed.filter(Boolean)
  if (typeof parsed === 'string') return parsed.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  return []
}

function normalizeJsonObject(value) {
  const parsed = parseMaybeJson(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function normalizeEditorial(row) {
  if (!row) return null
  return {
    ...row,
    highlights_json: normalizeJsonArray(row.highlights_json ?? row.highlights),
    nice_to_know_json: normalizeJsonArray(row.nice_to_know_json ?? row.nice_to_know),
    family_friendly_json: normalizeJsonObject(row.family_friendly_json),
    suggested_tags_json: normalizeJsonArray(row.suggested_tags_json ?? row.suggested_tags),
    editorial_review_notes_json: normalizeJsonArray(row.editorial_review_notes_json ?? row.editorial_review_notes),
  }
}

export async function GET(req, { params }) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const id = params.id
  const admin = auth.admin
  const [poiRes, editorialRes, linksRes, affiliateRes, imagesRes] = await Promise.all([
    admin.from('pois').select('*, categories(name)').eq('id', id).single(),
    admin.from('poi_editorial').select('*').eq('poi_id', id).maybeSingle(),
    admin.from('poi_external_links').select('*').eq('poi_id', id).order('created_at', { ascending: true }),
    admin.from('poi_affiliate_settings').select('*').eq('poi_id', id).order('provider_key'),
    admin.from('poi_images').select('*').eq('poi_id', id).order('is_cover', { ascending: false }).order('is_gallery_pick', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
  ])
  if (poiRes.error) return Response.json({ error: poiRes.error.message }, { status: 500 })
  if (editorialRes.error) return Response.json({ error: editorialRes.error.message }, { status: 500 })
  let images = imagesRes.data || []
  if (images.length) {
    const paths = Array.from(new Set(images.flatMap((x) => [x.path, deriveThumbPath(x.path)]).filter(Boolean)))
    const signed = await admin.storage.from('poi-images').createSignedUrls(paths, 3600)
    const urlMap = Object.fromEntries((signed.data || []).map((x, i) => [paths[i], x?.signedUrl || null]))
    images = images.map((img) => ({ ...img, url: urlMap[img.path] || null, thumb_url: urlMap[deriveThumbPath(img.path)] || urlMap[img.path] || null }))
  }
  return Response.json({ item: poiRes.data, editorial: normalizeEditorial(editorialRes.data), links: linksRes.data || [], affiliate_settings: affiliateRes.data || [], images }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req, { params }) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const id = params.id
  const body = await req.json()
  const admin = auth.admin
  const poiPayload = body.poi || {}
  const editorialPayload = body.editorial || {}
  const nextStatus = ['pending','published','rejected'].includes(poiPayload.status) ? poiPayload.status : 'pending'
  const updatePayload = {
    title: poiPayload.title || null,
    slug: poiPayload.slug || null,
    category_id: poiPayload.category_id || null,
    state: poiPayload.state || null,
    city: poiPayload.city || null,
    address: poiPayload.address || null,
    latitude: poiPayload.latitude === '' || poiPayload.latitude == null ? null : Number(poiPayload.latitude),
    longitude: poiPayload.longitude === '' || poiPayload.longitude == null ? null : Number(poiPayload.longitude),
    short_description: poiPayload.short_description || null,
    description: poiPayload.description || null,
    opening_hours_text: poiPayload.opening_hours_text || null,
    price_info_text: poiPayload.price_info_text || null,
    hotels_nearby_text: poiPayload.hotels_nearby_text || null,
    website_url: poiPayload.website_url || null,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === 'published') updatePayload.approved_by = auth.user.id
  const { data: poi, error: poiError } = await admin.from('pois').update(updatePayload).eq('id', id).select('*, categories(name)').single()
  if (poiError) return Response.json({ error: poiError.message }, { status: 500 })
  const { data: editorial, error: editorialError } = await admin.from('poi_editorial').upsert({ poi_id:id, highlights_json: editorialPayload.highlights_json || [], nice_to_know_json: editorialPayload.nice_to_know_json || [], visit_duration_text: editorialPayload.visit_duration_text || null, best_time_to_visit_text: editorialPayload.best_time_to_visit_text || null, family_friendly_json: editorialPayload.family_friendly_json || {}, suggested_tags_json: editorialPayload.suggested_tags_json || [], seo_title: editorialPayload.seo_title || null, seo_description: editorialPayload.seo_description || null, editorial_review_notes_json: editorialPayload.editorial_review_notes_json || [], updated_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: 'poi_id' }).select().single()
  if (editorialError) return Response.json({ error: editorialError.message }, { status: 500 })
  return Response.json({ item: poi, editorial }, { headers: { 'Cache-Control': 'no-store' } })
}
