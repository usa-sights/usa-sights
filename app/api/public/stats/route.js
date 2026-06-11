import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { safeExactCount } from '@/lib/supabaseDb'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const CACHE_TTL_MS = 5 * 60 * 1000
const STALE_TTL_MS = 30 * 60 * 1000

const publicCacheHeaders = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
}

let cachedPayload = null
let cachedAt = 0
let pendingStatsPromise = null

function isFresh(now = Date.now()) {
  return cachedPayload && now - cachedAt < CACHE_TTL_MS
}

function isServeableStale(now = Date.now()) {
  return cachedPayload && now - cachedAt < STALE_TTL_MS
}

async function loadStats() {
  const admin = createSupabaseAdminClient()

  const [pois, images, links] = await Promise.all([
    safeExactCount(
      admin.from('pois').select('id', { count: 'exact', head: true }).eq('status', 'published')
    ),
    safeExactCount(
      admin.from('poi_images').select('id', { count: 'exact', head: true }).eq('status', 'approved')
    ),
    safeExactCount(
      admin.from('poi_external_links').select('id', { count: 'exact', head: true }).eq('status', 'published')
    ),
  ])

  return { stats: { pois, images, links }, generated_at: new Date().toISOString() }
}

async function getStatsPayload() {
  const now = Date.now()
  if (isFresh(now)) return cachedPayload

  if (!pendingStatsPromise) {
    pendingStatsPromise = loadStats()
      .then((payload) => {
        cachedPayload = payload
        cachedAt = Date.now()
        return payload
      })
      .finally(() => {
        pendingStatsPromise = null
      })
  }

  try {
    return await pendingStatsPromise
  } catch (error) {
    if (isServeableStale(now)) return cachedPayload
    throw error
  }
}

export async function GET() {
  try {
    const payload = await getStatsPayload()
    return Response.json(payload, { headers: publicCacheHeaders })
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Statistiken konnten nicht geladen werden.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
