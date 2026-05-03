'use client'

export function normalizeStatusTone(status) {
  const value = String(status || 'unknown').trim().toLowerCase()
  if (['approved', 'published', 'active'].includes(value)) return 'green'
  if (['pending'].includes(value)) return 'yellow'
  if (['rejected', 'declined', 'blocked'].includes(value)) return 'red'
  if (['draft', 'in_review', 'review', 'processing'].includes(value)) return 'blue'
  return 'gray'
}

export default function StatusBadge({ value, children }) {
  const normalized = String(value || 'unknown').trim().toLowerCase() || 'unknown'
  return (
    <span className={`status-pill status-tone-${normalizeStatusTone(normalized)} status-${normalized}`}>
      {children || value || 'unknown'}
    </span>
  )
}
