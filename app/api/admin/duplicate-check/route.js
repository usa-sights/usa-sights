import { requireAdminRoute } from '@/utils/supabase/auth'

function normalize(s = '') { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => d * Math.PI / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const aa = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng/2)**2
  return 2 * R * Math.asin(Math.sqrt(aa))
}

export async function POST(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { id, title, city, state, latitude, longitude } = body

  const { data: pois, error } = await auth.admin.from('pois').select('id,title,city,state,latitude,longitude,status').neq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const currentName = normalize(title || '')
  const matches = (pois || []).map((poi) => {
    let score = 0
    const name = normalize(poi.title || '')
    if (name === currentName && currentName) score += 60
    if (name.includes(currentName) || currentName.includes(name)) score += 20
    if ((poi.city || '').toLowerCase() === (city || '').toLowerCase() && city) score += 10
    if ((poi.state || '').toLowerCase() === (state || '').toLowerCase() && state) score += 10
    const lat1 = Number(latitude), lng1 = Number(longitude), lat2 = Number(poi.latitude), lng2 = Number(poi.longitude)
    if ([lat1,lng1,lat2,lng2].every((n) => !Number.isNaN(n))) {
      const km = distanceKm(lat1, lng1, lat2, lng2)
      if (km < 0.2) score += 40
      else if (km < 1) score += 20
    }
    return { ...poi, duplicate_probability: Math.min(score, 100) }
  }).filter((x) => x.duplicate_probability >= 40).sort((a,b) => b.duplicate_probability - a.duplicate_probability)

  return Response.json({ items: matches.slice(0, 8) })
}
