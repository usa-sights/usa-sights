'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { getPreviewImageCandidates } from '@/lib/map/poiUtils'
import { loadClientSignedUrls } from '@/utils/clientSignedUrls'

function getImagePaths(item) {
  return [item?.cover_thumb_path, item?.cover_path]
    .filter((path) => typeof path === 'string' && path.trim())
    .map((path) => path.trim())
}

const SmartImage = memo(function SmartImage({ item, className = '', alt = '', width = 320, height = 180, fallback = null, loading = 'lazy', fetchPriority, sizes, transform }) {
  const [index, setIndex] = useState(0)
  const [signedUrls, setSignedUrls] = useState([])
  const directCandidates = getPreviewImageCandidates(item, { width, height })
  const paths = useMemo(() => getImagePaths(item), [item?.cover_thumb_path, item?.cover_path])
  const signedTransform = useMemo(() => transform || { width, height, resize: 'cover', quality: 62 }, [transform, width, height])
  const transformSignature = `${signedTransform?.width || ''}:${signedTransform?.height || ''}:${signedTransform?.resize || ''}:${signedTransform?.quality || ''}`
  const candidates = directCandidates.length ? directCandidates : signedUrls

  useEffect(() => {
    setIndex(0)
    setSignedUrls([])
  }, [item?.id, item?.slug, item?.cover_thumb_url, item?.cover_url, item?.image, item?.image_url, item?.thumbnail_url, item?.cover_thumb_path, item?.cover_path])

  useEffect(() => {
    if (directCandidates.length || !paths.length) return undefined
    let active = true
    loadClientSignedUrls(paths, signedTransform).then((urls) => {
      if (!active) return
      const orderedUrls = paths.map((path) => urls[path]).filter(Boolean)
      setSignedUrls(orderedUrls)
    })
    return () => { active = false }
  }, [directCandidates.length, paths, transformSignature])

  const src = candidates[index]
  if (!src) return fallback

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      sizes={sizes}
      onError={() => setIndex((current) => current + 1)}
    />
  )
})

export default SmartImage
