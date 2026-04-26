import { requireAdminRoute } from '@/utils/supabase/auth'

function defaultPlacement(providerKey) {
  const key = String(providerKey || '').toLowerCase()
  if (key === 'booking' || key === 'getyourguide') return 'after_visit_info'
  return 'after_description'
}

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const [settingsResult, providersResult] = await Promise.all([
    auth.admin.from('poi_affiliate_settings').select('*').eq('poi_id', poiId),
    auth.admin.from('affiliate_providers').select('*').order('sort_order'),
  ])

  if (settingsResult.error) return Response.json({ error: settingsResult.error.message }, { status: 500 })
  if (providersResult.error) return Response.json({ error: providersResult.error.message }, { status: 500 })

  const settings = settingsResult.data || []
  const providers = providersResult.data || []

  const items = providers.map((provider) => {
    const existing = settings.find((x) => x.provider_key === provider.provider_key)
    return {
      provider_key: provider.provider_key,
      provider_name: provider.provider_name,
      is_global_enabled: !!provider.is_global_enabled,
      is_enabled: existing?.is_enabled ?? true,
      manual_url: existing?.manual_url || '',
      generated_text: existing?.generated_text || '',
      cta_text: existing?.cta_text || 'Verfügbarkeit prüfen',
      placement: existing?.placement || defaultPlacement(provider.provider_key),
      user_intent: existing?.user_intent || 'information',
    }
  })

  return Response.json({ items })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()

  const payload = {
    poi_id: body.poi_id,
    provider_key: body.provider_key,
    is_enabled: !!body.is_enabled,
    manual_url: body.manual_url || null,
    generated_text: body.generated_text || null,
    cta_text: body.cta_text || 'Verfügbarkeit prüfen',
    placement: body.placement || defaultPlacement(body.provider_key),
    user_intent: body.user_intent || 'information',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await auth.admin
    .from('poi_affiliate_settings')
    .upsert(payload, { onConflict: 'poi_id,provider_key' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
