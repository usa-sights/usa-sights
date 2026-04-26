import { requireAdminRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'
import { isMissingSchemaObjectError, safeDelete } from '@/lib/supabaseDb'

export const dynamic = 'force-dynamic'

async function loadReviewIds(admin, poiId) {
  const { data, error } = await admin
    .from('poi_reviews')
    .select('id')
    .eq('poi_id', poiId)

  if (error) {
    if (isMissingSchemaObjectError(error)) return []
    throw new Error(error.message)
  }

  return (data || []).map((entry) => entry.id).filter(Boolean)
}

async function removeStorageImages(admin, poiId) {
  const { data: images, error } = await admin
    .from('poi_images')
    .select('path')
    .eq('poi_id', poiId)

  if (error) throw new Error(error.message)

  const uniquePaths = new Set()
  for (const image of images || []) {
    if (!image?.path) continue
    uniquePaths.add(image.path)

    const thumbPath = deriveThumbPath(image.path)
    if (thumbPath && thumbPath !== image.path) {
      uniquePaths.add(thumbPath)
    }
  }

  const paths = Array.from(uniquePaths).filter(Boolean)
  if (!paths.length) return

  const { error: storageError } = await admin.storage.from('poi-images').remove(paths)
  if (storageError) throw new Error(storageError.message)
}

async function deleteDependentRecords(admin, poiId, reviewIds) {
  if (reviewIds.length) {
    await safeDelete(() => admin.from('poi_review_replies').delete().in('review_id', reviewIds))
  }

  const deleteOperations = [
    () => admin.from('favorites').delete().eq('poi_id', poiId),
    () => admin.from('poi_affiliate_settings').delete().eq('poi_id', poiId),
    () => admin.from('poi_change_requests').delete().eq('poi_id', poiId),
    () => admin.from('poi_editorial').delete().eq('poi_id', poiId),
    () => admin.from('poi_external_links').delete().eq('poi_id', poiId),
    () => admin.from('poi_images').delete().eq('poi_id', poiId),
    () => admin.from('poi_reviews').delete().eq('poi_id', poiId),
    () => admin.from('submissions').delete().eq('poi_id', poiId),
  ]

  for (const remove of deleteOperations) {
    await safeDelete(remove)
  }
}

export async function PATCH(req, { params }) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const nextStatus = body.status
  if (!['pending', 'published', 'rejected'].includes(nextStatus)) {
    return Response.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  const payload = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }

  if (nextStatus === 'published') {
    payload.approved_by = auth.user.id
  }

  const { data, error } = await auth.admin
    .from('pois')
    .update(payload)
    .eq('id', params.id)
    .select('id,title,status')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req, { params }) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const poiId = params.id
  const admin = auth.admin

  try {
    const reviewIds = await loadReviewIds(admin, poiId)
    await removeStorageImages(admin, poiId)
    await deleteDependentRecords(admin, poiId, reviewIds)

    const poiDeleteResult = await admin.from('pois').delete().eq('id', poiId)
    if (poiDeleteResult.error) throw new Error(poiDeleteResult.error.message)

    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json(
      { error: error.message || 'Löschen fehlgeschlagen' },
      { status: 500 }
    )
  }
}
