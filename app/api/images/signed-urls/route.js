import { createSupabaseAdminClient } from '@/utils/supabase/admin'

const MAX_PATHS_PER_REQUEST = 500
const SIGNING_BATCH_SIZE = 100
const TRANSFORM_SIGNING_CONCURRENCY = 8
const ALLOWED_RESIZES = new Set(['cover', 'contain', 'fill'])

function uniqueImagePaths(paths = []) {
  return Array.from(new Set((Array.isArray(paths) ? paths : [])
    .map((path) => typeof path === 'string' ? path.trim() : '')
    .filter(Boolean)))
    .slice(0, MAX_PATHS_PER_REQUEST)
}

function normalizeTransform(transform) {
  if (!transform || typeof transform !== 'object') return null

  const normalized = {}
  const width = Number(transform.width)
  const height = Number(transform.height)
  const quality = Number(transform.quality)
  const resize = typeof transform.resize === 'string' ? transform.resize : ''

  if (Number.isFinite(width) && width >= 16) normalized.width = Math.min(Math.round(width), 1600)
  if (Number.isFinite(height) && height >= 16) normalized.height = Math.min(Math.round(height), 1600)
  if (Number.isFinite(quality) && quality >= 20) normalized.quality = Math.min(Math.round(quality), 90)
  if (ALLOWED_RESIZES.has(resize)) normalized.resize = resize

  return Object.keys(normalized).length ? normalized : null
}

async function createSignedUrlsInBatches(bucket, paths) {
  const urls = {}

  for (let start = 0; start < paths.length; start += SIGNING_BATCH_SIZE) {
    const batch = paths.slice(start, start + SIGNING_BATCH_SIZE)
    const { data, error } = await bucket.createSignedUrls(batch, 3600)

    if (error) {
      throw error
    }

    if (Array.isArray(data)) {
      for (let index = 0; index < batch.length; index += 1) {
        const signedUrl = data[index]?.signedUrl
        if (signedUrl) urls[batch[index]] = signedUrl
      }
    }
  }

  return urls
}

async function createTransformedSignedUrls(bucket, paths, transform) {
  const urls = {}

  for (let start = 0; start < paths.length; start += TRANSFORM_SIGNING_CONCURRENCY) {
    const batch = paths.slice(start, start + TRANSFORM_SIGNING_CONCURRENCY)
    const results = await Promise.all(batch.map(async (path) => {
      const { data, error } = await bucket.createSignedUrl(path, 3600, { transform })
      if (error) return [path, null]
      return [path, data?.signedUrl || null]
    }))

    for (const [path, signedUrl] of results) {
      if (signedUrl) urls[path] = signedUrl
    }
  }

  const missingPaths = paths.filter((path) => !urls[path])
  if (missingPaths.length) {
    const fallbackUrls = await createSignedUrlsInBatches(bucket, missingPaths)
    Object.assign(urls, fallbackUrls)
  }

  return urls
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const paths = uniqueImagePaths(body.paths)
  const transform = normalizeTransform(body.transform)

  if (!paths.length) {
    return Response.json({ urls: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const bucket = supabase.storage.from('poi-images')
    const urls = transform
      ? await createTransformedSignedUrls(bucket, paths, transform)
      : await createSignedUrlsInBatches(bucket, paths)

    return Response.json({ urls }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Bild-URLs konnten nicht erzeugt werden.', urls: {} }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
