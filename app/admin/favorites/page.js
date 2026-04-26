import dynamicImport from 'next/dynamic'
const AdminFavoritesClient = dynamicImport(() => import('@/components/AdminFavoritesClient'), { ssr: false })
export const dynamic = 'force-dynamic'
export default function Page() { return <AdminFavoritesClient /> }
