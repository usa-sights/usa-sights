export const ORIGINAL_MAX_DIMENSION = 2560
export const THUMB_MAX_DIMENSION = 720
export const ORIGINAL_QUALITY = 0.86
export const THUMB_QUALITY = 0.78
export const MAX_ORIGINAL_SIZE = 7 * 1024 * 1024
export const MAX_THUMB_SIZE = 450 * 1024

function renameToWebp(fileName = 'image') {
  const safeBase = String(fileName).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image'
  return `${safeBase}.webp`
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

async function renderVariant(img, targetName, maxDimension, quality) {
  const scale = Math.min(1, maxDimension / img.width, maxDimension / img.height)
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((next) => {
      if (!next) reject(new Error('Bildkonvertierung fehlgeschlagen.'))
      else resolve(next)
    }, 'image/webp', quality)
  })
  return {
    file: new File([blob], targetName, { type: 'image/webp' }),
    width,
    height,
  }
}

export async function processImageForUpload(file) {
  const img = await loadImage(file)
  const targetName = renameToWebp(file.name)
  const original = await renderVariant(img, targetName, ORIGINAL_MAX_DIMENSION, ORIGINAL_QUALITY)
  const thumb = await renderVariant(img, targetName.replace(/\.webp$/i, '__thumb.webp'), THUMB_MAX_DIMENSION, THUMB_QUALITY)

  if (original.file.size > MAX_ORIGINAL_SIZE) throw new Error('Ein optimiertes Bild ist noch zu groß.')
  if (thumb.file.size > MAX_THUMB_SIZE) throw new Error('Eine Miniatur ist noch zu groß.')

  return {
    original: original.file,
    thumb: thumb.file,
    width: original.width,
    height: original.height,
  }
}

export function buildStoragePaths({ userId, poiId, index = 0, fileName = 'image.webp', variantPrefix = 'upload' }) {
  const stamp = `${Date.now()}-${index}`
  const baseName = renameToWebp(fileName).replace(/\.webp$/i, '')
  const basePath = `${userId}/${poiId}/${variantPrefix}-${stamp}-${baseName}`
  return {
    originalPath: `${basePath}.webp`,
    thumbPath: `${basePath}__thumb.webp`,
  }
}

export function deriveThumbPath(path) {
  if (!path) return null
  if (String(path).endsWith('__thumb.webp')) return path
  return String(path).replace(/\.webp$/i, '__thumb.webp')
}
