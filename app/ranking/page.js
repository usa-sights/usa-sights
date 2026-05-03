import { unstable_noStore as noStore } from 'next/cache'
import UserRankingClient from '@/components/UserRankingClient'
import { getPublicRankingVisible } from '@/lib/appSettings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Page() {
  noStore()

  let setting
  try {
    setting = await getPublicRankingVisible()
  } catch (error) {
    console.error('Ranking setting could not be loaded', error)
    return (
      <main className="container">
        <div className="card" style={{ marginTop: 16 }}>
          <h1>User-Ranking</h1>
          <p className="muted">Das öffentliche Ranking konnte gerade nicht geladen werden.</p>
        </div>
      </main>
    )
  }

  if (!setting.value) {
    return (
      <main className="container">
        <div className="card" style={{ marginTop: 16 }}>
          <h1>User-Ranking</h1>
          <p className="muted">Das öffentliche Ranking ist aktuell nicht freigeschaltet.</p>
        </div>
      </main>
    )
  }

  return <UserRankingClient />
}
