'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import AdminEditHint from '@/components/AdminEditHint'
import POIGallery from '@/components/POIGallery'
import POIReviewOverview from '@/components/POIReviewOverview'
import AffiliateSmartCards from '@/components/AffiliateSmartCards'
import { buildSmartAffiliateCards } from '@/lib/affiliateSmart'
import { normalizeEditorialRecord, normalizeList, normalizeFamilyFriendly } from '@/lib/poiEditorial'
import { getNavigationButtons } from '@/lib/map/poiUtils'

const hasContent = (v) => typeof v === 'string' ? v.trim().length > 0 : !!v
const asList = (v) => normalizeList(v)

function Section({ id = null, title, children }) {
  return <div id={id || undefined} className="card" style={{ marginTop: 16 }}><h2>{title}</h2>{children}</div>
}


const POIReviews = dynamic(() => import('@/components/POIReviews'), {
  ssr: false,
  loading: () => <div id="poi-reviews" className="card" style={{ marginTop: 16 }}><h2>Bewertungen & Meinungen</h2><p className="muted">Bewertungen werden geladen ...</p></div>,
})

const UserPOIImageUploader = dynamic(() => import('@/components/UserPOIImageUploader'), {
  ssr: false,
  loading: () => <div className="card" style={{ marginTop: 12 }}><p className="muted">Upload-Bereich wird geladen ...</p></div>,
})

function shouldOpenReviewsFromLocation() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  const params = new URLSearchParams(window.location.search || '')
  return hash === '#poi-reviews' || hash.startsWith('#review-') || hash.startsWith('#reply-') ||
    params.has('review_stars') || params.has('review_period') || params.has('review_text') || params.has('review_sort')
}

function LazyPOIReviews({ poiId, onChanged }) {
  const [shouldLoad, setShouldLoad] = useState(() => shouldOpenReviewsFromLocation())
  const placeholderRef = useRef(null)

  useEffect(() => {
    if (shouldLoad) return undefined

    function openFromHash() {
      if (shouldOpenReviewsFromLocation()) setShouldLoad(true)
    }

    window.addEventListener('hashchange', openFromHash)
    const node = placeholderRef.current
    const observer = typeof IntersectionObserver !== 'undefined' && node
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setShouldLoad(true)
            observer.disconnect()
          }
        }, { rootMargin: '900px 0px' })
      : null

    if (observer && node) observer.observe(node)
    else window.setTimeout(() => setShouldLoad(true), 1200)

    return () => {
      window.removeEventListener('hashchange', openFromHash)
      observer?.disconnect()
    }
  }, [shouldLoad])

  if (shouldLoad) return <POIReviews poiId={poiId} onChanged={onChanged} />

  return (
    <div ref={placeholderRef} id="poi-reviews" className="card" style={{ marginTop: 16 }}>
      <h2>Bewertungen & Meinungen</h2>
      <p className="muted">Bewertungen werden geladen, sobald du diesen Bereich erreichst.</p>
    </div>
  )
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
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0)
  const trackedPoiIdRef = useRef(null)

  const loadPoi = useCallback(async (options = {}) => {
    const query = new URLSearchParams({ slug: String(slug || '') })
    if (options.fresh) query.set('fresh', '1')
    const res = await fetch(`/api/poi-public?${query.toString()}`, {
      cache: options.fresh ? 'no-store' : 'default',
    })
    const data = await res.json()
    if (data.error) {
      setPoi(null)
      return
    }
    setPoi(data.item)
    setEditorial(data.editorial ? normalizeEditorialRecord(data.editorial) : null)
    setImages(data.images || [])
    setLinks(data.links || [])
    setAffiliateBlocks(buildSmartAffiliateCards({
      poi: data.item,
      editorial: data.editorial ? normalizeEditorialRecord(data.editorial) : null,
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
      loadPoi({ fresh: true })
    }
    window.addEventListener('app-data-changed', handleAppDataChanged)
    return () => window.removeEventListener('app-data-changed', handleAppDataChanged)
  }, [loadPoi])

  useEffect(() => {
    if (!poi?.id || trackedPoiIdRef.current === poi.id) return
    trackedPoiIdRef.current = poi.id

    const body = JSON.stringify({ poi_id: poi.id })
    fetch('/api/poi-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {})
  }, [poi?.id])

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

  const highlights = asList(editorial?.highlights_json)
  const niceToKnow = asList(editorial?.nice_to_know_json)
  const tags = asList(editorial?.suggested_tags_json)
  const afterDescription = affiliateBlocks.filter((x) => x.placement === 'after_description')
  const afterVisitInfo = affiliateBlocks.filter((x) => x.placement === 'after_visit_info')
  const navigationButtons = getNavigationButtons(poi, true)

  const hasEditorial =
    highlights.length ||
    niceToKnow.length ||
    hasContent(editorial?.visit_duration_text) ||
    hasContent(editorial?.best_time_to_visit_text) ||
    typeof normalizeFamilyFriendly(editorial?.family_friendly_json)?.value === 'boolean' ||
    hasContent(normalizeFamilyFriendly(editorial?.family_friendly_json)?.reason) ||
    tags.length

  return (
    <main className="container">
      <h1>{poi.title}</h1>
      <div className="poi-title-meta-row">
        <POIReviewOverview poiId={poi.id} refreshKey={reviewRefreshKey} isLoggedIn={!!currentUserId} />
        <div className="badge">{poi.categories?.name || 'Ohne Kategorie'}</div>
        <div className="badge">{poi.state || 'Unbekannt'}</div>
      </div>

      <div className="card poi-quick-actions-card">
        <div className="poi-quick-actions-copy">
          <h2>Schnellaktionen</h2>
          <p>POI speichern oder direkt mit deiner bevorzugten Karten-App navigieren.</p>
        </div>
        <div className="poi-action-grid" aria-label="Schnellaktionen für diesen POI">
          <button className={`btn ${isFavorite ? '' : 'btn-secondary'} favorite-btn`} onClick={toggleFavorite} disabled={!favoriteReady}>
            <span className={`favorite-heart ${isFavorite ? 'active' : ''}`}>{isFavorite ? '♥' : '♡'}</span>
            <span>{isFavorite ? 'Favorit gespeichert' : 'Favorit markieren'}</span>
          </button>
          {navigationButtons.map((button) => (
            <a key={button.key} className="btn btn-secondary poi-action-btn" href={button.url} target="_blank" rel="noreferrer">
              {button.label}
            </a>
          ))}
        </div>
        <AdminEditHint poiId={poi.id} />
        {message ? <p style={{ flexBasis: '100%', margin: '4px 0 0' }}>{message}</p> : null}
      </div>

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
              {typeof editorial?.family_friendly_json?.value === 'boolean' ? <p><strong>Familienfreundlich:</strong> {normalizeFamilyFriendly(editorial.family_friendly_json).value ? 'Ja' : 'Nein'}</p> : null}
              {hasContent(editorial?.family_friendly_json?.reason) ? <p><strong>Begründung Familienfreundlich:</strong> {normalizeFamilyFriendly(editorial.family_friendly_json).reason}</p> : null}
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

      {currentUserId ? (
        <UserPOIImageUploader poiId={poi.id} isAdmin={currentUserRole === 'admin'} title="Fotos zu diesem POI beitragen" onUploaded={() => { loadPoi({ fresh: true }); setTimeout(() => loadPoi({ fresh: true }), 350); setTimeout(() => loadPoi({ fresh: true }), 1200) }} />
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Fotos beitragen</h3>
          <p className="muted">Bitte einloggen, um Fotos zu diesem POI hochzuladen.</p>
        </div>
      )}

      <LazyPOIReviews poiId={poi.id} onChanged={() => { setReviewRefreshKey((x) => x + 1); loadPoi({ fresh: true }) }} />
    </main>
  )
}
