'use client'

import { useEffect, useState } from 'react'

function Stars({ value, compact = false }) {
  const activeValue = value

  return (
    <div className={`rating-stars${compact ? ' rating-stars-compact' : ''}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`rating-star${n <= activeValue ? ' is-active' : ''}`}
          aria-label={`${n} Sterne`}
          tabIndex={-1}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function ratingFilterHref(stars) {
  return `?review_stars=${stars}#poi-reviews`
}

export default function POIReviewOverview({ poiId, refreshKey = 0, isLoggedIn = false }) {
  const [stats, setStats] = useState({ count: 0, average: 0, distribution: [] })

  useEffect(() => {
    let active = true
    async function loadStats() {
      if (!poiId) return
      const params = new URLSearchParams({ poi_id: poiId, summary: '1' })
      if (refreshKey) params.set('fresh', '1')
      const res = await fetch(`/api/poi-reviews?${params.toString()}`, { cache: refreshKey ? 'no-store' : 'default' })
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
