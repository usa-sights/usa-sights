import { requireAdminRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { count, error } = await auth.admin
    .from('pois')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ count: count || 0 }, { headers: { 'Cache-Control': 'no-store' } })
}
