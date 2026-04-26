import { requireAdminRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'


async function removeImageFiles(admin, items = []) {
  const paths = Array.from(new Set((items || []).flatMap((item) => [item?.path, item?.thumb_path || deriveThumbPath(item?.path)].filter(Boolean))))
  if (!paths.length) return
  const result = await admin.storage.from('poi-images').remove(paths)
  if (result.error) throw new Error(result.error.message)
}

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  const status = searchParams.get('status')

  let query = auth.admin
    .from('poi_images')
    .select('*, pois(title,slug,latitude,longitude)')
    .order('created_at', { ascending: false })

  if (poiId) query = query.eq('poi_id', poiId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()

  if (Array.isArray(body.ids) && body.ids.length) {
    const payload = {}
    if (body.status !== undefined) payload.status = body.status
    if (body.is_gallery_pick !== undefined) payload.is_gallery_pick = body.is_gallery_pick
    if (body.status === 'rejected') payload.is_cover = false
    const { data, error } = await auth.admin
      .from('poi_images')
      .update(payload)
      .in('id', body.ids)
      .select('id')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ items: data || [], message: `${(data || []).length} Bild${(data || []).length === 1 ? '' : 'er'} aktualisiert` })
  }

  const { data: current, error: currentError } = await auth.admin
    .from('poi_images')
    .select('*')
    .eq('id', body.id)
    .single()

  if (currentError) return Response.json({ error: currentError.message }, { status: 500 })

  if (body.is_cover === true) {
    const clearResult = await auth.admin
      .from('poi_images')
      .update({ is_cover: false })
      .eq('poi_id', current.poi_id)
      .eq('is_cover', true)

    if (clearResult.error) return Response.json({ error: clearResult.error.message }, { status: 500 })

    const { data, error } = await auth.admin
      .from('poi_images')
      .update({
        is_cover: true,
        status: 'approved',
        is_gallery_pick: body.is_gallery_pick ?? current.is_gallery_pick,
        sort_order: body.sort_order ?? current.sort_order,
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ item: data })
  }

  const payload = {}
  if (body.status !== undefined) payload.status = body.status
  if (body.is_cover !== undefined) payload.is_cover = body.is_cover
  if (body.is_gallery_pick !== undefined) payload.is_gallery_pick = body.is_gallery_pick
  if (body.sort_order !== undefined) payload.sort_order = body.sort_order

  if (body.status === 'rejected') {
    payload.is_cover = false
  }

  const { data, error } = await auth.admin
    .from('poi_images')
    .update(payload)
    .eq('id', body.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}


export async function DELETE(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id || '').trim()).filter(Boolean) : []
    if (!ids.length) return Response.json({ error: 'Keine Bilder ausgewählt.' }, { status: 400 })

    const { data: items, error: loadError } = await auth.admin
      .from('poi_images')
      .select('id,path')
      .in('id', ids)

    if (loadError) return Response.json({ error: loadError.message }, { status: 500 })

    await removeImageFiles(auth.admin, items || [])

    const { error: deleteError } = await auth.admin
      .from('poi_images')
      .delete()
      .in('id', ids)

    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 })

    return Response.json({ ok: true, deleted: ids.length, message: `${ids.length} Bild${ids.length === 1 ? '' : 'er'} gelöscht` }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Bilder konnten nicht gelöscht werden.' }, { status: 500 })
  }
}
