import { getMaintenanceMode, getPublicRankingVisible } from '@/lib/appSettings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [ranking, maintenance] = await Promise.all([getPublicRankingVisible(), getMaintenanceMode()])
    return Response.json({ publicRankingVisible: ranking.value, maintenanceMode: maintenance.value, missingTable: ranking.missingTable || maintenance.missingTable }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Pragma': 'no-cache', 'Expires': '0' }
    })
  } catch (error) {
    return Response.json({ publicRankingVisible: false, maintenanceMode: false, error: error.message || 'Einstellungen konnten nicht geladen werden.' }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Pragma': 'no-cache', 'Expires': '0' } })
  }
}
