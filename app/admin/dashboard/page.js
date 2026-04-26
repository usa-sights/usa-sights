import dynamic from 'next/dynamic'
const AdminDashboardClient = dynamic(() => import('@/components/AdminDashboardClient'), { ssr: false })
export default function AdminDashboardPage() { return <AdminDashboardClient /> }
