import dynamic from 'next/dynamic'
const AdminCategoriesTableClient = dynamic(() => import('@/components/AdminCategoriesTableClient'), { ssr: false })
export default function AdminCategoriesPage() { return <AdminCategoriesTableClient /> }
