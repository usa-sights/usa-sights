import dynamic from 'next/dynamic'
const ExploreClient = dynamic(() => import('@/components/ExploreClient'), { ssr: false })
export default function ExplorePage() { return <ExploreClient /> }
