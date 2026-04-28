'use client'

import { memo } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPinned, MessageCircle, Navigation, Apple, Star } from 'lucide-react'
import { getNavigationButtons, getPoiHref, getPoiReviewHref } from '@/lib/map/poiUtils'
import SmartImage from '@/components/map/SmartImage'

function AppleMapsIcon() {
  return (
    <span className="map-nav-badge map-nav-badge-apple" aria-hidden="true">
      <Apple size={14} />
    </span>
  )
}

function GoogleMapsIcon() {
  return (
    <span className="map-nav-badge map-nav-badge-google" aria-hidden="true">
      <Navigation size={14} />
    </span>
  )
}

const PoiPopup = memo(function PoiPopup({ item, navigationButtonsEnabled = true }) {
  const shortText = item.short_description || item.categories?.name || ''
  const navigationButtons = getNavigationButtons(item, navigationButtonsEnabled)
  const showNavigation = navigationButtons.length > 0
  const ratingAverage = Number(item.rating_average || 0)
  const ratingCount = Number(item.rating_count || 0)
  const commentCount = Number(item.comment_count || 0)
  const hasRatingDetails = ratingCount > 0 || commentCount > 0

  return (
    <div className="map-popup-card">
      <SmartImage item={item} className="map-popup-image" alt={item.title || 'POI Bild'} width={360} height={200} />
      <div className="map-popup-body">
        <strong>{item.title}</strong>
        {shortText ? <div className="muted" style={{ marginTop: 4 }}>{shortText}</div> : null}
        {(item.city || item.state) ? <div className="muted" style={{ marginTop: 6 }}>{[item.city, item.state].filter(Boolean).join(', ')}</div> : null}
        {hasRatingDetails ? (
          <div className="map-popup-meta-row" aria-label="Bewertungen und Kommentare">
            {ratingCount > 0 ? (
              <Link href={getPoiReviewHref(item)} className="map-rating-pill"><Star size={14} />{ratingAverage ? ratingAverage.toFixed(1) : '0.0'} <small>({ratingCount.toLocaleString('de-DE')})</small></Link>
            ) : null}
            {commentCount > 0 ? (
              <Link href={getPoiReviewHref(item)} className="map-comment-pill"><MessageCircle size={14} />{commentCount.toLocaleString('de-DE')} Kommentare</Link>
            ) : null}
          </div>
        ) : null}
        <div className="map-popup-actions">
          <Link href={getPoiHref(item)} className="map-popup-link map-popup-detail-link">
            <span className="map-popup-link-main">
              <MapPinned size={16} />
              <span>Details ansehen</span>
            </span>
            <ArrowRight size={15} />
          </Link>
          {showNavigation ? (
            <div className="map-nav-grid" aria-label="Navigation zum POI">
              {navigationButtons.map((button) => (
                <a
                  key={button.key}
                  className={`map-nav-btn map-nav-btn-${button.key}`}
                  href={button.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {button.key === 'apple' ? <AppleMapsIcon /> : <GoogleMapsIcon />}
                  <span>{button.label}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

export default PoiPopup
