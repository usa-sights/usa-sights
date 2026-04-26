import { requireAdminRoute } from '@/utils/supabase/auth'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const { data, error } = await auth.admin
    .from('ai_generations')
    .select('*')
    .eq('poi_id', poiId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] })
}

export async function POST(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()

  const { data, error } = await auth.admin
    .from('ai_generations')
    .insert({
      poi_id: body.poi_id,
      type: body.type || 'poi_editorial',
      input_json: body.source_input_json || {},
      source_input_json: body.source_input_json || {},
      prompt_version: body.prompt_version || 'v2',
      model: body.model || 'gpt-4.1-mini',
      output_json: body.output_json || {},
      created_by: auth.user.id,
      accepted_at: body.accepted_at || null,
      accepted_by: body.accepted_by || null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
