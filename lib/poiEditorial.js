export function parseMaybeJson(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!['[', '{', '"'].includes(trimmed[0])) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

export function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  const parsed = parseMaybeJson(value)
  if (parsed === null || parsed === undefined) return fallback
  if (typeof parsed === 'string') return parsed
  if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed)
  if (Array.isArray(parsed)) return parsed.map((item) => normalizeText(item, '')).filter(Boolean).join('\n')
  if (typeof parsed === 'object') {
    return normalizeText(parsed.text ?? parsed.value ?? parsed.label ?? parsed.name ?? fallback, fallback)
  }
  return fallback
}

export function normalizeList(value) {
  const parsed = parseMaybeJson(value)
  if (Array.isArray(parsed)) {
    return parsed
      .flatMap((item) => Array.isArray(item) ? item : [item])
      .map((item) => normalizeText(item, '').trim())
      .filter(Boolean)
  }
  if (parsed && typeof parsed === 'object') {
    const candidate = parsed.items ?? parsed.values ?? parsed.list ?? parsed.value
    if (candidate !== undefined) return normalizeList(candidate)
    return Object.values(parsed).map((item) => normalizeText(item, '').trim()).filter(Boolean)
  }
  if (typeof parsed === 'string') {
    return parsed
      .split(/\r?\n|\s*\|\s*|\s*;\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export function normalizeFamilyFriendly(value) {
  const parsed = parseMaybeJson(value)
  if (typeof parsed === 'boolean') return { value: parsed, reason: '' }
  if (typeof parsed === 'string') {
    const lowered = parsed.trim().toLowerCase()
    if (['true', 'ja', 'yes', '1'].includes(lowered)) return { value: true, reason: '' }
    if (['false', 'nein', 'no', '0'].includes(lowered)) return { value: false, reason: '' }
    return { reason: parsed }
  }
  if (parsed && typeof parsed === 'object') {
    const rawValue = parsed.value ?? parsed.is_family_friendly ?? parsed.family_friendly ?? parsed.friendly
    let normalizedValue
    if (typeof rawValue === 'boolean') normalizedValue = rawValue
    else if (typeof rawValue === 'string') {
      const lowered = rawValue.trim().toLowerCase()
      if (['true', 'ja', 'yes', '1'].includes(lowered)) normalizedValue = true
      if (['false', 'nein', 'no', '0'].includes(lowered)) normalizedValue = false
    }
    return {
      ...(typeof normalizedValue === 'boolean' ? { value: normalizedValue } : {}),
      reason: normalizeText(parsed.reason ?? parsed.begruendung ?? parsed.explanation ?? '', ''),
    }
  }
  return {}
}

export function normalizeEditorialRecord(editorial = {}) {
  const ed = editorial || {}
  return {
    ...ed,
    highlights_json: normalizeList(ed.highlights_json ?? ed.highlights),
    nice_to_know_json: normalizeList(ed.nice_to_know_json ?? ed.nice_to_know),
    visit_duration_text: normalizeText(ed.visit_duration_text ?? ed.visit_duration, ''),
    best_time_to_visit_text: normalizeText(ed.best_time_to_visit_text ?? ed.best_time_to_visit, ''),
    family_friendly_json: normalizeFamilyFriendly(ed.family_friendly_json ?? ed.family_friendly),
    suggested_tags_json: normalizeList(ed.suggested_tags_json ?? ed.suggested_tags ?? ed.tags),
    seo_title: normalizeText(ed.seo_title, ''),
    seo_description: normalizeText(ed.seo_description, ''),
    editorial_review_notes_json: normalizeList(ed.editorial_review_notes_json ?? ed.editorial_review_notes),
  }
}

export function normalizePoiRecord(poi = {}) {
  const item = poi || {}
  return {
    ...item,
    slug: normalizeText(item.slug, ''),
    title: normalizeText(item.title, ''),
    short_description: normalizeText(item.short_description ?? item.summary, ''),
    description: normalizeText(item.description ?? item.long_description, ''),
    state: normalizeText(item.state ?? item.state_name ?? item.region ?? item.region_text ?? item.federal_state, ''),
    city: normalizeText(item.city ?? item.town ?? item.locality ?? item.place, ''),
    address: normalizeText(item.address ?? item.address_text ?? item.formatted_address ?? item.location_address, ''),
    opening_hours_text: normalizeText(item.opening_hours_text ?? item.opening_hours ?? item.opening_hours_json ?? item.hours, ''),
    price_info_text: normalizeText(item.price_info_text ?? item.price_info ?? item.prices ?? item.price_info_json ?? item.admission_prices, ''),
    hotels_nearby_text: normalizeText(item.hotels_nearby_text ?? item.hotels_nearby ?? item.nearby_hotels ?? item.hotels, ''),
    website_url: normalizeText(item.website_url ?? item.website ?? item.official_website ?? item.url, ''),
  }
}
