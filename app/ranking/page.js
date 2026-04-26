import dynamicImport from 'next/dynamic'
const UserRankingClient = dynamicImport(() => import('@/components/UserRankingClient'), { ssr: false })
export const dynamic = 'force-dynamic'
export default function Page() { return <UserRankingClient /> }
