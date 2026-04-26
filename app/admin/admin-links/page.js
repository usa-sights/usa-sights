import dynamicImport from 'next/dynamic'
const AdminLinksClient = dynamicImport(() => import('@/components/AdminLinksClient'), { ssr: false })
export const dynamic = 'force-dynamic'
export default function Page() { return <AdminLinksClient /> }
