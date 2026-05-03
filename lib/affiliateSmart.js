export function scoreAffiliate({ poi, editorial, provider }) {
  let score = 0

  const text = [
    poi?.title,
    poi?.description,
    poi?.short_description,
    poi?.city,
    poi?.state,
    ...(editorial?.suggested_tags_json || []),
    ...(editorial?.highlights_json || []),
    ...(editorial?.nice_to_know_json || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (provider.provider_key === 'booking') {
    if (text.includes('hotel')) score += 4
    if (text.includes('übernachtung')) score += 4
    if (poi?.hotels_nearby_text) score += 5
    if (poi?.city) score += 2
    if (text.includes('lodge')) score += 3
  }

  if (provider.provider_key === 'getyourguide') {
    if (text.includes('tour')) score += 4
    if (text.includes('aktiv')) score += 3
    if (text.includes('kajak')) score += 5
    if (text.includes('wandern')) score += 5
    if (text.includes('natur')) score += 3
    if (text.includes('park')) score += 2
  }

  if (provider.provider_key === 'skyscanner') {
    if (poi?.city) score += 2
    if (poi?.state) score += 2
    if (text.includes('anreise')) score += 3
    if (text.includes('roadtrip')) score += 1
  }

  if (provider.provider_key === 'amazon') {
    if (text.includes('wandern')) score += 4
    if (text.includes('outdoor')) score += 4
    if (text.includes('kajak')) score += 4
    if (text.includes('camping')) score += 4
    if (text.includes('natur')) score += 2
    if (text.includes('wasser')) score += 2
  }

  return score
}

export function buildAffiliateCard(providerKey, poi) {
  const titleBase = poi?.title || [poi?.city, poi?.state].filter(Boolean).join(', ') || 'deine Reise'

  switch (providerKey) {
    case 'booking':
      return {
        headline: `Unterkunft nahe ${titleBase}`,
        text: 'Finde Hotels, Lodges und Unterkünfte in passender Lage.',
        cta: 'Hotels entdecken',
        image: '/images/affiliates/hotel.svg',
      }
    case 'getyourguide':
      return {
        headline: `Touren & Aktivitäten rund um ${titleBase}`,
        text: 'Erlebe die Region aktiv – von Natur bis Ausflug.',
        cta: 'Aktivitäten ansehen',
        image: '/images/affiliates/activity.svg?v=2',
      }
    case 'skyscanner':
      return {
        headline: `Anreise nach ${titleBase} planen`,
        text: 'Vergleiche passende Flugverbindungen für deine Reise.',
        cta: 'Flüge vergleichen',
        image: '/images/affiliates/flight.svg',
      }
    case 'amazon':
      return {
        headline: `Ausrüstung für ${titleBase}`,
        text: 'Praktisches Outdoor-Equipment für deinen Trip.',
        cta: 'Ausrüstung ansehen',
        image: '/images/affiliates/gear.svg',
      }
    default:
      return {
        headline: 'Reiseempfehlung',
        text: 'Passende Angebote für deine Reise.',
        cta: 'Mehr erfahren',
        image: '/images/affiliates/default.svg',
      }
  }
}

export function resolveAffiliateDisplay(setting, poi) {
  const auto = buildAffiliateCard(setting.provider_key, poi)
  return {
    provider_key: setting.provider_key,
    headline: setting.headline_override || auto.headline,
    text: setting.generated_text || auto.text,
    cta: setting.cta_text || auto.cta,
    image: setting.image_url || auto.image,
    fallback_image: auto.image,
    url: setting.manual_url,
    placement: setting.placement || 'after_description',
    is_enabled: setting.is_enabled !== false,
  }
}

export function buildSmartAffiliateCards({ poi, editorial, affiliateSettings }) {
  const enabled = (affiliateSettings || []).filter((x) => x.is_enabled && x.manual_url)

  const ranked = enabled
    .map((item) => ({
      ...item,
      score: scoreAffiliate({ poi, editorial, provider: item }),
    }))
    .sort((a, b) => {
      const byScore = b.score - a.score
      if (byScore !== 0) return byScore
      return String(a.provider_key).localeCompare(String(b.provider_key))
    })
    .slice(0, 6)

  return ranked.map((item) => resolveAffiliateDisplay(item, poi))
}
