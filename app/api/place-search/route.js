export const dynamic = 'force-dynamic'

function cleanPart(value) {
  return String(value || '').trim()
}

function buildTitle(item) {
  return cleanPart(item.name) || cleanPart(item.display_name).split(',')[0] || 'Unbekannter Ort'
}

function buildSubtitle(item) {
  const address = item.address || {}
  const parts = [
    address.city || address.town || address.village || address.county,
    address.state,
    address.country,
  ].map(cleanPart).filter(Boolean)
  return parts.length ? parts.join(', ') : cleanPart(item.display_name)
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const q = cleanPart(searchParams.get('q'))

  if (q.length < 3) return Response.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } })

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'us',
  })

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'USA-Sights place search for submit-poi',
      },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error('Ortssuche ist aktuell nicht erreichbar')
    const data = await res.json()
    const items = (Array.isArray(data) ? data : [])
      .filter((item) => item.lat && item.lon)
      .map((item) => ({
        id: `${item.place_id || item.osm_id}-${item.lat}-${item.lon}`,
        title: buildTitle(item),
        subtitle: buildSubtitle(item),
        display_name: cleanPart(item.display_name),
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))

    return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return Response.json({ error: err.message || 'Ortssuche fehlgeschlagen' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
