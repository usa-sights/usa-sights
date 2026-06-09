import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deriveThumbPath } from '@/lib/imageUpload'
import { normalizeEditorialRecord, normalizePoiRecord } from '@/lib/poiEditorial'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function publicCacheHeaders() {
  return {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
    Pragma: 'no-cache',
    Expires: '0',
  }
}

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const fresh = searchParams.get('fresh') === '1'
  if (!slug) return Response.json({ error: 'slug fehlt' }, { status: 400, headers: noStoreHeaders() })

  const { data: poi, error: poiError } = await admin
    .from('pois')
    .select('*, categories(name)')
    .eq('slug', slug)
    .single()

  if (poiError) return Response.json({ error: poiError.message }, { status: 500, headers: noStoreHeaders() })

  const [editorialResult, linksResult, affiliateSettingsResult, providersResult, imagesResult] = await Promise.all([
    admin.from('poi_editorial').select('*').eq('poi_id', poi.id).maybeSingle(),
    admin.from('poi_external_links').select('*').eq('poi_id', poi.id).in('status', ['published', 'approved']).order('created_at', { ascending: true }),
    admin.from('poi_affiliate_settings').select('*').eq('poi_id', poi.id).eq('is_enabled', true),
    admin.from('affiliate_providers').select('provider_key,provider_name,is_global_enabled').order('sort_order'),
    admin.from('poi_images').select('*').eq('poi_id', poi.id).in('status', ['approved', 'published']).order('is_cover', { ascending: false }).order('is_gallery_pick', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
  ])

  const images = imagesResult.data || []

  let profileMap = {}
  const uploadedByIds = Array.from(new Set(images.map((x) => x.uploaded_by).filter(Boolean)))
  if (uploadedByIds.length) {
    const profileRes = await admin.from('profiles').select('id,name').in('id', uploadedByIds)
    profileMap = Object.fromEntries((profileRes.data || []).map((p) => [p.id, p.name || p.id]))
  }

  const providerMap = Object.fromEntries((providersResult.data || []).map((x) => [x.provider_key, x]))
  const affiliates = (affiliateSettingsResult.data || [])
    .filter((x) => x.is_enabled !== false)
    .filter((x) => providerMap[x.provider_key]?.is_global_enabled !== false)
    .filter((x) => String(x.manual_url || '').trim())
    .map((x) => ({
      provider_key: x.provider_key,
      provider_name: providerMap[x.provider_key]?.provider_name || x.provider_key,
      is_enabled: true,
      manual_url: x.manual_url,
      generated_text: x.generated_text,
      cta_text: x.cta_text || 'Verfügbarkeit prüfen',
      placement: x.placement || 'after_description',
      user_intent: x.user_intent || 'information',
      headline_override: x.headline_override || null,
      image_url: x.image_url || null,
    }))

  return Response.json({
    item: normalizePoiRecord(poi),
    editorial: editorialResult.data ? normalizeEditorialRecord(editorialResult.data) : null,
    links: linksResult.data || [],
    affiliates,
    images: images.map((img) => ({
      ...img,
      url: null,
      thumb_url: null,
      original_path: img.path || null,
      thumb_path: deriveThumbPath(img.path),
      uploaded_by_label: profileMap[img.uploaded_by] || null,
    })),
  }, {
    headers: fresh ? noStoreHeaders() : publicCacheHeaders()
  })
}
