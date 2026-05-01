import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { isMissingSchemaObjectError } from '@/lib/supabaseDb'

export const DEFAULT_PUBLIC_RANKING_VISIBLE = false

function normalizeSettingValue(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  if (value === true || value === false) return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    try {
      return normalizeSettingValue(JSON.parse(value), fallback)
    } catch {
      return fallback
    }
  }
  if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return normalizeSettingValue(value.value, fallback)
  }
  return value ?? fallback
}

function extractSettingValue(row, fallback = null) {
  if (!row) return fallback
  if (Object.prototype.hasOwnProperty.call(row, 'value_json')) return normalizeSettingValue(row.value_json, fallback)
  if (Object.prototype.hasOwnProperty.call(row, 'value')) return normalizeSettingValue(row.value, fallback)
  return fallback
}

async function selectSetting(admin, key, fallback = null) {
  // New schema: value_json. Older intermediate installs may have used value.
  const valueJsonResult = await admin
    .from('app_settings')
    .select('key,value_json')
    .eq('key', key)
    .maybeSingle()

  if (!valueJsonResult.error) {
    return { value: extractSettingValue(valueJsonResult.data, fallback), row: valueJsonResult.data, schema: 'value_json' }
  }

  if (isMissingSchemaObjectError(valueJsonResult.error)) throw valueJsonResult.error

  const legacyResult = await admin
    .from('app_settings')
    .select('key,value')
    .eq('key', key)
    .maybeSingle()

  if (legacyResult.error) throw legacyResult.error
  return { value: extractSettingValue(legacyResult.data, fallback), row: legacyResult.data, schema: 'value' }
}

export async function getAppSetting(key, fallback = null, adminClient = null) {
  const admin = adminClient || createSupabaseAdminClient()

  try {
    const result = await selectSetting(admin, key, fallback)
    return { value: result.value, missingTable: false }
  } catch (error) {
    if (isMissingSchemaObjectError(error)) {
      return { value: fallback, missingTable: true }
    }
    throw error
  }
}

export async function getPublicRankingVisible(adminClient = null) {
  const { value, missingTable } = await getAppSetting(
    'public_ranking_visible',
    DEFAULT_PUBLIC_RANKING_VISIBLE,
    adminClient
  )

  return { value: normalizeSettingValue(value, DEFAULT_PUBLIC_RANKING_VISIBLE) === true, missingTable }
}

async function writeSettingWithColumn(admin, key, value, column) {
  const now = new Date().toISOString()
  const payload = {
    key,
    [column]: value,
    updated_at: now,
  }

  const upsert = await admin
    .from('app_settings')
    .upsert(payload, { onConflict: 'key' })
    .select(`key,${column}`)
    .single()

  if (!upsert.error) return upsert.data

  const update = await admin
    .from('app_settings')
    .update({ [column]: value, updated_at: now })
    .eq('key', key)
    .select(`key,${column}`)

  if (update.error) throw update.error
  if (update.data && update.data.length) return update.data[0]

  const insert = await admin
    .from('app_settings')
    .insert(payload)
    .select(`key,${column}`)
    .single()

  if (insert.error && insert.error.code !== '23505') throw insert.error

  const selected = await admin
    .from('app_settings')
    .select(`key,${column}`)
    .eq('key', key)
    .maybeSingle()

  if (selected.error) throw selected.error
  return selected.data
}

export async function setAppSetting(key, value, adminClient = null) {
  const admin = adminClient || createSupabaseAdminClient()

  try {
    return await writeSettingWithColumn(admin, key, value, 'value_json')
  } catch (error) {
    if (isMissingSchemaObjectError(error)) throw error
    // Some deployed databases may have an older app_settings.value column.
    // Fall back to it instead of silently making the admin toggle appear broken.
    return await writeSettingWithColumn(admin, key, value, 'value')
  }
}
