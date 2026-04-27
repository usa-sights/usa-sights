'use client'

import { memo, useEffect, useState } from 'react'
import { getPreviewImageCandidates } from '@/lib/map/poiUtils'

const SmartImage = memo(function SmartImage({ item, className = '', alt = '', width = 320, height = 180, fallback = null }) {
  const [index, setIndex] = useState(0)
  const candidates = getPreviewImageCandidates(item, { width, height })

  useEffect(() => {
    setIndex(0)
  }, [item?.id, item?.slug, item?.cover_thumb_url, item?.cover_url, item?.image, item?.image_url, item?.thumbnail_url])

  const src = candidates[index]
  if (!src) return fallback

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setIndex((current) => current + 1)}
    />
  )
})

export default SmartImage
