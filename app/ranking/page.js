import dynamicImport from 'next/dynamic'
import { noStore } from 'next/cache'
import { getPublicRankingVisible } from '@/lib/appSettings'

const UserRankingClient = dynamicImport(() => import('@/components/UserRankingClient'), { ssr: false })

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Page() {
  noStore()
  const setting = await getPublicRankingVisible()
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
