import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export async function POST(req) {
  const body = await req.json()
  const paths = Array.isArray(body.paths) ? body.paths : []
  const supabase = createSupabaseAdminClient()

  const urls = {}
  for (const path of paths) {
    const { data, error } = await supabase.storage.from('poi-images').createSignedUrl(path, 3600)
    if (!error && data?.signedUrl) {
      urls[path] = data.signedUrl
      continue
    }

  }

  return Response.json({ urls }, { headers: { 'Cache-Control': 'no-store' } })
}
