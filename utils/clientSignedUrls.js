'use client'

const DEFAULT_TTL_MS = 50 * 60 * 1000
const signedUrlCache = new Map()
const pendingResolversByKey = new Map()
const pendingPathsByTransformKey = new Map()
const flushTimers = new Map()

function getTransformKey(transform) {
  if (!transform || typeof transform !== 'object') return 'original'
  const width = Number(transform.width) || ''
  const height = Number(transform.height) || ''
  const quality = Number(transform.quality) || ''
  const resize = transform.resize || ''
  return `${width}x${height}:${quality}:${resize}`
}

function getCacheKey(path, transform) {
  return `${getTransformKey(transform)}::${path}`
}

function normalizePath(path) {
  return typeof path === 'string' ? path.trim() : ''
}

function readCachedUrl(cacheKey) {
  const cached = signedUrlCache.get(cacheKey)
  if (!cached) return ''
  if (cached.expiresAt <= Date.now()) {
    signedUrlCache.delete(cacheKey)
    return ''
  }
  return cached.url || ''
}

function writeCachedUrl(cacheKey, url) {
  if (!url) return
  signedUrlCache.set(cacheKey, { url, expiresAt: Date.now() + DEFAULT_TTL_MS })
}

async function flushTransformQueue(transformKey, transform) {
  const paths = Array.from(pendingPathsByTransformKey.get(transformKey) || [])
  pendingPathsByTransformKey.delete(transformKey)
  flushTimers.delete(transformKey)

  const missingPaths = paths.filter((path) => !readCachedUrl(getCacheKey(path, transform)))
  if (!missingPaths.length) {
    for (const path of paths) {
      const cacheKey = getCacheKey(path, transform)
      const url = readCachedUrl(cacheKey)
      const resolvers = pendingResolversByKey.get(cacheKey) || []
      pendingResolversByKey.delete(cacheKey)
      resolvers.forEach((resolve) => resolve(url))
    }
    return
  }

  let urls = {}
  try {
    const response = await fetch('/api/images/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paths: missingPaths,
        ...(transform ? { transform } : {}),
      }),
    })
    const payload = response.ok ? await response.json() : { urls: {} }
    urls = payload?.urls || {}
  } catch {
    urls = {}
  }

  for (const path of missingPaths) {
    const cacheKey = getCacheKey(path, transform)
    if (urls[path]) writeCachedUrl(cacheKey, urls[path])
  }

  for (const path of paths) {
    const cacheKey = getCacheKey(path, transform)
    const url = readCachedUrl(cacheKey)
    const resolvers = pendingResolversByKey.get(cacheKey) || []
    pendingResolversByKey.delete(cacheKey)
    resolvers.forEach((resolve) => resolve(url))
  }
}

function scheduleFlush(transformKey, transform) {
  if (flushTimers.has(transformKey)) return
  const timer = window.setTimeout(() => flushTransformQueue(transformKey, transform), 16)
  flushTimers.set(transformKey, timer)
}

export function loadClientSignedUrl(path, transform) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return Promise.resolve('')

  const cacheKey = getCacheKey(normalizedPath, transform)
  const cachedUrl = readCachedUrl(cacheKey)
  if (cachedUrl) return Promise.resolve(cachedUrl)

  return new Promise((resolve) => {
    const resolvers = pendingResolversByKey.get(cacheKey) || []
    resolvers.push(resolve)
    pendingResolversByKey.set(cacheKey, resolvers)

    const transformKey = getTransformKey(transform)
    const pendingPaths = pendingPathsByTransformKey.get(transformKey) || new Set()
    pendingPaths.add(normalizedPath)
    pendingPathsByTransformKey.set(transformKey, pendingPaths)
    scheduleFlush(transformKey, transform)
  })
}

export async function loadClientSignedUrls(paths = [], transform) {
  const normalizedPaths = Array.from(new Set((Array.isArray(paths) ? paths : []).map(normalizePath).filter(Boolean)))
  if (!normalizedPaths.length) return {}

  const entries = await Promise.all(normalizedPaths.map(async (path) => [path, await loadClientSignedUrl(path, transform)]))
  return Object.fromEntries(entries.filter(([, url]) => Boolean(url)))
}
