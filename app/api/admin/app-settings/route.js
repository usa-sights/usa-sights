import { requireAdminRoute } from '@/utils/supabase/auth'
import { getPublicRankingVisible, setAppSetting } from '@/lib/appSettings'

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

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return noStoreJson({ error: auth.error }, { status: auth.status })
  try {
    const result = await getPublicRankingVisible(auth.admin)
    return noStoreJson({ publicRankingVisible: result.value, missingTable: result.missingTable })
  } catch (error) {
    return noStoreJson({ error: error.message || 'Einstellungen konnten nicht geladen werden.' }, { status: 500 })
  }
}

async function updateSettings(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return noStoreJson({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const next = body?.publicRankingVisible === true
    await setAppSetting('public_ranking_visible', next, auth.admin)
    const persisted = await getPublicRankingVisible(auth.admin)

    return noStoreJson({
      ok: persisted.value === next,
      publicRankingVisible: persisted.value === true,
      message: `Öffentliches Ranking ${persisted.value ? 'freigeschaltet' : 'versteckt'}.`,
    })
  } catch (error) {
    return noStoreJson({ error: error.message || 'Einstellung konnte nicht gespeichert werden.' }, { status: 500 })
  }
}

export async function POST(req) {
  return updateSettings(req)
}

export async function PUT(req) {
  return updateSettings(req)
}

export async function PATCH(req) {
  return updateSettings(req)
}
