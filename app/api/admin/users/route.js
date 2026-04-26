import { requireAdminRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

function isMissingTableError(message = '') {
  return /Could not find the table/i.test(message) || /schema cache/i.test(message)
}

async function safeDelete(queryPromiseFactory) {
  const result = await queryPromiseFactory()
  if (result?.error) {
    if (isMissingTableError(result.error.message)) return
    throw new Error(result.error.message)
  }
}

async function removePaths(admin, paths) {
  const uniquePaths = Array.from(new Set((paths || []).filter(Boolean)))
  if (!uniquePaths.length) return
  const result = await admin.storage.from('poi-images').remove(uniquePaths)
  if (result.error) throw new Error(result.error.message)
}

async function collectUserImagePaths(admin, userId) {
  const userPaths = []

  const uploadedImages = await admin.from('poi_images').select('path').eq('uploaded_by', userId)
  if (uploadedImages.error && !isMissingTableError(uploadedImages.error.message)) throw new Error(uploadedImages.error.message)
  for (const row of uploadedImages.data || []) {
    if (!row?.path) continue
    userPaths.push(row.path, deriveThumbPath(row.path))
  }

  const userPois = await admin.from('pois').select('id').eq('created_by', userId)
  if (userPois.error && !isMissingTableError(userPois.error.message)) throw new Error(userPois.error.message)
  const poiIds = (userPois.data || []).map((row) => row.id).filter(Boolean)

  if (poiIds.length) {
    const poiImages = await admin.from('poi_images').select('path').in('poi_id', poiIds)
    if (poiImages.error && !isMissingTableError(poiImages.error.message)) throw new Error(poiImages.error.message)
    for (const row of poiImages.data || []) {
      if (!row?.path) continue
      userPaths.push(row.path, deriveThumbPath(row.path))
    }
  }

  return { poiIds, paths: userPaths }
}

async function deleteUserData(admin, userId, currentAdminId) {
  if (userId === currentAdminId) throw new Error('Der aktuell eingeloggte Admin kann nicht per Bulk-Löschen entfernt werden.')

  const { poiIds, paths } = await collectUserImagePaths(admin, userId)
  await removePaths(admin, paths)

  if (poiIds.length) {
    const reviews = await admin.from('poi_reviews').select('id').in('poi_id', poiIds)
    if (reviews.error && !isMissingTableError(reviews.error.message)) throw new Error(reviews.error.message)
    const reviewIds = (reviews.data || []).map((row) => row.id).filter(Boolean)
    if (reviewIds.length) {
      await safeDelete(() => admin.from('poi_review_replies').delete().in('review_id', reviewIds))
    }

    await safeDelete(() => admin.from('favorites').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('poi_affiliate_settings').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('poi_change_requests').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('poi_editorial').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('poi_external_links').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('poi_images').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('poi_reviews').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('submissions').delete().in('poi_id', poiIds))
    await safeDelete(() => admin.from('pois').delete().in('id', poiIds))
  }

  await safeDelete(() => admin.from('poi_images').delete().eq('uploaded_by', userId))
  await safeDelete(() => admin.from('poi_external_links').delete().eq('submitted_by', userId))
  await safeDelete(() => admin.from('poi_review_replies').delete().eq('user_id', userId))
  await safeDelete(() => admin.from('poi_reviews').delete().eq('user_id', userId))
  await safeDelete(() => admin.from('favorites').delete().eq('user_id', userId))
  await safeDelete(() => admin.from('poi_change_requests').delete().eq('submitted_by', userId))
  await safeDelete(() => admin.from('profiles').delete().eq('id', userId))

  const authDelete = await admin.auth.admin.deleteUser(userId)
  if (authDelete.error) throw new Error(authDelete.error.message)
}

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.admin.from('profiles').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const userId = String(body?.id || '').trim()
    const role = String(body?.role || '').trim()
    if (!userId) return Response.json({ error: 'Kein Nutzer ausgewählt.' }, { status: 400 })
    if (!['user', 'admin'].includes(role)) return Response.json({ error: 'Ungültige Rolle.' }, { status: 400 })
    if (userId === auth.user.id && role !== 'admin') return Response.json({ error: 'Der aktuell eingeloggte Admin kann sich nicht selbst die Admin-Rolle entziehen.' }, { status: 400 })

    const { data, error } = await auth.admin
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id,name,email,role,created_at')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ item: data, message: 'Rolle aktualisiert.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Rolle konnte nicht aktualisiert werden.' }, { status: 500 })
  }
}
