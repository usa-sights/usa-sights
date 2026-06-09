import { authFetchJson } from '@/utils/authFetch'

const DEFAULT_ADMIN_APP_SETTINGS = {
  publicRankingVisible: false,
  maintenanceMode: false,
  missingTable: false,
}

let cachedSettings = null
let cachedAt = 0
let inFlightRequest = null

const DEFAULT_TTL_MS = 5_000

function normalizeSettings(data = {}) {
  return {
    publicRankingVisible: data.publicRankingVisible === true,
    maintenanceMode: data.maintenanceMode === true,
    missingTable: data.missingTable === true,
    error: data.error,
  }
}

export function primeAdminAppSettings(partialSettings = {}) {
  cachedSettings = normalizeSettings({ ...(cachedSettings || DEFAULT_ADMIN_APP_SETTINGS), ...partialSettings })
  cachedAt = Date.now()
  return { ...cachedSettings }
}

export async function fetchAdminAppSettings({ force = false } = {}) {
  const now = Date.now()
  if (!force && cachedSettings && now - cachedAt < DEFAULT_TTL_MS) return { ...cachedSettings }
  if (!force && inFlightRequest) return inFlightRequest

  const request = authFetchJson('/api/admin/app-settings', { cache: 'no-store' })
    .then((data) => {
      if (data.error) return normalizeSettings(data)
      cachedSettings = normalizeSettings(data)
      cachedAt = Date.now()
      return { ...cachedSettings }
    })
    .finally(() => {
      if (inFlightRequest === request) inFlightRequest = null
    })

  if (!force) inFlightRequest = request
  return request
}
