import dynamic from 'next/dynamic'
const MyPOIsTableClient = dynamic(() => import('@/components/MyPOIsTableClient'), { ssr: false })
export default function MyPOIsPage() { return <MyPOIsTableClient /> }
