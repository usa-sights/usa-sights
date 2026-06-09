'use client'

import { memo, useEffect, useState } from 'react'

const DEFAULT_FALLBACK = ''

const OptimizedImage = memo(function OptimizedImage({
  src,
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
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc || '')

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || '')
  }, [src, fallbackSrc])

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
