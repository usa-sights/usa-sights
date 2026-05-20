import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function noStoreHeaders() {
  return { 'Cache-Control': 'no-store' }
}

function isMissingStatsSetup(error) {
  const msg = String(error?.message || error?.details || error?.hint || '').toLowerCase()
  const code = String(error?.code || '')
  return (
    code === '42P01' ||
    code === '42883' ||
    msg.includes('poi_view_stats') ||
    msg.includes('increment_poi_view') ||
    msg.includes('does not exist') ||
    msg.includes('not found')
  )
}

async function incrementWithFallback(admin, poiId, key) {
  const rpcResult = await admin.rpc('increment_poi_view', { p_poi_id: poiId, p_month_key: key })
  if (!rpcResult.error) return { ok: true, method: 'rpc' }
  if (!isMissingStatsSetup(rpcResult.error)) throw rpcResult.error

  const { data: existing, error: readError } = await admin
    .from('poi_view_stats')
    .select('id,view_count')
    .eq('poi_id', poiId)
    .eq('month_key', key)
    .maybeSingle()

  if (readError) {
    if (isMissingStatsSetup(readError)) return { ok: true, skipped: true, reason: 'stats_table_missing' }
    throw readError
  }

  if (existing?.id) {
    const { error: updateError } = await admin
      .from('poi_view_stats')
      .update({ view_count: Number(existing.view_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return { ok: true, method: 'update' }
  }

  const { error: insertError } = await admin
    .from('poi_view_stats')
    .insert({ poi_id: poiId, month_key: key, view_count: 1 })
  if (insertError) throw insertError
  return { ok: true, method: 'insert' }
}

export async function POST(req) {
  let body = {}
  try {
    body = await req.json()
  } catch {}

  const poiId = String(body.poi_id || '').trim()
  if (!poiId) return Response.json({ ok: false, error: 'poi_id fehlt' }, { status: 400, headers: noStoreHeaders() })

  try {
    const admin = createSupabaseAdminClient()
    const result = await incrementWithFallback(admin, poiId, monthKey())
    return Response.json(result, { headers: noStoreHeaders() })
  } catch (error) {
    // Tracking darf niemals die Nutzeransicht beschädigen. Der Fehler wird für Tests/Logs trotzdem klar zurückgegeben.
    return Response.json({ ok: true, skipped: true, reason: 'tracking_failed', detail: String(error?.message || error || '') }, { headers: noStoreHeaders() })
  }
}
