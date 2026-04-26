import dynamicImport from 'next/dynamic'

const AdminPOIReviewClient = dynamicImport(() => import('@/components/AdminPOIReviewClient'), { ssr: false })

export const dynamic = 'force-dynamic'

export default function AdminPOIPage({ params }) {
  return <AdminPOIReviewClient forcedPoiId={params.id} />
}
