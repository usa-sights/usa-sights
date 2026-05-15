'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { authFetchJson } from '@/utils/authFetch'
import { calculateReviewStats, normalizeReviewRow } from '@/lib/poiReviews'

const defaultFilters = { stars: 'all', period: 'all', text: 'all', verified: 'all', sort: 'newest' }

function Stars({ value, onChange = null, compact = false }) {
  const [hoverValue, setHoverValue] = useState(0)
  const activeValue = hoverValue || value

  return (
    <div className={`${onChange ? 'rating-stars rating-stars-interactive' : 'rating-stars'}${compact ? ' rating-stars-compact' : ''}`} onMouseLeave={() => setHoverValue(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange ? setHoverValue(n) : undefined}
          onFocus={() => onChange ? setHoverValue(n) : undefined}
          className={`rating-star${n <= activeValue ? ' is-active' : ''}${onChange ? ' is-clickable' : ''}`}
          aria-label={`${n} Sterne`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function formatDate(value) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function readFiltersFromUrl() {
  if (typeof window === 'undefined') return defaultFilters
  const params = new URLSearchParams(window.location.search)
  return {
    stars: params.get('review_stars') || 'all',
    period: params.get('review_period') || 'all',
    text: params.get('review_text') || 'all',
    verified: params.get('review_verified') || 'all',
    sort: params.get('review_sort') || 'newest',
  }
}

function writeFiltersToUrl(filters, withHash = false) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const mapping = [
    ['review_stars', filters.stars, 'all'],
    ['review_period', filters.period, 'all'],
    ['review_text', filters.text, 'all'],
    ['review_verified', filters.verified, 'all'],
    ['review_sort', filters.sort, 'newest'],
  ]
  for (const [key, value, fallback] of mapping) {
    if (!value || value === fallback) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  if (withHash) url.hash = 'poi-reviews'
  window.history.replaceState(null, '', url.toString())
}

function buildReviewQuery(poiId, filters) {
  const params = new URLSearchParams({ poi_id: poiId, t: String(Date.now()) })
  if (filters.stars !== 'all') params.set('stars', filters.stars)
  if (filters.period !== 'all') params.set('period', filters.period)
  if (filters.text !== 'all') params.set('text', filters.text)
  if (filters.verified !== 'all') params.set('verified', filters.verified)
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  return params
}

function ratingFilterHref(stars) {
  return `?review_stars=${stars}#poi-reviews`
}

export function POIReviewOverview({ poiId, refreshKey = 0, isLoggedIn = false }) {
  const [stats, setStats] = useState({ count: 0, average: 0, distribution: [] })

  useEffect(() => {
    let active = true
    async function loadStats() {
      if (!poiId) return
      const res = await fetch(`/api/poi-reviews?poi_id=${poiId}&t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!active || data.error) return
      setStats({
        count: Number(data.total_count ?? data.count ?? 0),
        average: Number(data.total_average ?? data.average ?? 0),
        distribution: data.distribution || [],
      })
    }
    loadStats()
    return () => { active = false }
  }, [poiId, refreshKey])

  if (!stats.count) {
    return (
      <div className="poi-review-overview poi-review-overview-empty">
        <span className="poi-review-empty-text">Sei der Erste, der diesen Ort bewertet.</span>
        <a className="poi-review-action-link" href={isLoggedIn ? '#poi-review-form' : '/register'}>
          {isLoggedIn ? 'Bewertung schreiben' : 'Jetzt registrieren und bewerten'}
        </a>
      </div>
    )
  }

  return (
    <div className="poi-review-overview" tabIndex={0}>
      <a className="poi-review-overview-trigger" href="#poi-reviews" aria-label="Bewertungen anzeigen">
        <strong>{stats.average.toFixed(1).replace('.', ',')}</strong>
        <Stars value={Math.round(stats.average)} compact />
        <span>({stats.count.toLocaleString('de-DE')} Bewertungen)</span>
      </a>
      <div className="poi-review-popover" role="dialog" aria-label="Bewertungsverteilung">
        <div className="poi-review-popover-head">
          <Stars value={Math.round(stats.average)} compact />
          <strong>{stats.average.toFixed(1).replace('.', ',')} von 5</strong>
          <span className="muted">{stats.count.toLocaleString('de-DE')} Bewertungen</span>
        </div>
        <div className="poi-rating-breakdown">
          {(stats.distribution || []).map((row) => (
            <a key={row.stars} href={ratingFilterHref(row.stars)} className="poi-rating-breakdown-row">
              <span>{row.stars} Sterne</span>
              <span className="poi-rating-bar"><span style={{ width: `${row.percent || 0}%` }} /></span>
              <strong>{row.percent || 0}%</strong>
            </a>
          ))}
        </div>
        <a className="poi-review-all-link" href="#poi-reviews">Alle Bewertungen anzeigen ›</a>
      </div>
    </div>
  )
}

export default function POIReviews({ poiId, onChanged = null }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [items, setItems] = useState([])
  const [average, setAverage] = useState(0)
  const [count, setCount] = useState(0)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [message, setMessage] = useState('')
  const [replyTexts, setReplyTexts] = useState({})
  const [activeReplyId, setActiveReplyId] = useState(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [filters, setFilters] = useState(() => readFiltersFromUrl())

  function applyItems(nextItems) {
    const normalized = (nextItems || []).map((item) => normalizeReviewRow(item))
    setItems(normalized)
    const stats = calculateReviewStats(normalized)
    setAverage(stats.average || 0)
    setCount(stats.count || 0)
  }

  async function load(nextFilters = filters) {
    if (!poiId) return
    const res = await fetch(`/api/poi-reviews?${buildReviewQuery(poiId, nextFilters).toString()}`, { cache: 'no-store' })
    const data = await res.json()
    if (data.error) return setMessage(data.error)
    applyItems(data.items || [])
    if (typeof data.average === 'number') setAverage(data.average || 0)
    if (typeof data.count === 'number') setCount(data.count || 0)
  }

  async function refreshLogin() {
    const { data } = await supabase.auth.getSession()
    const hasSession = !!data.session?.user
    if (hasSession) {
      setLoggedIn(true)
      return true
    }
    const profile = await authFetchJson('/api/me/profile')
    const ok = !profile.error && !!profile.item?.id
    setLoggedIn(ok)
    return ok
  }

  useEffect(() => {
    const initialFilters = readFiltersFromUrl()
    setFilters(initialFilters)
    refreshLogin()
    load(initialFilters)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user)
    })
    return () => sub.subscription.unsubscribe()
  }, [poiId, supabase])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || (!hash.startsWith('#review-') && !hash.startsWith('#reply-'))) return

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

    window.setTimeout(tryScroll, 100)
  }, [items])

  function changeFilter(key, value) {
    const next = { ...filters, [key]: value }
    setFilters(next)
    writeFiltersToUrl(next, true)
    load(next)
  }

  function resetFilters() {
    setFilters(defaultFilters)
    writeFiltersToUrl(defaultFilters, true)
    load(defaultFilters)
  }

  async function submitReview() {
    const canProceed = await refreshLogin()
    if (!canProceed) return setMessage('Bitte zuerst einloggen.')
    const cleanedReviewText = String(reviewText || '').trim()
    const result = await authFetchJson('/api/me/poi-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poi_id: poiId, rating, review_text: cleanedReviewText || null }),
    })
    if (result.error) return setMessage(result.error)
    const savedItem = result.item ? normalizeReviewRow(result.item, result.item.author_name || 'Du') : null
    const nextFilters = defaultFilters
    setFilters(nextFilters)
    writeFiltersToUrl(nextFilters, false)
    if (savedItem) {
      setItems((prev) => {
        const withoutOld = prev.filter((item) => item.id !== savedItem.id && (!savedItem.user_id || item.user_id !== savedItem.user_id))
        return [savedItem, ...withoutOld]
      })
      const optimisticItems = [savedItem, ...items.filter((item) => item.id !== savedItem.id && (!savedItem.user_id || item.user_id !== savedItem.user_id))]
      const stats = calculateReviewStats(optimisticItems)
      setAverage(stats.average || 0)
      setCount(stats.count || 0)
    }
    setReviewText('')
    setMessage('Bewertung gespeichert. Du kannst sie später jederzeit anpassen.')
    onChanged?.()
    await load(nextFilters)
  }

  async function submitReply(reviewId) {
    const text = replyTexts[reviewId]
    if (!text?.trim()) return
    const canProceed = await refreshLogin()
    if (!canProceed) return setMessage('Bitte zuerst einloggen.')
    const result = await authFetchJson('/api/me/poi-review-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_id: reviewId, reply_text: text }),
    })
    if (result.error) return setMessage(result.error)
    setReplyTexts((prev) => ({ ...prev, [reviewId]: '' }))
    setActiveReplyId(null)
    await load()
  }

  const visibleReviews = items.filter((review) => Number(review.rating || 0) > 0 || String(review.review_text || '').trim())
  const opinionCount = items.filter((review) => String(review.review_text || '').trim()).length
  const hasActiveFilters = Object.keys(defaultFilters).some((key) => filters[key] !== defaultFilters[key])

  return (
    <div id="poi-reviews" className="card" style={{ marginTop: 16 }}>
      <div className="poi-reviews-head">
        <div>
          <h2>Bewertungen & Meinungen</h2>
          <p className="poi-review-summary"><strong>{average ? average.toFixed(1).replace('.', ',') : '0,0'}</strong> · {count.toLocaleString('de-DE')} Bewertungen{hasActiveFilters ? ' in dieser Ansicht' : ''}</p>
        </div>
        <Stars value={Math.round(average || 0)} />
      </div>

      <div className="poi-review-filter-card">
        <div>
          <label className="label">Bewertung</label>
          <select className="select" value={filters.stars} onChange={(e) => changeFilter('stars', e.target.value)}>
            <option value="all">Alle Sterne</option>
            <option value="5">5 Sterne</option>
            <option value="4">4 Sterne</option>
            <option value="3">3 Sterne</option>
            <option value="2">2 Sterne</option>
            <option value="1">1 Stern</option>
          </select>
        </div>
        <div>
          <label className="label">Zeitraum</label>
          <select className="select" value={filters.period} onChange={(e) => changeFilter('period', e.target.value)}>
            <option value="all">Alle Zeiträume</option>
            <option value="30d">Letzte 30 Tage</option>
            <option value="90d">Letzte 90 Tage</option>
            <option value="365d">Letztes Jahr</option>
          </select>
        </div>
        <div>
          <label className="label">Kommentar</label>
          <select className="select" value={filters.text} onChange={(e) => changeFilter('text', e.target.value)}>
            <option value="all">Alle</option>
            <option value="with">Mit Kommentar</option>
            <option value="without">Ohne Kommentar</option>
          </select>
        </div>
        <div>
          <label className="label">Verifiziert</label>
          <select className="select" value={filters.verified} onChange={(e) => changeFilter('verified', e.target.value)}>
            <option value="all">Alle</option>
            <option value="yes">Verifiziert</option>
            <option value="no">Nicht verifiziert</option>
          </select>
        </div>
        <div>
          <label className="label">Sortierung</label>
          <select className="select" value={filters.sort} onChange={(e) => changeFilter('sort', e.target.value)}>
            <option value="newest">Neueste zuerst</option>
            <option value="oldest">Älteste zuerst</option>
            <option value="best">Beste zuerst</option>
            <option value="worst">Schlechteste zuerst</option>
          </select>
        </div>
        {hasActiveFilters ? <button type="button" className="btn btn-secondary" onClick={resetFilters}>Filter löschen</button> : null}
      </div>

      <div id="poi-review-form" className="card" style={{ marginTop: 16 }}>
        <h3>Deine Bewertung</h3>
        <p className="muted" style={{ marginTop: -4 }}>Wähle Sterne aus und ergänze optional einen kurzen Kommentar. Deine Bewertung kannst du später jederzeit ändern.</p>
        {loggedIn ? (
          <>
            <Stars value={rating} onChange={setRating} />
            <textarea className="textarea" rows="3" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Optionaler Kommentar" />
            <button className="btn" onClick={submitReview}>Bewertung speichern</button>
          </>
        ) : (
          <p className="muted">Bitte einloggen, um eine Bewertung abzugeben.</p>
        )}
      </div>

      {message ? <p>{message}</p> : null}
      {count ? <p className="muted" style={{ marginTop: 12 }}>{opinionCount.toLocaleString('de-DE')} Meinung{opinionCount === 1 ? '' : 'en'} mit Text · {count.toLocaleString('de-DE')} Bewertung{count === 1 ? '' : 'en'} insgesamt</p> : null}

      <div className="poi-reviews-list" style={{ marginTop: 16 }}>
        {visibleReviews.length ? visibleReviews.map((review) => (
          <div key={review.id} id={`review-${review.id}`} className="poi-review-item">
            <div className="poi-review-row">
              <div className="poi-review-meta">
                <strong>{review.author_name || 'Nutzer'}</strong>
                <span className="muted">{formatDate(review.created_at)}</span>
              </div>
              <Stars value={review.rating} />
            </div>
            {String(review.review_text || '').trim() ? <p className="poi-review-text">{review.review_text}</p> : <p className="poi-review-text muted">Bewertung ohne Text.</p>}

            {review.replies?.length ? (
              <div className="poi-reply-list">
                {review.replies.map((reply) => (
                  <div key={reply.id} id={`reply-${reply.id}`} className="poi-reply-item">
                    <div className="poi-reply-head">
                      <strong>{reply.author_name || 'Nutzer'}</strong>
                      <span className="muted">{formatDate(reply.created_at)}</span>
                    </div>
                    <p>{reply.reply_text}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {loggedIn ? (
              activeReplyId === review.id ? (
                <div className="poi-reply-form">
                  <textarea
                    className="textarea"
                    rows="2"
                    value={replyTexts[review.id] || ''}
                    onChange={(e) => setReplyTexts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                    placeholder="Antwort schreiben"
                  />
                  <div className="poi-reply-actions">
                    <button className="btn btn-secondary" onClick={() => submitReply(review.id)}>Antwort senden</button>
                    <button
                      type="button"
                      className="poi-reply-cancel"
                      onClick={() => {
                        setActiveReplyId(null)
                        setReplyTexts((prev) => ({ ...prev, [review.id]: '' }))
                      }}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="poi-reply-toggle" onClick={() => setActiveReplyId(review.id)}>Antworten</button>
              )
            ) : null}
          </div>
        )) : <p className="muted">Es gibt noch keine Bewertungen oder Meinungen für diese Filter.</p>}
      </div>
    </div>
  )
}
