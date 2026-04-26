function parseMaybeJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {}
  }
  return null
}

function defaultUrl(provider) {
  if (provider === 'Booking') return 'https://www.booking.com/'
  return 'https://www.getyourguide.com/'
}

export async function POST(req) {
  const body = await req.json()

  const prompt = `
Du hilfst beim natürlichen Einbau von Affiliate-Links für eine Reiseplattform über USA-Sehenswürdigkeiten.

Ziel:
- Ort + Thema erkennen
- optional User-Intent erkennen: eher Information oder eher Buchung
- eine passende Affiliate-Empfehlung formulieren
- nicht spammig
- als Affiliate kennzeichnen
- modular für Anbieter wie GetYourGuide oder Booking
- gib reines JSON zurück

Input:
Titel: ${body.title || ''}
Kategorie: ${body.categories?.name || body.category || ''}
Ort: ${body.city || ''}
Bundesstaat: ${body.state || ''}
Beschreibung: ${body.description || body.short_description || ''}

JSON:
{
  "provider": "",
  "user_intent": "",
  "placement_hint": "",
  "recommendation_text": "",
  "cta_text": "",
  "affiliate_url": ""
}
`

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: prompt
    })
  })

  const data = await response.json()
  const rawText =
    data.output_text ||
    data.output?.map?.((item) => item?.content?.map?.((c) => c?.text).filter(Boolean).join('\n')).filter(Boolean).join('\n') ||
    ''

  const output = parseMaybeJson(rawText) || {
    provider: '',
    user_intent: 'information',
    placement_hint: 'unter relevantem Absatz',
    recommendation_text: '',
    cta_text: 'Verfügbarkeit prüfen',
    affiliate_url: ''
  }

  if (!output.provider) {
    const text = `${body.title || ''} ${body.categories?.name || body.category || ''} ${body.description || body.short_description || ''}`.toLowerCase()
    output.provider = text.includes('hotel') || text.includes('unterkunft') ? 'Booking' : 'GetYourGuide'
  }
  if (!output.cta_text) output.cta_text = 'Verfügbarkeit prüfen'
  if (!output.affiliate_url) output.affiliate_url = defaultUrl(output.provider)
  if (!output.placement_hint) output.placement_hint = 'nach relevantem Absatz'
  if (!output.user_intent) output.user_intent = 'information'

  return Response.json({ ok: true, output, rawText, raw: data })
}
