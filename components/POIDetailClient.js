'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import AdminEditHint from '@/components/AdminEditHint'
import POIGallery from '@/components/POIGallery'
import POIReviews from '@/components/POIReviews'
import AffiliateSmartCards from '@/components/AffiliateSmartCards'
import UserPOIImageUploader from '@/components/UserPOIImageUploader'
import { buildSmartAffiliateCards } from '@/lib/affiliateSmart'

const hasContent = (v) => typeof v === 'string' ? v.trim().length > 0 : !!v

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

const asList = (value) => {
  const parsed = parseMaybeJson(value)
  if (Array.isArray(parsed)) return parsed.filter(Boolean)
  if (typeof parsed === 'string') return parsed.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  return []
}

const asObject = (value) => {
  const parsed = parseMaybeJson(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function Section({ id = null, title, children }) {
  return <div id={id || undefined} className="card" style={{ marginTop: 16 }}><h2>{title}</h2>{children}</div>
}

function websiteLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function POIDetailClient({ slug }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [poi, setPoi] = useState(undefined)
  const [editorial, setEditorial] = useState(null)
  const [images, setImages] = useState([])
  const [affiliateBlocks, setAffiliateBlocks] = useState([])
  const [links, setLinks] = useState([])
  const [message, setMessage] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteReady, setFavoriteReady] = useState(false)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState('user')

  const loadPoi = useCallback(async () => {
    const res = await fetch(`/api/poi-public?slug=${encodeURIComponent(slug)}&t=${Date.now()}`, { cache: 'no-store' })
    const data = await res.json()
    if (data.error) {
      setPoi(null)
      return
    }
    setPoi(data.item)
    setEditorial(data.editorial || null)
    setImages(data.images || [])
    setLinks(data.links || [])
    setAffiliateBlocks(buildSmartAffiliateCards({
      poi: data.item,
      editorial: data.editorial || null,
      affiliateSettings: data.affiliates || [],
    }))
  }, [slug])

  useEffect(() => {
    loadPoi()
  }, [loadPoi])

  useEffect(() => {
    async function refreshFavoriteState() {
      if (!poi?.id) return
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      setCurrentUserId(user?.id || null)
      if (!user?.id) {
        setCurrentUserRole('user')
        setIsFavorite(false)
        setFavoriteReady(true)
        return
      }
      const [favoriteRes, profileRes] = await Promise.all([
        supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('poi_id', poi.id)
          .maybeSingle(),
        fetch('/api/me/profile', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({ item: null })),
      ])
      setIsFavorite(!!favoriteRes.data?.id)
      setCurrentUserRole(profileRes?.item?.role === 'admin' ? 'admin' : 'user')
      setFavoriteReady(true)
    }
    refreshFavoriteState()
  }, [poi?.id, supabase])

  useEffect(() => {
    function handleAppDataChanged(event) {
      const url = String(event?.detail?.url || '')
      if (!url.includes('/api/poi-images') && !url.includes('/api/poi-links')) return
      loadPoi()
    }
    window.addEventListener('app-data-changed', handleAppDataChanged)
    return () => window.removeEventListener('app-data-changed', handleAppDataChanged)
  }, [loadPoi])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return

    let attempts = 0
    const tryScroll = () => {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      attempts += 1
      if (attempts < 10) window.setTimeout(tryScroll, 180)
    }

    window.setTimeout(tryScroll, 80)
  }, [poi?.id, images.length, links.length])

  async function toggleFavorite() {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user || !poi) return setMessage('Bitte zuerst einloggen.')
    const userId = data.session.user.id

    if (isFavorite) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('poi_id', poi.id)
      if (error) return setMessage(error.message)
      setIsFavorite(false)
      setMessage('Favorit entfernt')
      return
    }

    const { error } = await supabase.from('favorites').insert({ user_id: userId, poi_id: poi.id })
    if (error) {
      if (String(error.message || '').toLowerCase().includes('duplicate key')) {
        setIsFavorite(true)
        return setMessage('Bereits als Favorit gespeichert')
      }
      return setMessage(error.message)
    }
    setIsFavorite(true)
    setMessage('Zu Favoriten hinzugefügt')
  }

  if (poi === undefined) return <main className="container"><p>Lädt ...</p></main>
  if (poi === null) return <main className="container"><div className="error-box">POI nicht gefunden.</div></main>

  const highlights = asList(editorial?.highlights_json ?? editorial?.highlights)
  const niceToKnow = asList(editorial?.nice_to_know_json ?? editorial?.nice_to_know)
  const tags = asList(editorial?.suggested_tags_json ?? editorial?.suggested_tags)
  const familyFriendly = asObject(editorial?.family_friendly_json)
  const afterDescription = affiliateBlocks.filter((x) => x.placement === 'after_description')
  const afterVisitInfo = affiliateBlocks.filter((x) => x.placement === 'after_visit_info')
  const hasEditorial =
    highlights.length ||
    niceToKnow.length ||
    hasContent(editorial?.visit_duration_text) ||
    hasContent(editorial?.best_time_to_visit_text) ||
    typeof familyFriendly.value === 'boolean' ||
    hasContent(familyFriendly.reason) ||
    tags.length

  return (
    <main className="container">
      <h1>{poi.title}</h1>
      <div className="badge">{poi.categories?.name || 'Ohne Kategorie'}</div>
      <div className="badge">{poi.state || 'Unbekannt'}</div>

      <POIGallery images={images} poiTitle={poi.title} />

      <div className="card" style={{ marginTop: 16 }}>
        {hasContent(poi.description) ? <p>{poi.description}</p> : <p className="muted">Keine Beschreibung vorhanden.</p>}
        <AffiliateSmartCards items={afterDescription} />
      </div>

      <div className="grid grid-2">
        <Section id="poi-visitor-info" title="Besucherinfos">
          {hasContent(poi.opening_hours_text) ? <p><strong>Öffnungszeiten:</strong> {poi.opening_hours_text}</p> : null}
          {hasContent(poi.price_info_text) ? <p><strong>Preise:</strong> {poi.price_info_text}</p> : null}
          {hasContent(poi.address) ? <p><strong>Adresse:</strong> {poi.address}</p> : null}
          {hasContent(poi.city) ? <p><strong>Stadt:</strong> {poi.city}</p> : null}
          {hasContent(poi.state) ? <p><strong>Bundesstaat:</strong> {poi.state}</p> : null}
          {hasContent(poi.website_url) ? <p><strong>Website:</strong> <a href={poi.website_url} target="_blank" rel="noreferrer" className="poi-inline-link">{websiteLabel(poi.website_url)}</a></p> : null}
          {hasContent(poi.hotels_nearby_text) ? <p><strong>Hotels in der Nähe:</strong> {poi.hotels_nearby_text}</p> : null}
          <AffiliateSmartCards items={afterVisitInfo} />
        </Section>

        <Section id="poi-editorial" title="Redaktionelle Inhalte">
          {hasEditorial ? (
            <>
              {highlights.length ? <><h3>Highlights</h3><ul>{highlights.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
              {niceToKnow.length ? <><h3>Nice to know</h3><ul>{niceToKnow.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
              {hasContent(editorial?.visit_duration_text) ? <p><strong>Empfohlene Besuchsdauer:</strong> {editorial.visit_duration_text}</p> : null}
              {hasContent(editorial?.best_time_to_visit_text) ? <p><strong>Beste Besuchszeit:</strong> {editorial.best_time_to_visit_text}</p> : null}
              {typeof familyFriendly.value === 'boolean' ? <p><strong>Familienfreundlich:</strong> {familyFriendly.value ? 'Ja' : 'Nein'}</p> : null}
              {hasContent(familyFriendly.reason) ? <p><strong>Begründung Familienfreundlich:</strong> {familyFriendly.reason}</p> : null}
              {tags.length ? <><h3>Tags</h3><div>{tags.map((tag, i) => <span key={i} className="badge">{tag}</span>)}</div></> : null}
            </>
          ) : (
            <p className="muted">Keine redaktionellen Inhalte vorhanden.</p>
          )}
        </Section>
      </div>

      {links.length ? (
        <div id="poi-external-links">
        <Section title="Weiterführende Links">
          <ul>{links.map((link) => <li key={link.id} id={`poi-link-${link.id}`}><a href={link.url} target="_blank" rel="noreferrer">{link.label || link.url}</a></li>)}</ul>
        </Section>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <button className={`btn ${isFavorite ? '' : 'btn-secondary'} favorite-btn`} onClick={toggleFavorite} disabled={!favoriteReady}>
          <span className={`favorite-heart ${isFavorite ? 'active' : ''}`}>{isFavorite ? '♥' : '♡'}</span>
          <span>{isFavorite ? 'Als Favorit gespeichert' : 'Favorit'}</span>
        </button>
        <AdminEditHint poiId={poi.id} />
        {message ? <p>{message}</p> : null}
      </div>

      {currentUserId ? (
        <UserPOIImageUploader poiId={poi.id} isAdmin={currentUserRole === 'admin'} title="Fotos zu diesem POI beitragen" onUploaded={() => { loadPoi(); setTimeout(() => loadPoi(), 350); setTimeout(() => loadPoi(), 1200) }} />
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Fotos beitragen</h3>
          <p className="muted">Bitte einloggen, um Fotos zu diesem POI hochzuladen.</p>
        </div>
      )}

      <POIReviews poiId={poi.id} />
    </main>
  )
}
