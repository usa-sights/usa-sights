import dynamic from 'next/dynamic'
const POIDetailClient = dynamic(() => import('@/components/POIDetailClient'), { ssr: false })
export default function POIDetailPage({ params }) { return <POIDetailClient slug={params.slug} /> }
