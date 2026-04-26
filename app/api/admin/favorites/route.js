import { requireAdminRoute } from '@/utils/supabase/auth'
export const dynamic = 'force-dynamic'
export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.admin.from('favorites').select('*, pois(title,slug)').order('created_at', { ascending: false }).limit(500)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] })
}
