function tryParseJsonFromText(text) {
  if (!text) return null
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  return null
}

function buildAffiliateTemplates(body) {
  const place = encodeURIComponent([body.title, body.city, body.state].filter(Boolean).join(' '))
  return {
    booking: `https://www.booking.com/searchresults.html?ss=${place}`,
    getyourguide: `https://www.getyourguide.com/s/?q=${place}`,
    skyscanner: `https://www.skyscanner.de/transport/fluge-nach/${encodeURIComponent(body.city || body.state || 'usa')}/`,
    amazon: `https://www.amazon.de/s?k=${encodeURIComponent((body.category || body.categories?.name || 'reise') + ' usa reiseutensilien')}`,
  }
}

function fallbackOutput(body) {
  const place = [body.title, body.city, body.state].filter(Boolean).join(', ') || 'dieses Reiseziel'
  return {
    short_description: body.short_description || '',
    long_description: body.description || '',
    highlights: [],
    nice_to_know: [],
    visit_duration: '',
    best_time_to_visit: '',
    family_friendly: { value: true, reason: '' },
    suggested_tags: [],
    seo_title: `${place} entdecken`,
    seo_description: `Informationen und Tipps zu ${place}.`,
    editorial_review_notes: [],
    website_url_suggestion: body.website_url || '',
    opening_hours_text_suggestion: 'Öffnungszeiten vor dem Besuch prüfen.',
    price_info_text_suggestion: 'Preise können saisonal variieren.',
    hotels_nearby_text_suggestion: `Unterkünfte in ${body.city || body.state || 'der Umgebung'} vergleichen.`,
    affiliate_recommendations: {
      booking: `Finde passende Hotels und Lodges in der Nähe von ${place}.`,
      getyourguide: `Entdecke Touren und Aktivitäten rund um ${place}.`,
      skyscanner: `Vergleiche Flugverbindungen für die Anreise nach ${place}.`,
      amazon: `Finde praktische Ausrüstung für deinen Ausflug nach ${place}.`,
    }
  }
}

export async function POST(req) {
  const body = await req.json()

  const systemPrompt = `
Du bist ein Redakteur für eine hochwertige Reiseplattform über Sehenswürdigkeiten in den USA.
Deine Aufgabe ist es, aus strukturierten Eingabedaten redaktionelle Vorschläge für einen Point of Interest (POI) zu erstellen.

Regeln:
- Schreibe sachlich, inspirierend und klar.
- Erfinde keine Fakten.
- Wenn Informationen unsicher oder nicht vorhanden sind, markiere sie als unklar.
- Öffnungszeiten, Eintrittspreise, Hotels, Website und aktuelle Angaben nur vorsichtig als Vorschlag formulieren.
- Affiliate-Texte natürlich und knapp formulieren.
- Gib strukturierte Ausgaben zurück.
- Fokus: Relevanz für Reisende.
- Sprache: Deutsch.
- Stil: informativ, hochwertig, kompakt.
- Antworte ausschließlich als JSON.
`

  const userPrompt = `
Name: ${body.title || ''}
Kategorie: ${body.categories?.name || body.category || ''}
Bundesstaat: ${body.state || ''}
Ort: ${body.city || ''}
Koordinaten: ${body.latitude || ''}, ${body.longitude || ''}
Nutzerbeschreibung: ${body.description || body.short_description || ''}
Website: ${body.website_url || ''}
Vorhandene Tags: ${(body.existing_tags || []).join?.(', ') || ''}

Bitte liefere:
1. kurze Beschreibung
2. ausführliche Beschreibung
3. 5 Highlights
4. nice_to_know
5. empfohlene Besuchsdauer
6. beste Besuchszeit
7. familienfreundlich ja/nein mit kurzer Begründung
8. 8 passende Tags
9. SEO-Title
10. SEO-Description
11. Hinweise zur redaktionellen Prüfung
12. vorsichtiger Vorschlag für Website
13. vorsichtiger Vorschlag für Öffnungszeiten
14. vorsichtiger Vorschlag für Preise
15. vorsichtiger Vorschlag für Hotels in der Nähe
16. je Affiliate-Anbieter einen knappen Empfehlungstext: booking, getyourguide, skyscanner, amazon

Format:
{
  "short_description": "",
  "long_description": "",
  "highlights": [],
  "nice_to_know": [],
  "visit_duration": "",
  "best_time_to_visit": "",
  "family_friendly": { "value": true, "reason": "" },
  "suggested_tags": [],
  "seo_title": "",
  "seo_description": "",
  "editorial_review_notes": [],
  "website_url_suggestion": "",
  "opening_hours_text_suggestion": "",
  "price_info_text_suggestion": "",
  "hotels_nearby_text_suggestion": "",
  "affiliate_recommendations": {
    "booking": "",
    "getyourguide": "",
    "skyscanner": "",
    "amazon": ""
  }
}
`

  let parsed = null
  let rawText = ''
  let raw = null

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    })
    raw = await response.json()
    rawText = raw.output_text || raw.output?.map?.(item => item?.content?.map?.(c => c?.text).filter(Boolean).join('\n')).filter(Boolean).join('\n') || ''
    parsed = tryParseJsonFromText(rawText)
  } catch {}

  parsed = { ...fallbackOutput(body), ...(parsed || {}) }
  parsed.affiliate_recommendations = {
    ...fallbackOutput(body).affiliate_recommendations,
    ...(parsed.affiliate_recommendations || {}),
  }
  parsed.affiliate_url_templates = buildAffiliateTemplates(body)

  return Response.json({ ok: true, output: parsed, rawText, raw })
}
