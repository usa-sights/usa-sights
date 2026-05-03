export function pickReviewText(row = {}) {
  const candidates = [
    row.review_text,
    row.text,
    row.comment,
    row.comment_text,
    row.opinion,
    row.opinion_text,
    row.body,
    row.content,
    row.message,
  ]
  const found = candidates.find((value) => String(value || '').trim())
  return found ? String(found).trim() : ''
}

export function normalizeReviewRow(row = {}, authorName = null) {
  const ratingRaw = row.rating ?? row.stars ?? row.score ?? row.value
  const rating = Number(ratingRaw || 0)
  return {
    ...row,
    rating: Number.isFinite(rating) ? rating : 0,
    review_text: pickReviewText(row),
    created_at: row.created_at || row.updated_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || null,
    author_name: authorName || row.author_name || row.profiles?.name || row.profile?.name || 'Nutzer',
  }
}

export function calculateReviewStats(items = []) {
  const validRatings = items
    .map((item) => Number(item.rating || 0))
    .filter((rating) => Number.isFinite(rating) && rating > 0)
  return {
    count: validRatings.length,
    average: validRatings.length ? validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length : 0,
  }
}
