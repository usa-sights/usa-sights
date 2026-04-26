import dynamic from 'next/dynamic'
const SubmitClient = dynamic(() => import('@/components/SubmitPOIClient'), { ssr: false })
export default function SubmitPOIPage() { return <SubmitClient /> }
