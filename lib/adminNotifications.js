import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deriveThumbPath } from '@/lib/imageUpload'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://localhost:3000'
}

function formatField(label, value) {
  const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : value
  if (text === null || text === undefined || String(text).trim() === '') return ''
  return `<tr><td style="padding:6px 10px;font-weight:600;vertical-align:top;border-bottom:1px solid #e5e7eb;">${escapeHtml(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(text)}</td></tr>`
}

async function sendEmail({ subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_NOTIFICATION_EMAIL
  const from = process.env.RESEND_FROM_EMAIL || process.env.ADMIN_FROM_EMAIL || 'USA Sights <noreply@usa-sights.com>'
  if (!apiKey || !to) return { skipped: true }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => '')
    throw new Error(`E-Mail-Versand fehlgeschlagen (${response.status}): ${payload}`)
  }

  return response.json().catch(() => ({ ok: true }))
}

async function getUserName(admin, userId) {
  if (!userId) return 'Nutzer'
  const { data } = await admin.from('profiles').select('name').eq('id', userId).maybeSingle()
  return data?.name || 'Nutzer'
}

async function signImagePaths(admin, paths = [], expiresIn = 86400) {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (!unique.length) return {}
  const { data } = await admin.storage.from('poi-images').createSignedUrls(unique, expiresIn)
  return Object.fromEntries((data || []).map((item, index) => [unique[index], item?.signedUrl || null]))
}

function imageGalleryHtml(images = []) {
  if (!images.length) return ''
  return `
    <div style="margin-top:18px;">
      <h3 style="margin:0 0 10px;">Bilder</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${images.map((image) => `
          <div style="width:160px;">
            ${image.thumb_url ? `<img src="${escapeHtml(image.thumb_url)}" alt="${escapeHtml(image.caption || 'POI Bild')}" style="width:160px;height:110px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb;display:block;" />` : ''}
            <div style="font-size:12px;color:#475569;margin-top:6px;">${escapeHtml(image.caption || 'Ohne Bildtext')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

export async function sendPoiSubmissionNotification({ poiId }) {
  const admin = createSupabaseAdminClient()
  const { data: poi } = await admin.from('pois').select('*').eq('id', poiId).maybeSingle()
  if (!poi) return { skipped: true }

  const [userName, linksRes, imagesRes] = await Promise.all([
    getUserName(admin, poi.created_by),
    admin.from('poi_external_links').select('id,label,url,status').eq('poi_id', poiId).order('created_at'),
    admin.from('poi_images').select('id,path,caption,status,created_at').eq('poi_id', poiId).order('created_at'),
  ])

  const images = imagesRes.data || []
  const signedMap = await signImagePaths(admin, images.flatMap((image) => [deriveThumbPath(image.path), image.path]))
  const imageItems = images.map((image) => ({
    ...image,
    thumb_url: signedMap[deriveThumbPath(image.path)] || signedMap[image.path] || null,
  }))

  const adminUrl = `${getSiteUrl()}/admin/poi/${poi.id}`
  const rows = [
    formatField('Titel', poi.title),
    formatField('Status', poi.status),
    formatField('Kategorie', poi.category_id),
    formatField('Bundesstaat', poi.state),
    formatField('Stadt', poi.city),
    formatField('Adresse', poi.address),
    formatField('Latitude', poi.latitude),
    formatField('Longitude', poi.longitude),
    formatField('Kurzbeschreibung', poi.short_description),
    formatField('Beschreibung', poi.description),
    formatField('Website', poi.website_url),
    formatField('Öffnungszeiten', poi.opening_hours_text),
    formatField('Preise', poi.price_info_text),
    formatField('Hotels in der Nähe', poi.hotels_nearby_text),
    formatField('Weiterführende Links', (linksRes.data || []).map((link) => `${link.label || 'Link'}: ${link.url}`)),
  ].filter(Boolean).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Neue POI-Einreichung</h2>
      <p style="margin:0 0 14px;">Von <strong>${escapeHtml(userName)}</strong> wurde ein neuer POI eingereicht.</p>
      <p style="margin:0 0 14px;"><a href="${adminUrl}" style="color:#2563eb;text-decoration:none;font-weight:600;">Direkt zur Admin-Bearbeitung</a></p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">${rows}</table>
      ${imageGalleryHtml(imageItems)}
    </div>
  `

  const text = [
    `Neue POI-Einreichung von ${userName}`,
    `Titel: ${poi.title || '-'}`,
    `Bundesstaat: ${poi.state || '-'}`,
    `Stadt: ${poi.city || '-'}`,
    `Adresse: ${poi.address || '-'}`,
    `Website: ${poi.website_url || '-'}`,
    `Admin: ${adminUrl}`,
  ].join('\n')

  return sendEmail({
    subject: `POI-Neu(${userName}): ${poi.title || 'Ohne Titel'}, ${poi.state || 'ohne Bundesstaat'}`,
    html,
    text,
  })
}

export async function sendPoiNoteNotification({ poiId, userId, noteTitle, noteBody, kind = 'Notiz' }) {
  const admin = createSupabaseAdminClient()
  const [{ data: poi }, userName] = await Promise.all([
    admin.from('pois').select('id,title,state').eq('id', poiId).maybeSingle(),
    getUserName(admin, userId),
  ])
  if (!poi) return { skipped: true }

  const adminUrl = `${getSiteUrl()}/admin/poi/${poi.id}`
  const safeText = String(noteBody || '').trim()
  const subjectText = safeText || noteTitle || kind
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Neue Interaktion am POI</h2>
      <p style="margin:0 0 10px;"><strong>${escapeHtml(userName)}</strong> hat einen neuen Eintrag gesendet.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">${[
        formatField('POI', poi.title),
        formatField('Art', kind),
        formatField('Titel', noteTitle),
        formatField('Inhalt', safeText),
      ].join('')}</table>
      <p style="margin:14px 0 0;"><a href="${adminUrl}" style="color:#2563eb;text-decoration:none;font-weight:600;">Direkt zur Admin-Bearbeitung</a></p>
    </div>
  `
  const text = [`${kind} von ${userName}`, `POI: ${poi.title || '-'}`, `Inhalt: ${safeText || noteTitle || '-'}`, `Admin: ${adminUrl}`].join('\n')
  return sendEmail({ subject: `POI-Notiz(${userName}): ${subjectText}`.slice(0, 200), html, text })
}

export async function sendPoiImageUploadNotification({ poiId, userId, itemIds = [] }) {
  const admin = createSupabaseAdminClient()
  const [{ data: poi }, userName, imagesRes] = await Promise.all([
    admin.from('pois').select('id,title,state').eq('id', poiId).maybeSingle(),
    getUserName(admin, userId),
    itemIds.length ? admin.from('poi_images').select('id,path,caption,status').in('id', itemIds) : Promise.resolve({ data: [] }),
  ])
  if (!poi) return { skipped: true }

  const images = imagesRes.data || []
  const signedMap = await signImagePaths(admin, images.flatMap((image) => [deriveThumbPath(image.path), image.path]))
  const imageItems = images.map((image) => ({ ...image, thumb_url: signedMap[deriveThumbPath(image.path)] || signedMap[image.path] || null }))
  const adminUrl = `${getSiteUrl()}/admin/poi/${poi.id}`
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Neue Fotos zu einem POI</h2>
      <p style="margin:0 0 14px;"><strong>${escapeHtml(userName)}</strong> hat ${imageItems.length.toLocaleString('de-DE')} Bild${imageItems.length === 1 ? '' : 'er'} hochgeladen.</p>
      <p style="margin:0 0 14px;"><a href="${adminUrl}" style="color:#2563eb;text-decoration:none;font-weight:600;">Direkt zur Admin-Bearbeitung</a></p>
      ${imageGalleryHtml(imageItems)}
    </div>
  `
  const text = [`Foto-Upload von ${userName}`, `POI: ${poi.title || '-'}`, `Bilder: ${imageItems.length}`, `Admin: ${adminUrl}`].join('\n')
  return sendEmail({ subject: `POI-Notiz(${userName}): Foto-Upload`, html, text })
}
