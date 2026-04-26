import { sendPoiImageUploadNotification } from '@/lib/adminNotifications'
import { requireUserRoute } from '@/utils/supabase/auth'
import { buildStoragePaths } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

async function isAdminUser(admin, userId) {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const form = await req.formData()
  const poiId = String(form.get('poi_id') || '').trim()
  const caption = String(form.get('caption') || '').trim() || null
  const prefix = String(form.get('variant_prefix') || 'upload').trim() || 'upload'

  if (!poiId) return Response.json({ error: 'POI-ID fehlt.' }, { status: 400 })

  const originals = []
  const thumbs = new Map()
  for (const [key, value] of form.entries()) {
    if (!value || typeof value === 'string') continue
    if (key.startsWith('original_')) originals.push([key, value])
    if (key.startsWith('thumb_')) thumbs.set(key.replace('thumb_', ''), value)
  }
  if (!originals.length) return Response.json({ error: 'Keine Bilddateien übergeben.' }, { status: 400 })

  const admin = auth.admin
  const adminMode = await isAdminUser(admin, auth.user.id)
  const items = []

  for (let i = 0; i < originals.length; i += 1) {
    const [key, originalFile] = originals[i]
    const index = key.replace('original_', '')
    const thumbFile = thumbs.get(index)
    if (!thumbFile) return Response.json({ error: 'Miniaturbild fehlt.' }, { status: 400 })

    const fileName = String(form.get(`filename_${index}`) || originalFile.name || `image-${index}.webp`)
    const { originalPath, thumbPath } = buildStoragePaths({ userId: auth.user.id, poiId, index: i, fileName, variantPrefix: prefix })

    const originalBuffer = Buffer.from(await originalFile.arrayBuffer())
    const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer())

    const originalUpload = await admin.storage.from('poi-images').upload(originalPath, originalBuffer, {
      contentType: originalFile.type || 'image/webp',
      upsert: false,
    })
    if (originalUpload.error) return Response.json({ error: originalUpload.error.message }, { status: 500 })

    const thumbUpload = await admin.storage.from('poi-images').upload(thumbPath, thumbBuffer, {
      contentType: thumbFile.type || 'image/webp',
      upsert: true,
    })
    if (thumbUpload.error) return Response.json({ error: thumbUpload.error.message }, { status: 500 })

    const { data, error } = await admin.from('poi_images').insert({
      poi_id: poiId,
      uploaded_by: auth.user.id,
      path: originalPath,
      caption,
      status: adminMode ? 'approved' : 'pending',
      is_cover: i === 0 && String(form.get('is_cover_first') || 'false') === 'true',
    }).select().single()

    if (error) {
      await admin.storage.from('poi-images').remove([originalPath, thumbPath])
      return Response.json({ error: error.message }, { status: 500 })
    }

    items.push(data)
  }

  sendPoiImageUploadNotification({ poiId, userId: auth.user.id, itemIds: items.map((item) => item.id) }).catch(() => {})

  return Response.json({
    items,
    message: adminMode ? 'Bilder hochgeladen und freigegeben.' : 'Bilder hochgeladen und als pending gespeichert.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
