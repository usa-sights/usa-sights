import { sendPoiImageUploadNotification } from '@/lib/adminNotifications'
import { requireUserRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

async function isAdminUser(admin, userId) {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

function validPathForUser(path, userId) {
  return typeof path === 'string' && path.startsWith(`${userId}/`) && path.endsWith('.webp') && !path.includes('..')
}

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const uploads = Array.isArray(body.uploads) ? body.uploads.slice(0, 20) : []
  if (!uploads.length) return Response.json({ error: 'Keine Uploads übergeben.' }, { status: 400 })

  const admin = auth.admin
  const adminMode = await isAdminUser(admin, auth.user.id)
  const items = []
  const cleanupPaths = []

  for (let i = 0; i < uploads.length; i += 1) {
    const entry = uploads[i] || {}
    const poiId = String(entry.poi_id || '').trim()
    const originalPath = entry.original?.path
    const thumbPath = entry.thumb?.path
    const caption = String(entry.caption || '').trim() || null

    if (!poiId) return Response.json({ error: 'POI-ID fehlt.' }, { status: 400 })
    if (!validPathForUser(originalPath, auth.user.id) || !validPathForUser(thumbPath, auth.user.id)) {
      return Response.json({ error: 'Ungültiger Bildpfad.' }, { status: 400 })
    }

    const exists = await admin.storage.from('poi-images').list(originalPath.split('/').slice(0, -1).join('/'), {
      search: originalPath.split('/').pop(),
      limit: 1,
    })
    if (exists.error) return Response.json({ error: exists.error.message }, { status: 500 })
    if (!(exists.data || []).some((item) => item.name === originalPath.split('/').pop())) {
      return Response.json({ error: 'Originalbild wurde nicht vollständig hochgeladen.' }, { status: 400 })
    }

    cleanupPaths.push(originalPath, thumbPath)
    const { data, error } = await admin.from('poi_images').insert({
      poi_id: poiId,
      uploaded_by: auth.user.id,
      path: originalPath,
      caption,
      status: adminMode ? 'approved' : (entry.status || 'pending'),
      is_cover: Boolean(entry.is_cover),
    }).select().single()

    if (error) {
      await admin.storage.from('poi-images').remove(cleanupPaths).catch?.(() => {})
      return Response.json({ error: error.message }, { status: 500 })
    }

    items.push(data)
  }

  if (items.length) {
    const firstPoiId = items[0].poi_id
    sendPoiImageUploadNotification({ poiId: firstPoiId, userId: auth.user.id, itemIds: items.map((item) => item.id) }).catch(() => {})
  }

  return Response.json({
    items,
    message: adminMode ? 'Bilder hochgeladen und freigegeben.' : 'Bilder hochgeladen und als pending gespeichert.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
