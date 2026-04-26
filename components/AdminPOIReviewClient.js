"use client"

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AdminPOIAffiliateManager from '@/components/AdminPOIAffiliateManager'
import ExternalLinksEditor from '@/components/ExternalLinksEditor'
import UserPOIImageUploader from '@/components/UserPOIImageUploader'
import AdminPOIMapEditor from '@/components/AdminPOIMapEditor'
import { authFetchJson } from '@/utils/authFetch'

function joinLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function splitLines(value) {
  return String(value || '').split('\n').map((x) => x.trim()).filter(Boolean)
}

export default function AdminPOIReviewClient({ forcedPoiId = null }) {
  const searchParams = useSearchParams()
  const queryPoiId = forcedPoiId || searchParams.get('poi')
  const [selected, setSelected] = useState(null)
  const [editorial, setEditorial] = useState({ highlights_text:'', nice_to_know_text:'', visit_duration_text:'', best_time_to_visit_text:'', family_friendly_value:'', family_friendly_reason:'', suggested_tags_text:'', seo_title:'', seo_description:'', editorial_review_notes_text:'' })
  const [categories, setCategories] = useState([])
  const [message, setMessage] = useState('')
  const [media, setMedia] = useState([])
  const [mediaUrls, setMediaUrls] = useState({})
  const [activeMediaId, setActiveMediaId] = useState(null)
  const [mediaStatusFilter, setMediaStatusFilter] = useState('all')
  const [visibleMediaCount, setVisibleMediaCount] = useState(60)
  const [saving, setSaving] = useState(false)
  const [affiliateItems, setAffiliateItems] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const mapKey = useMemo(() => `${selected?.id || 'poi'}:${selected?.latitude || ''}:${selected?.longitude || ''}`,[selected?.id, selected?.latitude, selected?.longitude])

  async function loadBase() {
    const [categoriesData, profileData] = await Promise.all([
      fetch(`/api/categories?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ items: [] })),
      authFetchJson(`/api/me/profile?t=${Date.now()}`),
    ])
    setCategories(categoriesData.items || [])
    setCurrentUserId(profileData.item?.id || null)
  }

  function applyDetail(detailData, mediaData) {
    const item = detailData.item || {}
    setSelected({
      id:item.id, slug:item.slug || '', title:item.title || '', short_description:item.short_description || '', description:item.description || '', category_id:item.category_id || '', state:item.state || '', city:item.city || '', address:item.address || '', latitude:item.latitude ?? '', longitude:item.longitude ?? '', opening_hours_text:item.opening_hours_text || '', price_info_text:item.price_info_text || '', hotels_nearby_text:item.hotels_nearby_text || '', website_url:item.website_url || '', status:item.status || 'pending',
    })
    const ed = detailData.editorial || {}
    setEditorial({
      highlights_text: joinLines(ed.highlights_json || []),
      nice_to_know_text: joinLines(ed.nice_to_know_json || []),
      visit_duration_text: ed.visit_duration_text || '',
      best_time_to_visit_text: ed.best_time_to_visit_text || '',
      family_friendly_value: typeof ed.family_friendly_json?.value === 'boolean' ? String(ed.family_friendly_json.value) : '',
      family_friendly_reason: ed.family_friendly_json?.reason || '',
      suggested_tags_text: joinLines(ed.suggested_tags_json || []),
      seo_title: ed.seo_title || '',
      seo_description: ed.seo_description || '',
      editorial_review_notes_text: joinLines(ed.editorial_review_notes_json || []),
    })
    setAffiliateItems(detailData.affiliate_settings || [])
    const nextMedia = (detailData.images && detailData.images.length ? detailData.images : mediaData.items) || []
    setMedia(nextMedia)
    setActiveMediaId(nextMedia[0]?.id || null)
    setVisibleMediaCount(60)
  }

  async function loadDetail(poiId) {
    if (!poiId) return
    const [detailData, mediaData] = await Promise.all([
      authFetchJson(`/api/admin/poi/${poiId}?t=${Date.now()}`),
      authFetchJson(`/api/admin/media?poi_id=${poiId}&t=${Date.now()}`),
    ])
    if (detailData.error) return setMessage(detailData.error)
    applyDetail(detailData, mediaData)
  }


  const filteredMedia = useMemo(() => mediaStatusFilter === 'all' ? media : media.filter((item) => item.status === mediaStatusFilter), [media, mediaStatusFilter])
  const visibleMedia = useMemo(() => filteredMedia.slice(0, visibleMediaCount), [filteredMedia, visibleMediaCount])
  const activeMedia = useMemo(() => filteredMedia.find((item) => item.id === activeMediaId) || visibleMedia[0] || null, [filteredMedia, activeMediaId, visibleMedia])

  useEffect(() => {
    const targets = visibleMedia.filter((item) => item?.path && !mediaUrls[item.path]).map((item) => item.path)
    if (!targets.length) return
    let ignore = false
    ;(async () => {
      const signed = await fetch('/api/images/signed-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: targets }),
      }).then((r) => r.json()).catch(() => ({ urls: {} }))
      if (ignore) return
      setMediaUrls((prev) => ({ ...prev, ...(signed.urls || {}) }))
    })()
    return () => { ignore = true }
  }, [visibleMedia, mediaUrls])

  useEffect(() => { ;(async () => { await loadBase(); if (queryPoiId) await loadDetail(queryPoiId) })() }, [queryPoiId])

  async function reverseGeocodeFill() {
    if (!selected?.latitude || !selected?.longitude) return
    const data = await fetch('/api/reverse-geocode', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ lat:selected.latitude, lng:selected.longitude })
    }).then((r) => r.json()).catch(() => ({ error:'Adresse konnte nicht ergänzt werden' }))
    if (data.error) return setMessage(data.error)
    setSelected((prev) => ({
      ...prev,
      state: data.state || '',
      city: data.city || '',
      address: data.address || '',
    }))
    setMessage(data.state || data.city || data.address ? 'Adressdaten wurden aus den Koordinaten übernommen.' : 'Für diese Koordinaten wurden keine Adressdaten gefunden.')
  }

  async function generateAI() {
    if (!selected?.id) return
    setMessage('KI generiert ...')
    const data = await fetch('/api/ai/generate-poi', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(selected) }).then((r) => r.json()).catch(() => ({ error:'KI-Aufruf fehlgeschlagen' }))
    if (!data.ok) return setMessage(data.error || 'KI-Aufruf fehlgeschlagen')
    const out = data.output || {}
    const templates = out.affiliate_url_templates || {}
    setSelected((prev) => ({ ...prev, short_description: out.short_description || prev.short_description, description: out.long_description || prev.description, website_url: out.website_url_suggestion || prev.website_url, opening_hours_text: out.opening_hours_text_suggestion || prev.opening_hours_text, price_info_text: out.price_info_text_suggestion || prev.price_info_text, hotels_nearby_text: out.hotels_nearby_text_suggestion || prev.hotels_nearby_text }))
    setEditorial((prev) => ({ ...prev, highlights_text: joinLines(out.highlights || splitLines(prev.highlights_text)), nice_to_know_text: joinLines(out.nice_to_know || splitLines(prev.nice_to_know_text)), visit_duration_text: out.visit_duration || prev.visit_duration_text, best_time_to_visit_text: out.best_time_to_visit || prev.best_time_to_visit_text, family_friendly_value: typeof out.family_friendly?.value === 'boolean' ? String(out.family_friendly.value) : prev.family_friendly_value, family_friendly_reason: out.family_friendly?.reason || prev.family_friendly_reason, suggested_tags_text: joinLines(out.suggested_tags || splitLines(prev.suggested_tags_text)), seo_title: out.seo_title || prev.seo_title, seo_description: out.seo_description || prev.seo_description, editorial_review_notes_text: joinLines(out.editorial_review_notes || splitLines(prev.editorial_review_notes_text)) }))
    setAffiliateItems((prev) => prev.map((item) => ({ ...item, is_enabled:true, generated_text: out.affiliate_recommendations?.[String(item.provider_key).toLowerCase()] || item.generated_text, manual_url: item.manual_url || templates[String(item.provider_key).toLowerCase()] || '' })))
    setMessage('KI-Vorschlag geladen.')
  }

  function serializeEditorial() {
    return {
      highlights_json: splitLines(editorial.highlights_text),
      nice_to_know_json: splitLines(editorial.nice_to_know_text),
      visit_duration_text: editorial.visit_duration_text || null,
      best_time_to_visit_text: editorial.best_time_to_visit_text || null,
      family_friendly_json: editorial.family_friendly_value === '' ? {} : { value: editorial.family_friendly_value === 'true', reason: editorial.family_friendly_reason || '' },
      suggested_tags_json: splitLines(editorial.suggested_tags_text),
      seo_title: editorial.seo_title || null,
      seo_description: editorial.seo_description || null,
      editorial_review_notes_json: splitLines(editorial.editorial_review_notes_text),
    }
  }

  async function persistAffiliates() {
    for (const item of affiliateItems) {
      const result = await authFetchJson('/api/admin/poi-affiliates', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ poi_id:selected.id, provider_key:item.provider_key, is_enabled:!!item.is_enabled, manual_url:item.manual_url || '', generated_text:item.generated_text || '', cta_text:item.cta_text || 'Verfügbarkeit prüfen', placement:item.placement || 'after_description', user_intent:item.user_intent || 'information' }) })
      if (result.error) return result
    }
    return { ok:true }
  }

  async function save(targetStatus = null) {
    if (!selected?.id) return
    setSaving(true)
    setMessage('')
    const payload = { ...selected }
    if (targetStatus) payload.status = targetStatus
    const poiResult = await authFetchJson(`/api/admin/poi/${selected.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ poi: payload, editorial: serializeEditorial() }) })
    if (poiResult.error) { setSaving(false); return setMessage(`Speichern fehlgeschlagen: ${poiResult.error}`) }
    const affiliateResult = await persistAffiliates()
    if (affiliateResult.error) { setSaving(false); return setMessage(`Affiliate-Speichern fehlgeschlagen: ${affiliateResult.error}`) }
    setSelected((prev) => prev ? { ...prev, ...(poiResult.item || {}), status: poiResult.item?.status || prev.status } : prev)
    setSaving(false)
    setMessage(targetStatus === 'published' ? 'Änderungen gespeichert und freigegeben.' : 'Änderungen gespeichert.')
  }

  async function setMediaStatus(id, status) {
    const data = await authFetchJson('/api/admin/media', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id, status }) })
    setMessage(data.error || 'Bildstatus gespeichert')
    if (!data.error) setMedia((prev) => prev.map((m) => m.id === id ? { ...m, status } : m))
  }

  if (!selected) return <main className="container admin-editor-container"><p>POI wird geladen ...</p></main>

  return <main className="container admin-editor-container"><h1>Admin / POI bearbeiten</h1>{message ? <div className="notice">{message}</div> : null}<div className="card admin-editor-wide"><h2>{selected.title}</h2><p className="muted">Status: {selected.status}</p><div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}><button type="button" className="btn btn-secondary" onClick={generateAI} disabled={saving}>KI Vorschlag</button><button type="button" className="btn btn-secondary" onClick={reverseGeocodeFill} disabled={saving}>Adresse automatisch füllen</button></div><div className="grid grid-2"><div><label className="label">Titel</label><input className="input" value={selected.title || ''} onChange={(e) => setSelected({ ...selected, title:e.target.value })} /></div><div><label className="label">Kategorie</label><select className="select" value={selected.category_id || ''} onChange={(e) => setSelected({ ...selected, category_id:e.target.value })}><option value="">Bitte wählen</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div></div><div className="grid grid-2"><div><label className="label">Status</label><select className="select" value={selected.status || 'pending'} onChange={(e) => setSelected({ ...selected, status:e.target.value })}><option value="pending">pending</option><option value="published">published</option><option value="rejected">rejected</option></select></div><div><label className="label">Slug</label><input className="input" value={selected.slug || ''} onChange={(e) => setSelected({ ...selected, slug:e.target.value })} /></div></div><div className="inline-3"><div><label className="label">Bundesstaat</label><input className="input" value={selected.state || ''} onChange={(e) => setSelected({ ...selected, state:e.target.value })} /></div><div><label className="label">Stadt</label><input className="input" value={selected.city || ''} onChange={(e) => setSelected({ ...selected, city:e.target.value })} /></div><div><label className="label">Adresse</label><input className="input" value={selected.address || ''} onChange={(e) => setSelected({ ...selected, address:e.target.value })} /></div></div><div className="grid grid-2"><div><label className="label">Latitude</label><input className="input" value={selected.latitude || ''} onChange={(e) => setSelected({ ...selected, latitude:e.target.value })} /></div><div><label className="label">Longitude</label><input className="input" value={selected.longitude || ''} onChange={(e) => setSelected({ ...selected, longitude:e.target.value })} /></div></div><AdminPOIMapEditor mapKey={mapKey} latitude={selected.latitude} longitude={selected.longitude} onChange={({ latitude, longitude }) => setSelected((prev) => ({ ...prev, latitude, longitude }))} /><label className="label">Kurzbeschreibung</label><textarea className="textarea" rows="3" value={selected.short_description || ''} onChange={(e) => setSelected({ ...selected, short_description:e.target.value })} /><label className="label">Beschreibung</label><textarea className="textarea" rows="5" value={selected.description || ''} onChange={(e) => setSelected({ ...selected, description:e.target.value })} /><div className="grid grid-2"><div><label className="label">Öffnungszeiten</label><textarea className="textarea" rows="3" value={selected.opening_hours_text || ''} onChange={(e) => setSelected({ ...selected, opening_hours_text:e.target.value })} /></div><div><label className="label">Preise</label><textarea className="textarea" rows="3" value={selected.price_info_text || ''} onChange={(e) => setSelected({ ...selected, price_info_text:e.target.value })} /></div></div><label className="label">Hotels in der Nähe</label><textarea className="textarea" rows="3" value={selected.hotels_nearby_text || ''} onChange={(e) => setSelected({ ...selected, hotels_nearby_text:e.target.value })} /><label className="label">Website</label><input className="input" value={selected.website_url || ''} onChange={(e) => setSelected({ ...selected, website_url:e.target.value })} /><h3>Redaktionelle Inhalte</h3><label className="label">Highlights (eine Zeile pro Eintrag)</label><textarea className="textarea" rows="5" value={editorial.highlights_text} onChange={(e) => setEditorial({ ...editorial, highlights_text:e.target.value })} /><label className="label">Nice to know (eine Zeile pro Eintrag)</label><textarea className="textarea" rows="5" value={editorial.nice_to_know_text} onChange={(e) => setEditorial({ ...editorial, nice_to_know_text:e.target.value })} /><div className="grid grid-2"><div><label className="label">Empfohlene Besuchsdauer</label><input className="input" value={editorial.visit_duration_text} onChange={(e) => setEditorial({ ...editorial, visit_duration_text:e.target.value })} /></div><div><label className="label">Beste Besuchszeit</label><input className="input" value={editorial.best_time_to_visit_text} onChange={(e) => setEditorial({ ...editorial, best_time_to_visit_text:e.target.value })} /></div></div><div className="grid grid-2"><div><label className="label">Familienfreundlich</label><select className="select" value={editorial.family_friendly_value} onChange={(e) => setEditorial({ ...editorial, family_friendly_value:e.target.value })}><option value="">offen</option><option value="true">ja</option><option value="false">nein</option></select></div><div><label className="label">Begründung Familienfreundlich</label><input className="input" value={editorial.family_friendly_reason} onChange={(e) => setEditorial({ ...editorial, family_friendly_reason:e.target.value })} /></div></div><label className="label">Tags (eine Zeile pro Eintrag)</label><textarea className="textarea" rows="4" value={editorial.suggested_tags_text} onChange={(e) => setEditorial({ ...editorial, suggested_tags_text:e.target.value })} /><label className="label">SEO Title</label><input className="input" value={editorial.seo_title} onChange={(e) => setEditorial({ ...editorial, seo_title:e.target.value })} /><label className="label">SEO Description</label><textarea className="textarea" rows="3" value={editorial.seo_description} onChange={(e) => setEditorial({ ...editorial, seo_description:e.target.value })} /><div className="grid grid-2 admin-subgrid" style={{ marginTop:16 }}><div><ExternalLinksEditor poiId={selected.id} isAdmin={true} allowCreate={true} /></div><div><UserPOIImageUploader poiId={selected.id} userId={currentUserId} isAdmin={true} title="Fotos als Admin hinzufügen" /></div></div>{media.length ? <><div className="admin-poi-media-head"><div><h3 style={{ marginBottom: 4 }}>Medien</h3><p className="muted">{filteredMedia.length} von {media.length} Bildern sichtbar. So bleibt die Ansicht auch bei sehr vielen Dateien schnell.</p></div><div className="admin-poi-media-controls"><select className="select" value={mediaStatusFilter} onChange={(e) => { setMediaStatusFilter(e.target.value); setVisibleMediaCount(60) }}><option value="all">Alle Status</option><option value="approved">Freigegeben</option><option value="pending">Pending</option><option value="rejected">Abgelehnt</option></select><button type="button" className="btn btn-secondary" onClick={() => setVisibleMediaCount((prev) => prev + 60)} disabled={visibleMediaCount >= filteredMedia.length}>Mehr laden</button></div></div><div className="admin-poi-media-layout"><div className="admin-poi-media-grid">{visibleMedia.map((img) => <button key={img.id} type="button" className={`admin-poi-media-tile ${activeMedia?.id === img.id ? 'is-active' : ''}`} onClick={() => setActiveMediaId(img.id)}><div className="admin-poi-media-thumb">{(img.thumb_url || mediaUrls[img.path]) ? <img src={img.thumb_url || mediaUrls[img.path]} alt={img.caption || selected.title} loading="lazy" /> : <div className="muted">Kein Bildlink</div>}</div><div className="admin-poi-media-meta"><strong>{img.caption || 'Ohne Bildtext'}</strong><span className="muted">{img.status}</span></div></button>)}</div><aside className="card admin-poi-media-preview">{activeMedia ? <><div className="admin-poi-media-preview-image">{(activeMedia.thumb_url || mediaUrls[activeMedia.path]) ? <img src={activeMedia.thumb_url || mediaUrls[activeMedia.path]} alt={activeMedia.caption || selected.title} /> : <div className="muted">Kein Bildlink</div>}</div><div className="admin-poi-media-preview-body"><strong>{activeMedia.caption || selected.title}</strong><p className="muted">Status: {activeMedia.status}</p><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button type="button" className="btn btn-secondary" onClick={() => setMediaStatus(activeMedia.id, 'approved')}>Freigeben</button><button type="button" className="btn btn-danger" onClick={() => setMediaStatus(activeMedia.id, 'rejected')}>Ablehnen</button></div></div></> : <p className="muted">Bitte ein Bild auswählen.</p>}</aside></div></> : null}<AdminPOIAffiliateManager poi={selected} value={affiliateItems} onChange={setAffiliateItems} /><div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:16 }}><button type="button" className="btn btn-secondary" onClick={() => save(null)} disabled={saving}>{saving ? 'Speichert ...' : 'Speichern'}</button><button type="button" className="btn" onClick={() => save('published')} disabled={saving}>{saving ? 'Speichert ...' : 'Speichern & Freigeben'}</button></div></div></main>
}
