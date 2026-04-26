export const affiliateProviders = [
  { key: 'booking', name: 'Booking', placement_default: 'after_visit_info' },
  { key: 'getyourguide', name: 'GetYourGuide', placement_default: 'after_description' },
  { key: 'skyscanner', name: 'Skyscanner', placement_default: 'after_visit_info' },
  { key: 'amazon', name: 'Amazon', placement_default: 'after_description' },
]

export function buildAffiliateUrl(providerKey, poi = {}) {
  const title = encodeURIComponent(poi?.title || '')
  const city = encodeURIComponent(poi?.city || '')
  const state = encodeURIComponent(poi?.state || '')
  switch (providerKey) {
    case 'booking':
      return `https://www.booking.com/searchresults.html?ss=${city || title}`
    case 'getyourguide':
      return `https://www.getyourguide.com/s/?q=${title || city}`
    case 'skyscanner':
      return `https://www.skyscanner.de/transport/fluge-nach/${city || state || 'usa'}`
    case 'amazon':
      return `https://www.amazon.de/s?k=${title || city || 'reise'}`
    default:
      return ''
  }
}
