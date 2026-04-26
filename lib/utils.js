export function slugify(text = '') {
  return text.toString().trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
export function isAllowedImage(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
}
