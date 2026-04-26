import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const { data, error } = await admin
    .from('poi_affiliate_settings')
    .select('provider_key,is_enabled,manual_url,generated_text,cta_text,placement,user_intent')
    .eq('poi_id', poiId)
    .eq('is_enabled', true)

  if (error) return Response.json({ items: [], warning: error.message })

  let providers = {}
  const { data: providerRows } = await admin
    .from('affiliate_providers')
    .select('provider_key,provider_name,is_global_enabled')

  for (const row of (providerRows || [])) providers[row.provider_key] = row

  const items = (data || [])
    .filter((x) => providers[x.provider_key]?.is_global_enabled !== false)
    .map((x) => ({
      provider_key: x.provider_key,
      provider_name: providers[x.provider_key]?.provider_name || x.provider_key,
      is_enabled: true,
      manual_url: x.manual_url,
      generated_text: x.generated_text,
      cta_text: x.cta_text || 'Verfügbarkeit prüfen',
      placement: x.placement || 'after_description',
      user_intent: x.user_intent || 'information',
    }))

  return Response.json({ items })
}
