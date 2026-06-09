import { createSupabaseAdminClient } from '@/utils/supabase/admin'

const MAX_PATHS_PER_REQUEST = 24

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const paths = Array.from(new Set((Array.isArray(body.paths) ? body.paths : [])
    .map((path) => typeof path === 'string' ? path.trim() : '')
    .filter(Boolean)))
    .slice(0, MAX_PATHS_PER_REQUEST)

  if (!paths.length) {
    return Response.json({ urls: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.storage.from('poi-images').createSignedUrls(paths, 3600)

  const urls = {}
  if (!error && Array.isArray(data)) {
    for (let index = 0; index < paths.length; index += 1) {
      const signedUrl = data[index]?.signedUrl
      if (signedUrl) urls[paths[index]] = signedUrl
    }
  }

  return Response.json({ urls }, { headers: { 'Cache-Control': 'no-store' } })
}
