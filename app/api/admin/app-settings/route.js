import { requireAdminRoute } from '@/utils/supabase/auth'
import { getPublicRankingVisible, setAppSetting } from '@/lib/appSettings'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  try {
    const result = await getPublicRankingVisible(auth.admin)
    return Response.json({ publicRankingVisible: result.value, missingTable: result.missingTable }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Einstellungen konnten nicht geladen werden.' }, { status: 500 })
  }
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const next = body?.publicRankingVisible === true
    const data = await setAppSetting('public_ranking_visible', next, auth.admin)
    return Response.json({ ok: true, publicRankingVisible: data?.value_json === true, message: `Öffentliches Ranking ${next ? 'freigeschaltet' : 'versteckt'}.` }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Einstellung konnte nicht gespeichert werden.' }, { status: 500 })
  }
}
