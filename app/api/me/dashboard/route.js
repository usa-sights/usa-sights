import { requireUserRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'

async function safeCount(queryPromise) { try { const res = await queryPromise; return res.count || 0 } catch { return 0 } }
async function safeData(queryPromise, fallback = []) { try { const res = await queryPromise; return res.data || fallback } catch { return fallback } }
function fmt(value) { return value ? new Intl.DateTimeFormat('de-DE', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '' }


async function signImageVariants(admin, rows = []) {
  const paths = Array.from(new Set(rows.flatMap((row) => [row?.path, deriveThumbPath(row?.path)]).filter(Boolean)))
  if (!paths.length) return rows
  const signed = await admin.storage.from('poi-images').createSignedUrls(paths, 3600)
  const urlMap = Object.fromEntries((signed.data || []).map((item, index) => [paths[index], item?.signedUrl || null]))
  return rows.map((row) => ({
    ...row,
    url: row?.path ? (urlMap[row.path] || null) : null,
    thumb_url: row?.path ? (urlMap[deriveThumbPath(row.path)] || urlMap[row.path] || null) : null,
  }))
}


export async function GET(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const admin = auth.admin
  const userId = auth.user.id
  const [favoritesCount, ownReviewsCount, ownRepliesCount, ownImagesCount, ownLinksCount, ownChangesCount, publishedOwnPois, pendingOwnImages, pendingOwnLinks, pendingOwnPois, ownPoisCount, favorites, reviews, repliesRaw, imagesRaw, linksRaw, changesRaw, poisRaw] = await Promise.all([
    safeCount(admin.from('favorites').select('*', { count:'exact', head:true }).eq('user_id', userId)),
    safeCount(admin.from('poi_reviews').select('*', { count:'exact', head:true }).eq('user_id', userId)),
    safeCount(admin.from('poi_review_replies').select('*', { count:'exact', head:true }).eq('user_id', userId)),
    safeCount(admin.from('poi_images').select('*', { count:'exact', head:true }).eq('uploaded_by', userId)),
    safeCount(admin.from('poi_external_links').select('*', { count:'exact', head:true }).eq('submitted_by', userId)),
    safeCount(admin.from('poi_change_requests').select('*', { count:'exact', head:true }).eq('submitted_by', userId)),
    safeCount(admin.from('pois').select('*', { count:'exact', head:true }).eq('created_by', userId).eq('status', 'published')),
    safeCount(admin.from('poi_images').select('*', { count:'exact', head:true }).eq('uploaded_by', userId).eq('status', 'pending')),
    safeCount(admin.from('poi_external_links').select('*', { count:'exact', head:true }).eq('submitted_by', userId).eq('status', 'pending')),
    safeCount(admin.from('pois').select('*', { count:'exact', head:true }).eq('created_by', userId).eq('status', 'pending')),
    safeCount(admin.from('pois').select('*', { count:'exact', head:true }).eq('created_by', userId)),
    safeData(admin.from('favorites').select('id,created_at,poi_id, pois(title,slug)').eq('user_id', userId).order('created_at', { ascending:false }).limit(10)),
    safeData(admin.from('poi_reviews').select('id,created_at,rating,review_text,poi_id, pois(title,slug)').eq('user_id', userId).order('created_at', { ascending:false }).limit(25)),
    safeData(admin.from('poi_review_replies').select('id,created_at,reply_text,review_id, poi_reviews(id,poi_id,review_text,pois(title,slug))').eq('user_id', userId).order('created_at', { ascending:false }).limit(25)),
    safeData(admin.from('poi_images').select('id,created_at,status,poi_id,caption,path,is_cover, pois(title,slug)').eq('uploaded_by', userId).order('created_at', { ascending:false }).limit(25)),
    safeData(admin.from('poi_external_links').select('id,created_at,status,poi_id,label,url, pois(title,slug)').eq('submitted_by', userId).order('created_at', { ascending:false }).limit(25)),
    safeData(admin.from('poi_change_requests').select('id,created_at,status,poi_id,field_name,new_value, pois(title,slug)').eq('submitted_by', userId).order('created_at', { ascending:false }).limit(25)),
    safeData(admin.from('pois').select('id,title,slug,status,created_at,updated_at').eq('created_by', userId).order('updated_at', { ascending:false }).limit(25)),
  ])
  const replies = repliesRaw.map((x) => ({ ...x, poi_title: x.poi_reviews?.pois?.title || 'POI', poi_slug: x.poi_reviews?.pois?.slug || null, poi_id: x.poi_reviews?.poi_id || null, review_id: x.review_id }))
  const signedImagesRaw = await signImageVariants(admin, imagesRaw || [])
  const images = signedImagesRaw.map((x) => ({ ...x, poi_title: x.pois?.title || 'POI', poi_slug: x.pois?.slug || null }))
  const links = linksRaw.map((x) => ({ ...x, poi_title: x.pois?.title || 'POI', poi_slug: x.pois?.slug || null, href: x.pois?.slug ? `/poi/${x.pois.slug}#poi-link-${x.id}` : '/account?section=links' }))
  const changes = changesRaw.map((x) => ({ ...x, poi_title: x.pois?.title || 'POI', poi_slug: x.pois?.slug || null }))
  const submissions = poisRaw
  const recentActivity = [...favorites.map((x) => ({ type:'Favorit', created_at:x.created_at, label:x.pois?.title || 'POI', href:x.pois?.slug ? `/poi/${x.pois.slug}` : '/account?section=favorites' })), ...reviews.map((x) => ({ type:'Bewertung', created_at:x.created_at, label:`${x.pois?.title || 'POI'} · ${x.rating}/5`, href:x.pois?.slug ? `/poi/${x.pois.slug}#review-${x.id}` : '/account?section=reviews' })), ...replies.map((x) => ({ type:'Antwort', created_at:x.created_at, label:`${x.poi_title} · ${x.reply_text || 'Antwort'}`, href:x.poi_slug ? `/poi/${x.poi_slug}#reply-${x.id}` : '/account?section=replies' })), ...images.map((x) => ({ type:'Bild', created_at:x.created_at, label:`${x.poi_title} · ${x.status}`, href:x.poi_slug ? `/poi/${x.poi_slug}#poi-gallery` : '/account?section=images' })), ...links.map((x) => ({ type:'Link', created_at:x.created_at, label:`${x.poi_title} · ${x.label || 'Link'}`, href:x.href, url:x.url || '' })), ...changes.map((x) => ({ type:'Änderung', created_at:x.created_at, label:`${x.poi_title} · ${x.status}`, href:x.poi_slug ? `/poi/${x.poi_slug}#poi-visitor-info` : '/account?section=changes' })), ...submissions.map((x) => ({ type:'Einreichung', created_at:x.updated_at || x.created_at, label:`${x.title} · ${x.status}`, href:`/account/my-pois/${x.id}` }))].sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0,12).map((item) => ({ ...item, created_at_label: fmt(item.created_at) }))
  const pendingOwnTotal = pendingOwnPois + pendingOwnImages + pendingOwnLinks
  return Response.json({ kpis:{ favoritesCount, ownReviewsCount, ownRepliesCount, ownImagesCount, ownLinksCount, ownChangesCount, publishedOwnPois, pendingOwnImages, pendingOwnLinks, pendingOwnPois, pendingOwnTotal, ownPoisCount }, lists:{ favorites, reviews, replies, images, links, changes, submissions }, recentActivity }, { headers:{ 'Cache-Control':'no-store' } })
}
