import { requireUserRoute } from '@/utils/supabase/auth'
import { buildStoragePaths } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

async function isAdminUser(admin, userId) {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

function safeFileName(value, index) {
  const name = String(value || `image-${index}.webp`).trim()
  return name || `image-${index}.webp`
}

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const poiId = String(body.poi_id || '').trim()
  const caption = String(body.caption || '').trim() || null
  const prefix = String(body.variant_prefix || 'upload').trim() || 'upload'
  const files = Array.isArray(body.files) ? body.files.slice(0, 20) : []

  if (!poiId) return Response.json({ error: 'POI-ID fehlt.' }, { status: 400 })
  if (!files.length) return Response.json({ error: 'Keine Bilddateien übergeben.' }, { status: 400 })

  const admin = auth.admin
  const adminMode = await isAdminUser(admin, auth.user.id)
  const uploads = []

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i] || {}
    const { originalPath, thumbPath } = buildStoragePaths({
      userId: auth.user.id,
      poiId,
      index: i,
      fileName: safeFileName(file.filename, i),
      variantPrefix: prefix,
    })

    const originalSigned = await admin.storage.from('poi-images').createSignedUploadUrl(originalPath)
    if (originalSigned.error) return Response.json({ error: originalSigned.error.message }, { status: 500 })

    const thumbSigned = await admin.storage.from('poi-images').createSignedUploadUrl(thumbPath)
    if (thumbSigned.error) return Response.json({ error: thumbSigned.error.message }, { status: 500 })

    uploads.push({
      poi_id: poiId,
      caption,
      status: adminMode ? 'approved' : 'pending',
      is_cover: Boolean(file.is_cover),
      original: {
        path: originalPath,
        token: originalSigned.data?.token,
        signedUrl: originalSigned.data?.signedUrl,
      },
      thumb: {
        path: thumbPath,
        token: thumbSigned.data?.token,
        signedUrl: thumbSigned.data?.signedUrl,
      },
    })
  }

  return Response.json({
    ok: true,
    upload_id: `${auth.user.id}-${Date.now()}`,
    uploads,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
