'use client'

import { useEffect, useState } from 'react'
import { BedDouble, CalendarRange, ExternalLink, Plane, ShoppingBag, Ticket } from 'lucide-react'

function affiliateMeta(item) {
  const key = String(item.provider_key || '').toLowerCase()
  if (key === 'booking') return { icon: BedDouble, label: 'Unterkunft', hint: 'Jetzt buchen' }
  if (key === 'getyourguide') return { icon: Ticket, label: 'Tickets', hint: 'Zum Angebot' }
  if (key === 'skyscanner') return { icon: Plane, label: 'Anreise', hint: 'Flug & Route' }
  if (key === 'amazon') return { icon: ShoppingBag, label: 'Shop', hint: 'Zum Angebot' }
  return { icon: CalendarRange, label: item.cta || 'Angebot', hint: 'Mehr erfahren' }
}

function AffiliateCard({ item }) {
  const meta = affiliateMeta(item)
  const Icon = meta.icon
  const defaultImage = '/images/affiliates/default.svg'
  const normalizedImage = item.image || item.fallback_image || defaultImage
  const [imageSrc, setImageSrc] = useState(normalizedImage)

  useEffect(() => {
    setImageSrc(normalizedImage)
  }, [normalizedImage])

  const fallback = item.fallback_image || defaultImage

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`affiliate-card affiliate-card-${String(item.provider_key || 'default').toLowerCase()}`}
      title={meta.label}
    >
      <div className="affiliate-image" style={{ backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.02), rgba(15,23,42,.12)), url(${imageSrc})` }}>
        <img
          src={imageSrc}
          alt={item.headline}
          onError={() => {
            if (imageSrc !== fallback) setImageSrc(fallback)
            else if (imageSrc !== defaultImage) setImageSrc(defaultImage)
          }}
        />
        <div className="affiliate-image-overlay">
          <span className="affiliate-image-badge"><Icon size={16} /> <span>{meta.label}</span></span>
          <span className="affiliate-image-hint">{meta.hint} <ExternalLink size={14} /></span>
        </div>
      </div>
      <div className="affiliate-content">
        <h3>{item.headline}</h3>
        {item.text ? <p>{item.text}</p> : null}
      </div>
    </a>
  )
}

export default function AffiliateSmartCards({ items = [] }) {
  if (!items.length) return null

  return (
    <section className="affiliate-grid">
      {items.map((item) => <AffiliateCard key={item.provider_key} item={item} />)}
    </section>
  )
}
