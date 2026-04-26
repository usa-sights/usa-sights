import { requireUserRoute } from '@/utils/supabase/auth'

export async function GET(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.admin
    .from('profiles')
    .select('id,name,email,role,created_at,updated_at')
    .eq('id', auth.user.id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
