'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { authFetchJson } from '@/utils/authFetch'

function Stars({ value, onChange = null }) {
  const [hoverValue, setHoverValue] = useState(0)
  const activeValue = hoverValue || value

  return (
    <div className={onChange ? 'rating-stars rating-stars-interactive' : 'rating-stars'} onMouseLeave={() => setHoverValue(0)}>
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

export default function POIReviews({ poiId }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [items, setItems] = useState([])
  const [average, setAverage] = useState(0)
  const [count, setCount] = useState(0)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [message, setMessage] = useState('')
  const [replyTexts, setReplyTexts] = useState({})
  const [loggedIn, setLoggedIn] = useState(false)

  async function load() {
    const res = await fetch(`/api/poi-reviews?poi_id=${poiId}&t=${Date.now()}`, { cache: 'no-store' })
    const data = await res.json()
    if (data.error) return setMessage(data.error)
    setItems(data.items || [])
    setAverage(data.average || 0)
    setCount(data.count || 0)
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
    refreshLogin()
    load()
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

  async function submitReview() {
    const canProceed = await refreshLogin()
    if (!canProceed) return setMessage('Bitte zuerst einloggen.')
    const result = await authFetchJson('/api/me/poi-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poi_id: poiId, rating, review_text: reviewText || null }),
    })
    if (result.error) return setMessage(result.error)
    setReviewText('')
    setMessage('Bewertung gespeichert. Du kannst sie später jederzeit anpassen.')
    await load()
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
    await load()
  }

  const visibleReviews = items.filter((review) => String(review.review_text || '').trim())
  const hiddenRatingsOnly = Math.max(0, count - visibleReviews.length)

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="poi-reviews-head">
        <div>
          <h2>Bewertungen & Meinungen</h2>
          <p className="poi-review-summary"><strong>{average ? average.toFixed(1) : '0.0'}</strong> · {count.toLocaleString('de-DE')} Bewertungen</p>
        </div>
        <Stars value={Math.round(average || 0)} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
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
      {hiddenRatingsOnly ? <p className="muted" style={{ marginTop: 12 }}>{hiddenRatingsOnly.toLocaleString('de-DE')} Bewertung{hiddenRatingsOnly === 1 ? '' : 'en'} ohne Text werden in der Gesamtzahl mitgezählt.</p> : null}

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
            <p className="poi-review-text">{review.review_text}</p>

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
              <div className="poi-reply-form">
                <textarea
                  className="textarea"
                  rows="2"
                  value={replyTexts[review.id] || ''}
                  onChange={(e) => setReplyTexts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                  placeholder="Antwort schreiben"
                />
                <button className="btn btn-secondary" onClick={() => submitReply(review.id)}>Antwort senden</button>
              </div>
            ) : null}
          </div>
        )) : <p className="muted">Es gibt noch keine Reviews mit Text.</p>}
      </div>
    </div>
  )
}
