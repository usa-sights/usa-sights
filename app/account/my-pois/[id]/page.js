import dynamicImport from 'next/dynamic'

const MyPOIDetailClient = dynamicImport(() => import('@/components/MyPOIDetailClient'), { ssr: false })

export const dynamic = 'force-dynamic'

export default function MyPOIDetailPage({ params }) {
  return <MyPOIDetailClient poiId={params.id} />
}
