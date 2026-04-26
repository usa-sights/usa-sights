import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { isMissingSchemaObjectError } from '@/lib/supabaseDb'

export const DEFAULT_PUBLIC_RANKING_VISIBLE = false

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

    return { value: data?.value_json ?? fallback, missingTable: false }
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

  return { value: value === true, missingTable }
}

export async function setAppSetting(key, value, adminClient = null) {
  const admin = adminClient || createSupabaseAdminClient()
  const { data, error } = await admin
    .from('app_settings')
    .upsert(
      {
        key,
        value_json: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select('key,value_json')
    .single()

  if (error) throw error
  return data
}
