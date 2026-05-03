import AdminPOIReviewClient from '@/components/AdminPOIReviewClient'

export const dynamic = 'force-dynamic'

export default function AdminPOIPage({ params }) {
  return <AdminPOIReviewClient forcedPoiId={params.id} />
}
