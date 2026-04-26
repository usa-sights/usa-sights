import { getPublicRankingVisible } from '@/lib/appSettings'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await getPublicRankingVisible()
    return Response.json({ publicRankingVisible: result.value, missingTable: result.missingTable }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }
    })
  } catch (error) {
    return Response.json({ publicRankingVisible: false, error: error.message || 'Einstellungen konnten nicht geladen werden.' }, { status: 500 })
  }
}
