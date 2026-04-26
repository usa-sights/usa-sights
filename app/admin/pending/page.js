import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminPendingDeprecatedPage() {
  redirect('/admin/dashboard')
}
