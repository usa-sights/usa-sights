import dynamicImport from 'next/dynamic'
const AdminReviewsClient = dynamicImport(() => import('@/components/AdminReviewsClient'), { ssr: false })
export const dynamic = 'force-dynamic'
export default function Page() { return <AdminReviewsClient /> }
