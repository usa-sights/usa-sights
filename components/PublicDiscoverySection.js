'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import SmartImage from '@/components/map/SmartImage'
import { useAppDataRefresh } from '@/hooks/useAppDataRefresh'

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

function DiscoveryCard({ href, title, subtitle = '', text = '', item = null, meta = '' }) {
  const hasImage = Boolean(item?.cover_thumb_path || item?.cover_path || item?.image_url || item?.cover_thumb_url || item?.cover_url || item?.thumbnail_url)

  return (
    <Link href={href} className="discovery-card">
      {hasImage ? (
        <div className="discovery-image">
          <SmartImage item={item} alt={title} width={640} height={360} loading="lazy" sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" />
        </div>
      ) : null}
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
  const [shouldLoad, setShouldLoad] = useState(false)
  const rootRef = useRef(null)

  const loadDiscovery = useCallback(() => {
    const params = new URLSearchParams()
    if (categoryId) params.set('category_id', categoryId)
    fetch(`/api/public/discovery?${params.toString()}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ newest: [], popular: [], mostReviewed: [] }))
  }, [categoryId])

  useAppDataRefresh(() => {
    if (shouldLoad) loadDiscovery()
  })

  useEffect(() => {
    const element = rootRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '500px 0px', threshold: 0.01 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!shouldLoad) return
    loadDiscovery()
  }, [shouldLoad, loadDiscovery])

  if (!data) return <div ref={rootRef} className="discovery-lazy-placeholder" aria-hidden="true" />

  return (
    <div ref={rootRef}>
      <Block
        title={`${titlePrefix} Beliebte POIs`}
        items={data.popular}
        renderItem={(item) => (
          <DiscoveryCard
            key={`popular-${item.key}`}
            href={`/poi/${item.slug}`}
            title={item.title}
            meta={`${item.count} Favoriten`}
            item={item}
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
            item={item}
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
            item={item}
          />
        )}
      />
    </div>
  )
}
