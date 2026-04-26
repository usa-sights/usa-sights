import dynamic from 'next/dynamic'
const AdminChangeRequestsClient = dynamic(() => import('@/components/AdminChangeRequestsClient'), { ssr: false })
export default function AdminChangeRequestsPage() { return <AdminChangeRequestsClient /> }
