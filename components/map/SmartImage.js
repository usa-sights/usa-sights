'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { getPreviewImageCandidates } from '@/lib/map/poiUtils'

const signedUrlCache = new Map()
const signedUrlPromiseCache = new Map()

function getImagePaths(item) {
  return [item?.cover_thumb_path, item?.cover_path]
    .filter((path) => typeof path === 'string' && path.trim())
    .map((path) => path.trim())
}

async function loadSignedUrls(paths = []) {
  const missingPaths = paths.filter((path) => path && !signedUrlCache.has(path))
  if (!missingPaths.length) {
    return Object.fromEntries(paths.map((path) => [path, signedUrlCache.get(path)]).filter(([, url]) => !!url))
  }

  const cacheKey = missingPaths.join('\n')
  if (!signedUrlPromiseCache.has(cacheKey)) {
    signedUrlPromiseCache.set(cacheKey, fetch('/api/images/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: missingPaths }),
    })
      .then((res) => res.ok ? res.json() : { urls: {} })
      .then((data) => {
        const urls = data?.urls || {}
        for (const [path, url] of Object.entries(urls)) {
          if (url) signedUrlCache.set(path, url)
        }
        return urls
      })
      .catch(() => ({}))
      .finally(() => signedUrlPromiseCache.delete(cacheKey)))
  }

  await signedUrlPromiseCache.get(cacheKey)
  return Object.fromEntries(paths.map((path) => [path, signedUrlCache.get(path)]).filter(([, url]) => !!url))
}

const SmartImage = memo(function SmartImage({ item, className = '', alt = '', width = 320, height = 180, fallback = null, loading = 'lazy', fetchPriority, sizes }) {
  const [index, setIndex] = useState(0)
  const [signedUrls, setSignedUrls] = useState([])
  const directCandidates = getPreviewImageCandidates(item, { width, height })
  const paths = useMemo(() => getImagePaths(item), [item?.cover_thumb_path, item?.cover_path])
  const candidates = directCandidates.length ? directCandidates : signedUrls

  useEffect(() => {
    setIndex(0)
    setSignedUrls([])
  }, [item?.id, item?.slug, item?.cover_thumb_url, item?.cover_url, item?.image, item?.image_url, item?.thumbnail_url, item?.cover_thumb_path, item?.cover_path])

  useEffect(() => {
    if (directCandidates.length || !paths.length) return undefined
    let active = true
    loadSignedUrls(paths).then((urls) => {
      if (!active) return
      const orderedUrls = paths.map((path) => urls[path]).filter(Boolean)
      setSignedUrls(orderedUrls)
    })
    return () => { active = false }
  }, [directCandidates.length, paths])

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
