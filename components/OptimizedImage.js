'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { loadClientSignedUrl } from '@/utils/clientSignedUrls'

const DEFAULT_FALLBACK = ''

function getTransformKey(transform) {
  if (!transform || typeof transform !== 'object') return 'original'
  const width = Number(transform.width) || ''
  const height = Number(transform.height) || ''
  const quality = Number(transform.quality) || ''
  const resize = transform.resize || ''
  return `${width}x${height}:${quality}:${resize}`
}

const OptimizedImage = memo(function OptimizedImage({
  src,
  storagePath,
  transform,
  fallbackSrc = DEFAULT_FALLBACK,
  alt = '',
  className = '',
  width,
  height,
  loading = 'lazy',
  fetchPriority,
  decoding = 'async',
  sizes,
  style,
  onClick,
}) {
  const normalizedStoragePath = typeof storagePath === 'string' ? storagePath.trim() : ''
  const transformKey = useMemo(() => getTransformKey(transform), [transform?.width, transform?.height, transform?.quality, transform?.resize])
  const initialSrc = src || (!normalizedStoragePath ? fallbackSrc : '') || ''
  const [currentSrc, setCurrentSrc] = useState(initialSrc)

  useEffect(() => {
    let active = true

    if (src) {
      setCurrentSrc(src)
      return () => { active = false }
    }

    if (!normalizedStoragePath) {
      setCurrentSrc(fallbackSrc || '')
      return () => { active = false }
    }

    setCurrentSrc('')
    loadClientSignedUrl(normalizedStoragePath, transform).then((signedUrl) => {
      if (!active) return
      setCurrentSrc(signedUrl || fallbackSrc || '')
    })

    return () => { active = false }
  }, [src, normalizedStoragePath, fallbackSrc, transformKey])

  if (!currentSrc) return null

  return (
    <img
      className={className || undefined}
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      sizes={sizes}
      style={style}
      onClick={onClick}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc)
      }}
    />
  )
})

export default OptimizedImage
