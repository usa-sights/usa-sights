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

export function calculateRatingDistribution(items = []) {
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const item of items || []) {
    const rating = Math.round(Number(item.rating || 0))
    if (rating >= 1 && rating <= 5) distribution[rating] += 1
  }
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0)
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: distribution[stars] || 0,
    percent: total ? Math.round(((distribution[stars] || 0) / total) * 100) : 0,
  }))
}

export function reviewHasVerificationInfo(row = {}) {
  return ['verified', 'is_verified', 'verified_purchase', 'is_verified_purchase', 'verified_review'].some((key) => row[key] !== undefined && row[key] !== null)
}

export function isReviewVerified(row = {}) {
  const value = row.verified ?? row.is_verified ?? row.verified_purchase ?? row.is_verified_purchase ?? row.verified_review
  return value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true'
}
