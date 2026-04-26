'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPinned, Navigation, Apple } from 'lucide-react'
import { getNavigationButtons, getPoiHref, getPreviewImageUrl, withCacheBust } from '@/lib/map/poiUtils'

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
  const [imageUrl, setImageUrl] = useState(() => item.previewImageUrl || getPreviewImageUrl(item) || '')
  const imageRequestKeyRef = useRef('')
  const shortText = item.short_description || item.categories?.name || ''
  const navigationButtons = getNavigationButtons(item, navigationButtonsEnabled)
  const showNavigation = navigationButtons.length > 0

  useEffect(() => {
    setImageUrl(getPreviewImageUrl(item) || '')
    imageRequestKeyRef.current = ''
  }, [item.cover_thumb_url, item.cover_url, item.image_url, item.thumbnail_url, item.id, item.slug])

  useEffect(() => {
    if (item.previewImageUrl || getPreviewImageUrl(item)) return

    const paths = [item.cover_thumb_path, item.cover_path].filter(Boolean)
    if (!paths.length) return

    const requestKey = paths.join('|')
    if (requestKey === imageRequestKeyRef.current) return
    imageRequestKeyRef.current = requestKey

    let active = true
    fetch('/api/images/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!active) return
        const url = data?.urls?.[item.cover_thumb_path] || data?.urls?.[item.cover_path] || ''
        if (url) setImageUrl(withCacheBust(url, item.id || item.slug))
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [item.cover_thumb_path, item.cover_path, item.id, item.slug])

  return (
    <div className="map-popup-card">
      {imageUrl ? (
        <img
          className="map-popup-image"
          src={imageUrl}
          alt={item.title || 'POI Bild'}
          loading="lazy"
          onError={() => setImageUrl('')}
        />
      ) : null}
      <div className="map-popup-body">
        <strong>{item.title}</strong>
        {shortText ? <div className="muted" style={{ marginTop: 4 }}>{shortText}</div> : null}
        {(item.city || item.state) ? <div className="muted" style={{ marginTop: 6 }}>{[item.city, item.state].filter(Boolean).join(', ')}</div> : null}
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
