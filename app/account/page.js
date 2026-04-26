import dynamicImport from 'next/dynamic'
const UserDashboardClient = dynamicImport(() => import('@/components/UserDashboardClient'), { ssr: false })

export const dynamic = 'force-dynamic'

export default function AccountPage() {
  return <UserDashboardClient />
}
