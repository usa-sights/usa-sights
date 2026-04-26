'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

function Lightbox({ images, startIndex, poiTitle, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const touchStart = useRef(null)
  const current = images[index]

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length)
  const next = () => setIndex((i) => (i + 1) % images.length)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function onTouchStart(e) {
    touchStart.current = e.changedTouches[0].clientX
  }

  function onTouchEnd(e) {
    if (touchStart.current == null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(dx) > 40) {
      if (dx > 0) prev()
      else next()
    }
    touchStart.current = null
  }

  return (
    <div className="poi-lightbox-backdrop" onClick={onClose}>
      <div className="poi-lightbox-shell" onClick={(e) => e.stopPropagation()}>
        <aside className="poi-lightbox-sidebar">
          <button type="button" className="poi-lightbox-close" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}>← Zurück zum Beitrag</button>
          <h2 style={{ margin: 0 }}>{poiTitle}</h2>
          <div className="muted">{index + 1} von {images.length} Bildern</div>

          <div className="poi-thumb-strip">
            {images.map((img, i) => (
              <button key={img.id || i} type="button" className={`poi-thumb ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)}>
                <img src={img.thumb_url || img.url} alt={img.caption || poiTitle} loading="lazy" />
              </button>
            ))}
          </div>
        </aside>

        <div className="poi-lightbox-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="poi-lightbox-topbar">
            <span>{index + 1} / {images.length}</span>
            <button type="button" aria-label="Galerie schließen" className="poi-lightbox-close" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }} style={{ color: 'white' }}>✕</button>
          </div>
          {images.length > 1 ? <button type="button" aria-label="Vorheriges Bild" className="poi-lightbox-nav prev" onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev() }}>‹</button> : null}
          <div className="poi-lightbox-image-wrap">
            <img className="poi-lightbox-image contain" src={current.url} alt={current.caption || poiTitle} loading="eager" />
            <div className="poi-lightbox-credit">
              {current.caption ? <div>{current.caption}</div> : null}
              {current.uploaded_by_label ? <div>Hochgeladen von: {current.uploaded_by_label}</div> : null}
            </div>
          </div>
          {images.length > 1 ? <button type="button" aria-label="Nächstes Bild" className="poi-lightbox-nav next" onClick={(e) => { e.preventDefault(); e.stopPropagation(); next() }}>›</button> : null}
        </div>
      </div>
    </div>
  )
}

export default function POIGallery({ images = [], poiTitle = '' }) {
  const [openIndex, setOpenIndex] = useState(null)
  const normalized = useMemo(() => images.filter((x) => !!x?.url), [images])
  if (!normalized.length) return null

  const main = normalized[0]
  const side = normalized.slice(1, 5)

  return (
    <>
      <div id="poi-gallery" className="poi-gallery-grid">
        <div className="poi-gallery-main" onClick={() => setOpenIndex(0)}>
          <img src={main.url || main.thumb_url} alt={main.caption || poiTitle} loading="eager" />
          {normalized.length > 1 ? <div className="poi-gallery-count">📷 {normalized.length}</div> : null}
        </div>
        <div className="poi-gallery-side">
          {side.map((img, i) => (
            <div key={img.id || i} className="poi-gallery-side-item" onClick={() => setOpenIndex(i + 1)}>
              <img src={img.thumb_url || img.url} alt={img.caption || poiTitle} loading="lazy" />
            </div>
          ))}
          {side.length < 4 ? Array.from({ length: 4 - side.length }).map((_, i) => <div key={`f-${i}`} className="poi-gallery-side-item" style={{ visibility:'hidden' }} />) : null}
        </div>
      </div>
      {openIndex !== null ? <Lightbox images={normalized} startIndex={openIndex} poiTitle={poiTitle} onClose={() => setOpenIndex(null)} /> : null}
    </>
  )
}
