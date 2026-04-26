export async function POST(req) {
  const body = await req.json()
  const { lat, lng } = body
  if (!lat || !lng) return Response.json({ error: 'lat/lng fehlen' }, { status: 400 })
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`
  const res = await fetch(url, { headers: { 'User-Agent': 'usa-sights development project', 'Accept-Language': 'de,en' }, cache: 'no-store' })
  if (!res.ok) return Response.json({ error: 'Reverse Geocoding fehlgeschlagen' }, { status: 502 })
  const data = await res.json()
  const a = data.address || {}
  const state = a.state || a.region || ''
  const city = a.city || a.town || a.village || a.hamlet || ''
  const road = [a.road, a.house_number].filter(Boolean).join(' ')
  const postcode = a.postcode || ''
  const address = [road, postcode, city].filter(Boolean).join(', ')
  return Response.json({ state, city, address, raw: data })
}
