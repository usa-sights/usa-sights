export function isMissingSchemaObjectError(error) {
  const message = String(error?.message || error || '')
  return (
    /schema cache/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /Could not find the column/i.test(message) ||
    /relation .* does not exist/i.test(message)
  )
}

export async function safeExactCount(queryPromise) {
  try {
    const result = await queryPromise
    return result?.count || 0
  } catch {
    return 0
  }
}

export async function safeDelete(queryPromiseFactory) {
  const result = await queryPromiseFactory()
  if (result?.error) {
    if (isMissingSchemaObjectError(result.error)) return { skipped: true }
    throw new Error(result.error.message || 'Löschen fehlgeschlagen')
  }
  return { skipped: false }
}
