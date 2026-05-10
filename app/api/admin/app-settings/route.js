import { requireAdminRoute } from '@/utils/supabase/auth'
import { getMaintenanceMode, getPublicRankingVisible, setAppSetting } from '@/lib/appSettings'

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
    const [ranking, maintenance] = await Promise.all([
      getPublicRankingVisible(auth.admin),
      getMaintenanceMode(auth.admin),
    ])
    return noStoreJson({
      publicRankingVisible: ranking.value,
      maintenanceMode: maintenance.value,
      missingTable: ranking.missingTable || maintenance.missingTable,
    })
  } catch (error) {
    return noStoreJson({ error: error.message || 'Einstellungen konnten nicht geladen werden.' }, { status: 500 })
  }
}

async function updateSettings(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return noStoreJson({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const updates = []
    const response = { ok: true }

    if (Object.prototype.hasOwnProperty.call(body, 'publicRankingVisible')) {
      const next = body?.publicRankingVisible === true
      await setAppSetting('public_ranking_visible', next, auth.admin)
      const persisted = await getPublicRankingVisible(auth.admin)
      response.publicRankingVisible = persisted.value === true
      response.ok = response.ok && persisted.value === next
      response.message = `Öffentliches Ranking ${persisted.value ? 'freigeschaltet' : 'versteckt'}.`
      updates.push('ranking')
    }

    if (Object.prototype.hasOwnProperty.call(body, 'maintenanceMode')) {
      const next = body?.maintenanceMode === true
      await setAppSetting('maintenance_mode', next, auth.admin)
      const persisted = await getMaintenanceMode(auth.admin)
      response.maintenanceMode = persisted.value === true
      response.ok = response.ok && persisted.value === next
      response.message = `Wartungsmodus ${persisted.value ? 'aktiviert' : 'deaktiviert'}.`
      updates.push('maintenance')
    }

    if (!updates.length) {
      const [ranking, maintenance] = await Promise.all([
        getPublicRankingVisible(auth.admin),
        getMaintenanceMode(auth.admin),
      ])
      response.publicRankingVisible = ranking.value === true
      response.maintenanceMode = maintenance.value === true
      response.message = 'Keine Änderung übergeben.'
    }

    return noStoreJson(response)
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
