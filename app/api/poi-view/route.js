import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function POST(req) {
  let body = {}
  try {
    body = await req.json()
  } catch {}

  const poiId = String(body.poi_id || '').trim()
  if (!poiId) return Response.json({ ok: false, error: 'poi_id fehlt' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  const admin = createSupabaseAdminClient()
  const key = monthKey()

  try {
    const { data: existing, error: readError } = await admin
      .from('poi_view_stats')
      .select('id,view_count')
      .eq('poi_id', poiId)
      .eq('month_key', key)
      .maybeSingle()

    if (readError) {
      // Falls die optionale Statistik-Tabelle noch nicht installiert ist, soll die POI-Seite weiter funktionieren.
      return Response.json({ ok: true, skipped: true }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (existing?.id) {
      await admin
        .from('poi_view_stats')
        .update({ view_count: Number(existing.view_count || 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await admin
        .from('poi_view_stats')
        .insert({ poi_id: poiId, month_key: key, view_count: 1 })
    }

    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Tracking darf niemals die Nutzeransicht beschädigen.
    return Response.json({ ok: true, skipped: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
