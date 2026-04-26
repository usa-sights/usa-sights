'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

function Block({ title, items = [], renderItem }) {
  if (!items?.length) return null
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="section-row">
        <h2>{title}</h2>
      </div>
      <div className="discovery-grid">
        {items.map(renderItem)}
      </div>
    </section>
  )
}

function DiscoveryCard({ href, title, subtitle = '', text = '', imageUrl = null, meta = '' }) {
  return (
    <Link href={href} className="discovery-card">
      {imageUrl ? <div className="discovery-image"><img src={imageUrl} alt={title} /></div> : null}
      <div className="discovery-card-body">
        <div className="discovery-title">{title}</div>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
        {text ? <div className="muted">{text}</div> : null}
        {meta ? <div className="muted">{meta}</div> : null}
      </div>
    </Link>
  )
}

export default function PublicDiscoverySection({ categoryId = null, titlePrefix = '' }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    const qs = categoryId ? `?category_id=${categoryId}` : ''
    fetch(`/api/public/discovery${qs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ newest: [], popular: [], mostReviewed: [] }))
  }, [categoryId])

  if (!data) return null

  return (
    <>
      <Block
        title={`${titlePrefix} Beliebte POIs`}
        items={data.popular}
        renderItem={(item) => (
          <DiscoveryCard
            key={`popular-${item.key}`}
            href={`/poi/${item.slug}`}
            title={item.title}
            meta={`${item.count} Favoriten`}
            imageUrl={item.image_url}
          />
        )}
      />
      <Block
        title={`${titlePrefix} Neueste POIs`}
        items={data.newest}
        renderItem={(item) => (
          <DiscoveryCard
            key={`new-${item.id}`}
            href={`/poi/${item.slug}`}
            title={item.title}
            subtitle={item.categories?.name || 'POI'}
            text={item.short_description || ''}
            imageUrl={item.image_url}
          />
        )}
      />
      <Block
        title={`${titlePrefix} Meistbewertete POIs`}
        items={data.mostReviewed}
        renderItem={(item) => (
          <DiscoveryCard
            key={`review-${item.key}`}
            href={`/poi/${item.slug}`}
            title={item.title}
            meta={`${item.count} Bewertungen`}
            imageUrl={item.image_url}
          />
        )}
      />
    </>
  )
}
