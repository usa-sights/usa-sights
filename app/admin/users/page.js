import dynamicImport from 'next/dynamic'
const AdminUsersClient = dynamicImport(() => import('@/components/AdminUsersClient'), { ssr: false })
export const dynamic = 'force-dynamic'
export default function Page() { return <AdminUsersClient /> }
