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

export async function getAppSetting(key, fallback = null, adminClient = null) {
  const admin = adminClient || createSupabaseAdminClient()

  try {
    const { data, error } = await admin
      .from('app_settings')
      .select('key,value_json')
      .eq('key', key)
      .maybeSingle()

    if (error) {
      if (isMissingSchemaObjectError(error)) {
        return { value: fallback, missingTable: true }
      }
      throw error
    }

    return { value: normalizeSettingValue(data?.value_json, fallback), missingTable: false }
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

export async function setAppSetting(key, value, adminClient = null) {
  const admin = adminClient || createSupabaseAdminClient()
  const payload = {
    key,
    value_json: value,
    updated_at: new Date().toISOString(),
  }

  // Upsert can silently fail in older schemas/client combinations when the
  // conflict target is not interpreted correctly. Do an explicit update first,
  // insert if nothing existed, and always read back the persisted value.
  const updateResult = await admin
    .from('app_settings')
    .update({ value_json: value, updated_at: payload.updated_at })
    .eq('key', key)
    .select('key,value_json')

  if (updateResult.error) {
    if (isMissingSchemaObjectError(updateResult.error)) throw updateResult.error
    throw updateResult.error
  }

  if (!updateResult.data || updateResult.data.length === 0) {
    const insertResult = await admin
      .from('app_settings')
      .insert(payload)
      .select('key,value_json')
      .single()

    if (insertResult.error) {
      if (insertResult.error.code !== '23505') throw insertResult.error
    } else {
      return insertResult.data
    }
  } else {
    return updateResult.data[0]
  }

  const { data, error } = await admin
    .from('app_settings')
    .select('key,value_json')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error
  return data
}
