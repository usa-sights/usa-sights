import dynamic from 'next/dynamic'
const AffiliateProvidersTableClient = dynamic(() => import('@/components/AffiliateProvidersTableClient'), { ssr: false })
export default function AffiliateProvidersPage() { return <AffiliateProvidersTableClient /> }
